"""Supplementary target-level evaluation, without changing the frozen original results."""
from pathlib import Path
from collections import Counter
import hashlib
import json
import os
import sys

os.environ.setdefault("YOLO_AUTOINSTALL", "False")
EXP = Path("/Users/cqc/fruit_train/output/canonical_rebuild_20261111")
sys.path.insert(0, str(EXP / "scripts"))
from evaluate_external import classify, iou, match

import cv2
import numpy as np

SCHEMES = ("composite", "two_stage")
SCENARIOS = ("baseline_025_iou", "zero_iou", "zero_score_top1")


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def match_by_score(truth, predictions, threshold=0.5):
    """Assign each prediction to at most one target, prioritizing model confidence."""
    used = set()
    pairs = []
    for j in sorted(range(len(predictions)), key=lambda j: (-predictions[j]["confidence"], j)):
        candidates = [(iou(g["box"], predictions[j]["box"]), i) for i, g in enumerate(truth) if i not in used]
        if not candidates:
            break
        score, i = max(candidates)
        if score >= threshold:
            pairs.append((i, j, score))
            used.add(i)
    matched_predictions = {j for _, j, _ in pairs}
    return pairs, sorted(set(range(len(truth))) - used), sorted(set(range(len(predictions))) - matched_predictions)


def ranking(scores, labels):
    order = sorted(range(len(labels)), key=lambda i: (-float(scores[i]), i))[:2]
    first, second = (float(scores[i]) for i in order)
    return {"first": labels[order[0]], "second": labels[order[1]], "first_score": first,
            "second_score": second, "gap": first - second,
            "relative_gap": (first - second) / (first + second) if first + second else 0.0}


def type_ranking(scores, names, scheme):
    types = list(dict.fromkeys(name.rsplit("_", 1)[0] if scheme == "composite" else name for name in names))
    values = [max(float(score) for score, name in zip(scores, names)
                  if (name.rsplit("_", 1)[0] if scheme == "composite" else name) == crop) for crop in types]
    return ranking(values, types)


def metrics(rows, scenario, scheme):
    count = Counter(ground_truth=0, predictions=0, matched=0, type_correct=0, joint_correct=0,
                    cross_type_errors=0, maturity_errors=0, missed=0, unmatched_predictions=0)
    for row in rows:
        result = row["results"][scenario][scheme]
        for field in count:
            count[field] += result[field]
    return {**count, "type_recall": count["type_correct"] / count["ground_truth"],
            "joint_recall": count["joint_correct"] / count["ground_truth"],
            "type_precision": count["type_correct"] / count["predictions"] if count["predictions"] else 0.0,
            "joint_precision": count["joint_correct"] / count["predictions"] if count["predictions"] else 0.0}


def margin_summary(items):
    if not items:
        return {"n": 0}
    return {"n": len(items), "median_gap": float(np.median([r["gap"] for r in items])),
            "median_relative_gap": float(np.median([r["relative_gap"] for r in items])),
            "absolute_gap_under_005": sum(r["gap"] < 0.05 for r in items),
            "relative_gap_under_010": sum(r["relative_gap"] < 0.10 for r in items)}


