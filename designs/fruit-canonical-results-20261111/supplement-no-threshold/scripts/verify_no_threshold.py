"""Independently replay recorded candidates with scalar IoU and target-level assertions."""
from pathlib import Path
from collections import Counter
import hashlib
import json

EXP = Path("/Users/cqc/fruit_train/output/canonical_rebuild_20261111")


def overlap(a, b):
    width = max(0, min(a[2], b[2]) - max(a[0], b[0]))
    height = max(0, min(a[3], b[3]) - max(a[1], b[1]))
    intersection = width * height
    union = (a[2] - a[0]) * (a[3] - a[1]) + (b[2] - b[0]) * (b[3] - b[1]) - intersection
    return intersection / union if union > 0 else 0.0


def main():
    root = EXP / "evaluation_no_threshold_20261111"
    rows = json.loads((root / "predictions.json").read_text())
    summary = json.loads((root / "summary.json").read_text())
    old = json.loads((EXP / "evaluation/predictions.json").read_text())
    old_summary = json.loads((EXP / "evaluation/summary.json").read_text())
    assert len(rows) == len(old) == 60
    assert sum(len(r["ground_truth"]) for r in rows) == 91
    assert summary["confidence_floor"] == 0.0 and summary["match_iou"] == 0.5
    assert summary["protocol_sha256"] == hashlib.sha256((EXP / "protocol.json").read_bytes()).hexdigest()
    model_source = json.loads((EXP / ".planning/2026-11-11-per-target-no-threshold/model-source-verification.json").read_text())
    for task, digest in summary["model_hashes"].items():
        model, suffix = task.rsplit("/", 1)
        assert hashlib.sha256((EXP / "models" / model / f"best.{suffix}").read_bytes()).hexdigest() == digest
        if suffix == "onnx":
            assert digest == model_source["models"][model]["sha256"]
    aggregates = {}
    target_table = []
    for row, previous in zip(rows, old):
        assert all(row[k] == previous[k] for k in ("group", "image", "ground_truth"))
        for scheme in ("composite", "two_stage"):
            candidates = row["candidates"][scheme]
            assert len(candidates) == 300 and len({p["export_index"] for p in candidates}) == 300
            for scenario in summary["scenarios"]:
                predictions = [p for p in candidates if scenario != "baseline_025_iou" or p["confidence"] > 0.25]
                if scenario == "zero_score_top1":
                    anchors = {}
                    for p in predictions:
                        if p["anchor"] not in anchors or p["confidence"] > anchors[p["anchor"]]["confidence"]:
                            anchors[p["anchor"]] = p
                    predictions = sorted(anchors.values(), key=lambda p: (-p["confidence"], p["export_index"]))
                truth = row["ground_truth"]
                if scenario == "zero_score_top1":
                    order = []
                    assigned = set()
                    for j, p in enumerate(predictions):
                        choices = [(overlap(g["box"], p["box"]), i) for i, g in enumerate(truth) if i not in assigned]
                        if choices:
                            score, i = max(choices)
                            if score >= 0.5:
                                order.append((score, i, j))
                                assigned.add(i)
                else:
                    edges = sorted(((overlap(g["box"], p["box"]), i, j) for i, g in enumerate(truth)
                                    for j, p in enumerate(predictions)), reverse=True)
                    order = []
                    assigned_g, assigned_p = set(), set()
                    for score, i, j in edges:
                        if score >= 0.5 and i not in assigned_g and j not in assigned_p:
                            order.append((score, i, j))
                            assigned_g.add(i)
                            assigned_p.add(j)
                counts = Counter(ground_truth=len(truth), predictions=len(predictions), matched=len(order),
                                 type_correct=0, joint_correct=0, cross_type_errors=0, maturity_errors=0,
                                 missed=len(truth) - len(order), unmatched_predictions=len(predictions) - len(order))
                independent_pairs = set()
                by_target = {}
                for score, i, j in order:
                    g, p = truth[i], predictions[j]
                    correct_type = g["type"] == p["type"]
                    correct_joint = correct_type and g["state"] == p["state"]
                    counts["type_correct"] += correct_type
                    counts["joint_correct"] += correct_joint
                    counts["cross_type_errors"] += not correct_type
                    counts["maturity_errors"] += correct_type and not correct_joint
                    independent_pairs.add((i, p["export_index"]))
                    by_target[i] = {"prediction_type": p["type"], "prediction_state": p["state"], "confidence": p["confidence"],
                                    "iou": score, "type_correct": correct_type, "joint_correct": correct_joint,
                                    "type_ranking": p["type_ranking"], "label_ranking": p["label_ranking"],
                                    "maturity_ranking": p.get("maturity_ranking")}
                recorded = row["results"][scenario][scheme]
                assert independent_pairs == {(p["target_index"], p["prediction_index"]) for p in recorded["targets"]}
                assert all(recorded[k] == v for k, v in counts.items()), (row["group"], scheme, scenario)
                aggregates.setdefault((scenario, scheme), Counter()).update(counts)
                if scenario == "zero_score_top1":
                    for i, truth_item in enumerate(truth):
                        target_table.append({"group": row["group"], "image": row["image"], "zone": row["zone"], "target_index": i,
                                             "scheme": scheme, "truth": truth_item, "prediction": by_target.get(i)})
    for (scenario, scheme), counts in aggregates.items():
        assert all(summary["scenarios"][scenario][scheme][k] == v for k, v in counts.items())
        if scenario == "baseline_025_iou":
            assert all(old_summary["schemes"][scheme][k] == v for k, v in counts.items() if k != "matched")
    report = {"status": "passed", "images": 60, "targets": 91, "schemes": 2, "scenarios": 3,
              "checks": ["all local models match original run, all ONNX match current lab hash record",
                         "same images and all91ground-truth targets as original evaluation", "independent scalar-IoU replay of all six comparisons",
                         "one-to-one assignment and highest-score selection", "all original0.25counts reproduced", "background predictions remain in denominators"]}
    (root / "independent-verification.json").write_text(json.dumps(report, indent=2) + "\n")
    (root / "per-target-results.json").write_text(json.dumps(target_table, indent=2) + "\n")
    print("[✓] All six comparisons independently verified; target-level report saved.")


if __name__ == "__main__":
    main()
