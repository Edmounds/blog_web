"""Analyze saved score vectors and isolate the confidence gate with fixed score-priority matching."""
from collections import Counter
import json
from evaluate_no_threshold import EXP, SCHEMES, match_by_score, margin_summary, ranking, type_ranking
from evaluate_external import ZONES, iou
import numpy as np


def target_rankings(truth_box, candidates, names, scheme):
    eligible = [p for p in candidates if iou(truth_box, p["box"]) >= 0.5]
    if not eligible:
        return None
    scores = np.max([p["class_scores"] for p in eligible], axis=0)
    return {"type": type_ranking(scores, names, scheme), "native_label": ranking(scores, names),
            "spatial_candidates": len({p["anchor"] for p in eligible})}


def main():
    root = EXP / "evaluation_no_threshold_20261111"
    rows = json.loads((root / "predictions.json").read_text())
    existing = json.loads((root / "summary.json").read_text())
    counts = {scheme: {gate: Counter() for gate in ("0.25", "0")} for scheme in SCHEMES}
    distributions = {scheme: {kind: [] for kind in ("type", "native_label", "maturity_all_matched", "maturity_correct_type",
                                                  "same_target_type", "same_target_native_label")} for scheme in SCHEMES}
    ambiguous = []
    paired = Counter()
    per_target = []
    high_score_errors = {scheme: [] for scheme in SCHEMES}
    for row in rows:
        outcomes = {}
        for scheme in SCHEMES:
            raw = row["candidates"][scheme]
            selected = {}
            for p in raw:
                if p["anchor"] not in selected or p["confidence"] > selected[p["anchor"]]["confidence"]:
                    selected[p["anchor"]] = p
            correct_targets = set()
            for gate in ("0.25", "0"):
                predictions = [p for p in selected.values() if gate == "0" or p["confidence"] > 0.25]
                pairs, missed, extra = match_by_score(row["ground_truth"], predictions)
                count = counts[scheme][gate]
                count.update(ground_truth=len(row["ground_truth"]), predictions=len(predictions), matched=len(pairs),
                             missed=len(missed), unmatched_predictions=len(extra))
                for i, j, score in pairs:
                    g, p = row["ground_truth"][i], predictions[j]
                    correct_type = g["type"] == p["type"]
                    correct_joint = correct_type and g["state"] == p["state"]
                    assert p["state"] is not None
                    count["type_correct"] += correct_type
                    count["joint_correct"] += correct_joint
                    count["cross_type_errors"] += not correct_type
                    count["maturity_errors"] += correct_type and not correct_joint
                    if gate != "0":
                        continue
                    if correct_joint:
                        correct_targets.add(i)
                    native = p["label_ranking"]
                    if scheme == "composite":
                        names = [f"{crop}_{state}" for crop in ZONES[row["zone"]] for state in ("ripe", "unripe")]
                        assert ranking(p["class_scores"], names) == native
                        offset = 2 * ZONES[row["zone"]].index(p["type"])
                        maturity = ranking(p["class_scores"][offset:offset + 2], ["ripe", "unripe"])
                    else:
                        names = ZONES[row["zone"]]
                        maturity = p["maturity_ranking"]
                    target_competition = target_rankings(g["box"], list(selected.values()), names, scheme)
                    assert target_competition is not None
                    assert native["first"] == (p["type"] + "_" + p["state"] if scheme == "composite" else p["type"])
                    distributions[scheme]["type"].append(p["type_ranking"])
                    distributions[scheme]["native_label"].append(native)
                    distributions[scheme]["maturity_all_matched"].append(maturity)
                    distributions[scheme]["same_target_type"].append(target_competition["type"])
                    distributions[scheme]["same_target_native_label"].append(target_competition["native_label"])
                    if correct_type:
                        distributions[scheme]["maturity_correct_type"].append(maturity)
                    detail = {"scheme": scheme, "image": row["image"], "group": row["group"], "target_index": i,
                              "truth_type": g["type"], "truth_state": g["state"], "prediction_type": p["type"],
                              "prediction_state": p["state"], "confidence": p["confidence"], "iou": score,
                              "type_correct": correct_type, "joint_correct": correct_joint,
                              "type_ranking": p["type_ranking"], "native_label_ranking": native, "maturity_ranking": maturity,
                              "same_target_competition": target_competition}
                    per_target.append(detail)
                    if (target_competition["type"]["relative_gap"] < 0.1
                            or target_competition["native_label"]["relative_gap"] < 0.1 or maturity["relative_gap"] < 0.1):
                        ambiguous.append(detail)
                    if not correct_type:
                        high_score_errors[scheme].append(detail)
            outcomes[scheme] = correct_targets
        for i in range(len(row["ground_truth"])):
            a, b = (i in outcomes[scheme] for scheme in SCHEMES)
            paired["both_correct" if a and b else "composite_only" if a else "two_stage_only" if b else "neither"] += 1
    for scheme in SCHEMES:
        for key, value in counts[scheme]["0"].items():
            assert existing["scenarios"]["zero_score_top1"][scheme][key] == value
    report = {"confidence_controlled_comparison": counts, "paired_targets": paired,
              "margins": {scheme: {kind: margin_summary(values) for kind, values in data.items()}
                          for scheme, data in distributions.items()},
              "ambiguity_rule": "gap/(first+second)<0.10, equivalent to first/second<1.2222; an exploratory diagnostic, not a validated video flip threshold",
              "ambiguous_targets": ambiguous,
              "most_confident_cross_type_errors": {scheme: sorted(data, key=lambda p: -p["confidence"])[:3]
                                                     for scheme, data in high_score_errors.items()},
              "scope": "same-candidate and same-target static class competition; state margin conditioned on predicted type; not frame-to-frame stability",
              "same_target_definition": "For each annotated target, max each class score across spatial candidates with IoU>=0.50; compare different types separately from different states. This diagnostic association uses GT boxes, not GT labels, and does not change recognition counts."}
    (root / "margin-analysis.json").write_text(json.dumps(report, indent=2) + "\n")
    (root / "matched-target-margins.json").write_text(json.dumps(per_target, indent=2) + "\n")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