def main():
    import onnxruntime as ort
    import torch
    from ultralytics import YOLO
    from ultralytics.data.augment import LetterBox
    from ultralytics.utils.ops import scale_boxes

    output = EXP / "evaluation_no_threshold_20261111"
    if output.exists():
        raise FileExistsError(f"Preserve previous diagnostics: {output}")
    source = json.loads((EXP / "evaluation/predictions.json").read_text())
    original_summary = json.loads((EXP / "evaluation/summary.json").read_text())
    status = json.loads((EXP / "training-status.json").read_text())
    assert status["status"] == "complete"
    assert status["fingerprint"] == sha(EXP / "protocol.json") + ":" + sha(EXP / "manifest.json")
    assert sha(EXP / "evaluation-selection.json") == original_summary["evaluation_selection_sha256"]
    manifest = json.loads((EXP / "manifest.json").read_text())
    expected = {(r["zone"], r["group"]): r for r in manifest if r["split"] == "external"}
    models = {}
    hashes = {}
    torch.set_num_threads(4)
    options = ort.SessionOptions()
    options.intra_op_num_threads = 4
    options.inter_op_num_threads = 1
    for mode in ("composite", "type"):
        for zone in ("fruit", "vegetable"):
            task = f"{mode}/{zone}"
            directory = EXP / "models" / task
            for suffix in ("pt", "onnx"):
                path = directory / f"best.{suffix}"
                if not path.is_file():
                    raise FileNotFoundError(path)
                hashes[f"{task}/{suffix}"] = sha(path)
                assert hashes[f"{task}/{suffix}"] == status["tasks"][task][f"best_{suffix}_sha256"]
            model = YOLO(directory / "best.pt").model.eval().fuse(verbose=False)
            models[task] = (model, ort.InferenceSession(str(directory / "best.onnx"), sess_options=options,
                                                       providers=["CPUExecutionProvider"]))
    classifiers = {}
    for crop in ("apple", "pear", "onion", "pepper", "pumpkin", "tomato"):
        task = f"ripeness/{crop}"
        path = EXP / "models" / task / "best.onnx"
        if not path.is_file():
            raise FileNotFoundError(path)
        hashes[f"{task}/onnx"] = sha(path)
        assert hashes[f"{task}/onnx"] == status["tasks"][task]["best_onnx_sha256"]
        classifiers[crop] = ort.InferenceSession(str(path), sess_options=options, providers=["CPUExecutionProvider"])

    rows = []
    max_geometry_delta = 0.0
    max_score_delta = 0.0
    baseline_score_delta = 0.0
    baseline_box_delta = 0.0
    raw_argmax_disagreements = 0
    with torch.inference_mode():
        for number, old in enumerate(source):
            image_path = EXP / old["image"]
            assert sha(image_path) == expected[old["zone"], old["group"]]["image_sha256"]
            image = cv2.imread(str(image_path))
            if image is None:
                raise ValueError(image_path)
            prepared = LetterBox(new_shape=(640, 640), auto=False)(image=image)
            array = np.ascontiguousarray(prepared[:, :, ::-1].transpose(2, 0, 1)[None], dtype=np.float32) / 255.0
            row = {k: old[k] for k in ("zone", "capture_batch", "group", "image", "ground_truth")}
            row.update(results={scenario: {} for scenario in SCENARIOS}, candidates={}, original_miss_diagnosis={})
            for scheme in SCHEMES:
                mode = "composite" if scheme == "composite" else "type"
                model, session = models[f"{mode}/{old['zone']}"]
                names = [model.names[i] for i in range(len(model.names))]
                exported = session.run(None, {session.get_inputs()[0].name: array})[0][0]
                assert exported.shape == (300, 6) and np.isfinite(exported).all()
                _, raw = model(torch.from_numpy(array))
                head = model.model[-1]
                decoded = head._inference(raw["one2one"])[0].T.cpu().numpy()
                # Row order can differ at very low scores. Recover the original spatial candidate by geometry.
                candidates = []
                scaled = scale_boxes((640, 640), torch.from_numpy(exported[:, :4].copy()), image.shape[:2]).numpy()
                for j, prediction in enumerate(exported):
                    label_id = int(prediction[5])
                    distances = np.max(np.abs(decoded[:, :4] - prediction[:4]), axis=1)
                    close = np.flatnonzero(distances <= float(distances.min()) + 0.00001)
                    anchor = int(min(close, key=lambda k: abs(float(decoded[k, 4 + label_id]) - float(prediction[4]))))
                    geometry_delta = float(distances[anchor])
                    score_delta = abs(float(decoded[anchor, 4 + label_id]) - float(prediction[4]))
                    assert geometry_delta < 0.15 and score_delta < 0.0005, (scheme, old["group"], geometry_delta, score_delta)
                    max_geometry_delta = max(max_geometry_delta, geometry_delta)
                    max_score_delta = max(max_score_delta, score_delta)
                    label = names[label_id]
                    crop, state = label.rsplit("_", 1) if scheme == "composite" else (label, None)
                    scores = decoded[anchor, 4:]
                    candidates.append({"export_index": j, "anchor": anchor, "box": scaled[j].astype(float).tolist(),
                                       "type": crop, "state": state, "confidence": float(prediction[4]),
                                       "class_scores": scores.astype(float).tolist(), "label_ranking": ranking(scores, names),
                                       "type_ranking": type_ranking(scores, names, scheme)})
                retained = [p for p in candidates if p["confidence"] > 0.25]
                previous = old["predictions"][scheme]["items"]
                assert len(retained) == len(previous), (old["group"], scheme, len(retained), len(previous))
                for a, b in zip(retained, previous):
                    baseline_box_delta = max(baseline_box_delta, float(np.max(np.abs(np.array(a["box"]) - b["box"]))))
                    baseline_score_delta = max(baseline_score_delta, abs(a["confidence"] - b["confidence"]))
                    assert a["type"] == b["type"] and np.allclose(a["box"], b["box"], atol=0.05, rtol=0.0001)
                    assert abs(a["confidence"] - b["confidence"]) < 0.0001, (old["group"], scheme, a["confidence"], b["confidence"])
                by_anchor = {}
                for p in candidates:
                    if p["anchor"] not in by_anchor or p["confidence"] > by_anchor[p["anchor"]]["confidence"]:
                        by_anchor[p["anchor"]] = p
                top1 = sorted(by_anchor.values(), key=lambda p: (-p["confidence"], p["export_index"]))
                raw_argmax_disagreements += sum(p["label_ranking"]["first"] != names[int(exported[p["export_index"], 5])] for p in top1)

                def finish_state(p):
                    if scheme == "two_stage" and p["state"] is None:
                        x1, y1, x2, y2 = p["box"]
                        roi = image[max(0, int(y1)):min(image.shape[0], int(y2)), max(0, int(x1)):min(image.shape[1], int(x2))]
                        if roi.size:
                            p["state"], confidence = classify(classifiers[p["type"]], roi)
                            p["maturity_ranking"] = {"first": p["state"], "second": "unripe" if p["state"] == "ripe" else "ripe",
                                                     "first_score": confidence, "second_score": 1.0 - confidence,
                                                     "gap": 2 * confidence - 1, "relative_gap": 2 * confidence - 1}

                for scenario, predictions in zip(SCENARIOS, (retained, candidates, top1)):
                    pairs, missed, extra = (match_by_score if scenario == "zero_score_top1" else match)(old["ground_truth"], predictions, 0.5)
                    targets = []
                    count = Counter(type_correct=0, joint_correct=0, cross_type_errors=0, maturity_errors=0)
                    for i, j, overlap in pairs:
                        truth, p = old["ground_truth"][i], predictions[j]
                        finish_state(p)
                        correct_type = truth["type"] == p["type"]
                        correct_joint = correct_type and truth["state"] == p["state"]
                        count["type_correct"] += correct_type
                        count["joint_correct"] += correct_joint
                        count["cross_type_errors"] += not correct_type
                        count["maturity_errors"] += correct_type and not correct_joint
                        targets.append({"target_index": i, "prediction_index": p["export_index"], "iou": overlap,
                                        "type_correct": correct_type, "joint_correct": correct_joint})
                    row["results"][scenario][scheme] = {**count, "ground_truth": len(old["ground_truth"]), "predictions": len(predictions),
                                                         "matched": len(pairs), "missed": len(missed), "unmatched_predictions": len(extra),
                                                         "targets": targets, "missed_target_indices": missed}
                original_missed = row["results"]["baseline_025_iou"][scheme]["missed_target_indices"]
                diagnoses = []
                for i in original_missed:
                    truth = old["ground_truth"][i]
                    localized = [p for p in candidates if iou(truth["box"], p["box"]) >= 0.5]
                    highest = max((p["confidence"] for p in localized), default=None)
                    reason = ("candidate_above_025_but_matching_competition" if highest is not None and highest > 0.25
                              else "localized_candidate_below_025" if highest is not None else "no_exported_box_with_iou_050")
                    diagnoses.append({"target_index": i, "reason": reason, "highest_localized_confidence": highest,
                                      "best_iou_all_candidates": max(iou(truth["box"], p["box"]) for p in candidates),
                                      "best_iou_above_025": max((iou(truth["box"], p["box"]) for p in retained), default=0.0)})
                row["original_miss_diagnosis"][scheme] = diagnoses
                row["candidates"][scheme] = candidates
            rows.append(row)
            if (number + 1) % 10 == 0:
                print(f"[*] No-gate target diagnostics {number + 1}/{len(source)}", flush=True)

    results = {scenario: {key: metrics(rows, scenario, key) for key in SCHEMES} for scenario in SCENARIOS}
    for key in SCHEMES:
        for field in ("ground_truth", "predictions", "type_correct", "joint_correct", "cross_type_errors", "maturity_errors", "missed", "unmatched_predictions"):
            assert results["baseline_025_iou"][key][field] == original_summary["schemes"][key][field], (key, field)
    ambiguity = {}
    for key in SCHEMES:
        all_types, correct_types, wrong_types, maturity, labels = [], [], [], [], []
        for row in rows:
            candidates = row["candidates"][key]
            for target in row["results"]["zero_score_top1"][key]["targets"]:
                p = candidates[target["prediction_index"]]
                all_types.append(p["type_ranking"])
                (correct_types if target["type_correct"] else wrong_types).append(p["type_ranking"])
                labels.append(p["label_ranking"])
                if key == "two_stage" and target["type_correct"] and "maturity_ranking" in p:
                    maturity.append(p["maturity_ranking"])
        ambiguity[key] = {"type_all_matched": margin_summary(all_types), "type_correct": margin_summary(correct_types),
                          "type_wrong": margin_summary(wrong_types), "native_label_all_matched": margin_summary(labels),
                          "maturity_given_correct_type": margin_summary(maturity)}
    summary = {"experiment_id": "canonical_rebuild_20261111", "images": len(rows), "ground_truth": sum(len(r["ground_truth"]) for r in rows),
               "confidence_floor": 0.0, "match_iou": 0.5, "max_exported_candidates_per_image": 300,
               "scenarios": results, "by_zone": {zone: {key: metrics([r for r in rows if r["zone"] == zone], "zero_score_top1", key) for key in SCHEMES}
                                                         for zone in ("fruit", "vegetable")},
               "original_miss_reasons": {key: dict(Counter(d["reason"] for row in rows for d in row["original_miss_diagnosis"][key])) for key in SCHEMES},
               "ambiguity": ambiguity, "model_hashes": hashes, "protocol_sha256": sha(EXP / "protocol.json"),
               "checks": {"original_025_counts_reproduced": True, "onnx_pt_max_box_delta_input_pixels": max_geometry_delta,
                          "onnx_pt_max_class_score_delta": max_score_delta, "baseline_max_score_delta": baseline_score_delta,
                          "baseline_max_box_delta_pixels": baseline_box_delta,
                          "raw_argmax_disagreements_on_retained_top1": raw_argmax_disagreements},
               "limitations": ["supplementary diagnostic requested after inspecting external results; not a new blind test",
                               "no confidence gate still retains the export's fixed top300 limit",
                               "zero_score_top1 keeps each raw spatial candidate's highest-scoring exported class and matches by descending confidence",
                               "all unmatched/background candidates are retained in prediction denominators; no GT crops or GT-class selection",
                               "classifiers run only for candidates matched under at least one scenario; unmatched candidates need no state for these counts",
                               "static same-candidate class margins are uncalibrated proxies; no video frame-to-frame flip rate or latency measured"]}
    output.mkdir()
    (output / "predictions.json").write_text(json.dumps(rows, indent=2) + "\n")
    (output / "summary.json").write_text(json.dumps(summary, indent=2) + "\n")
    print("[✓] Supplementary evaluation saved: " + str(output), flush=True)
    print(json.dumps({"scenarios": results, "original_miss_reasons": summary["original_miss_reasons"], "ambiguity": ambiguity}, indent=2), flush=True)


if __name__ == "__main__":
    main()
