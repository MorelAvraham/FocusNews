import os
import sys
import unittest

sys.path.append(os.path.join(os.getcwd(), "api"))

from news_core import SOURCE_INDEX, classify_verification, cluster_messages, deduplicate_messages, score_message


class PipelineTests(unittest.TestCase):
    def build_message(self, source_id, text, time_str="2026-03-15T10:00:00+00:00"):
        return {
            "channel": source_id,
            "text": text,
            "time": time_str,
            "source": SOURCE_INDEX[source_id],
        }

    def test_noise_messages_are_dropped(self):
        result = score_message(self.build_message("amitsegal", "עדכון קצר מאוד"))
        self.assertIsNone(result)

    def test_high_trust_signal_scores(self):
        strong = score_message(self.build_message("amitsegal", "Prime minister statement after cabinet meeting on ceasefire and hostage negotiations with operational impact."))
        medium = score_message(self.build_message("FotrosResistance", "Minor unverified report from one channel only about a possible movement in the area."))
        self.assertIsNotNone(strong)
        self.assertIsNotNone(medium)
        self.assertGreater(strong["score"], medium["score"])

    def test_cluster_confirmation_uses_multiple_sources(self):
        messages = [
            score_message(self.build_message("amitsegal", "Cabinet update: ceasefire discussions continue after late-night security assessment and hostage negotiations.")),
            score_message(self.build_message("Kan11News", "Security cabinet discussions continue overnight around ceasefire and hostage deal options.")),
        ]
        deduped = deduplicate_messages([message for message in messages if message])
        clusters = cluster_messages(deduped)
        self.assertTrue(clusters)
        self.assertEqual(classify_verification(clusters[0]), "confirmed")


if __name__ == "__main__":
    unittest.main()
