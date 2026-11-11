import unittest
from evaluate_no_threshold import match_by_score, ranking, type_ranking
from analyze_no_threshold import target_rankings


class PerTargetTests(unittest.TestCase):
    def test_highest_confidence_wins_even_if_lower_confidence_box_has_higher_iou(self):
        truth = [{"box": [0, 0, 10, 10]}]
        predictions = [{"box": [0, 0, 9, 10], "confidence": 0.02}, {"box": [0, 0, 10, 10], "confidence": 0.001}]
        self.assertEqual(match_by_score(truth, predictions), ([(0, 0, 0.9)], [], [1]))

    def test_multiple_targets_are_counted_and_assignment_is_one_to_one(self):
        truth = [{"box": [0, 0, 10, 10]}, {"box": [20, 0, 30, 10]}]
        predictions = [{"box": [0, 0, 10, 10], "confidence": 0.00001}, {"box": [20, 0, 30, 10], "confidence": 0.000001}]
        pairs, missed, extra = match_by_score(truth, predictions)
        self.assertEqual(len(pairs), 2)
        self.assertEqual(missed, [])
        self.assertEqual(extra, [])

    def test_missing_and_background_boxes_are_not_forced_to_match(self):
        truth = [{"box": [0, 0, 10, 10]}]
        self.assertEqual(match_by_score(truth, [{"box": [50, 50, 60, 60], "confidence": 0.9}]), ([], [0], [0]))

    def test_type_margin_does_not_confuse_two_states_of_the_same_type(self):
        scores = [0.51, 0.50, 0.10, 0.05]
        names = ["apple_ripe", "apple_unripe", "pear_ripe", "pear_unripe"]
        self.assertAlmostEqual(ranking(scores, names)["gap"], 0.01)
        result = type_ranking(scores, names, "composite")
        self.assertEqual((result["first"], result["second"]), ("apple", "pear"))
        self.assertAlmostEqual(result["gap"], 0.41)

    def test_absolute_gap_alone_does_not_capture_low_score_relative_separation(self):
        result = ranking([0.0009, 0.0001], ["apple", "pear"])
        self.assertAlmostEqual(result["relative_gap"], 0.8)
        self.assertLess(result["gap"], 0.05)

    def test_same_target_competition_includes_other_boxes_but_excludes_other_objects(self):
        predictions = [{"anchor": 0, "box": [0, 0, 10, 10], "class_scores": [0.8, 0.1]},
                       {"anchor": 1, "box": [0, 0, 9, 10], "class_scores": [0.05, 0.78]},
                       {"anchor": 2, "box": [20, 0, 30, 10], "class_scores": [0.01, 1.0]}]
        result = target_rankings([0, 0, 10, 10], predictions, ["apple", "pear"], "two_stage")
        self.assertEqual(result["spatial_candidates"], 2)
        self.assertEqual(result["type"]["first"], "apple")
        self.assertAlmostEqual(result["type"]["second_score"], 0.78)
        self.assertAlmostEqual(result["type"]["gap"], 0.02)


if __name__ == "__main__":
    unittest.main()
