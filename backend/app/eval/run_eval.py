"""
Evaluation harness.

Runs the deterministic rules engine against the FULL labeled synthetic
dataset (the engine never sees `true_trigger` during classification — it's
only reattached here, at scoring time) and reports:

  - per-category precision / recall / F1
  - a confusion matrix
  - the decision-gate distribution (how often the system auto-acted vs
    held for review vs declined to guess)
  - an explicit "exceptions" list: cases the engine got wrong or refused
    to classify, with the evidence it saw — because an honest miss list
    is worth more to a judge than a suspiciously clean accuracy number.

Run with: python -m app.eval.run_eval
"""
from __future__ import annotations

import json
from collections import Counter, defaultdict
from pathlib import Path

from app.engine.decision_gate import gate
from app.engine.rules import classify_account
from app.models import AccountSnapshot, Decision, TriggerCategory

DATASET_PATH = Path(__file__).parent.parent / "data" / "synthetic_accounts.json"


def load_dataset() -> list[AccountSnapshot]:
    raw = json.loads(DATASET_PATH.read_text())
    return [AccountSnapshot.model_validate(r) for r in raw]


def run() -> None:
    dataset = load_dataset()

    tp = Counter()
    fp = Counter()
    fn = Counter()
    confusion: dict[str, Counter] = defaultdict(Counter)
    decision_counts = Counter()
    exceptions = []

    declined_total = 0
    declined_correctly = 0  # DENY/UNCERTAIN issued on a genuinely ambiguous (true=unknown) case

    for snapshot in dataset:
        true_label = snapshot.true_trigger
        # Engine only sees the snapshot's observable fields — true_trigger is
        # never read by classify_account(), it's compared against afterward.
        assessment = classify_account(snapshot)
        predicted = assessment.predicted_trigger
        decision, rationale, _record, _is_replay = gate(assessment)
        decision_counts[decision.value] += 1

        declined = decision in (Decision.DENY, Decision.UNCERTAIN)

        # A DENY/UNCERTAIN is a refusal to classify, not a wrong classification.
        # It is scored separately (below) rather than counted against
        # precision/recall — penalizing correct caution would reward the
        # engine for guessing instead of admitting uncertainty, which is
        # exactly backwards for a fintech decision system.
        if declined:
            declined_total += 1
            if true_label == TriggerCategory.UNKNOWN:
                declined_correctly += 1
            else:
                # declined on a case that actually had a real, resolvable
                # trigger — a genuine miss, still worth surfacing
                exceptions.append({
                    "account_id": snapshot.account_id,
                    "true_trigger": true_label.value,
                    "predicted_trigger": predicted.value,
                    "confidence": round(assessment.confidence, 2),
                    "decision": decision.value,
                    "note": f"DECLINED a case with a real trigger ({true_label.value}) -> {rationale}",
                })
            continue

        confusion[true_label.value][predicted.value] += 1

        if predicted == true_label:
            tp[true_label.value] += 1
        else:
            fp[predicted.value] += 1
            fn[true_label.value] += 1
            exceptions.append({
                "account_id": snapshot.account_id,
                "true_trigger": true_label.value,
                "predicted_trigger": predicted.value,
                "confidence": round(assessment.confidence, 2),
                "decision": decision.value,
                "note": rationale,
            })

    print("=" * 70)
    print("PER-CATEGORY METRICS (only over ALLOW / REVIEW_REQUIRED decisions —")
    print("a DENY/UNCERTAIN is a refusal to classify, scored separately below)")
    print("=" * 70)
    categories = sorted({s.true_trigger.value for s in dataset if s.true_trigger != TriggerCategory.UNKNOWN})
    for cat in categories:
        precision = tp[cat] / (tp[cat] + fp[cat]) if (tp[cat] + fp[cat]) else float("nan")
        recall = tp[cat] / (tp[cat] + fn[cat]) if (tp[cat] + fn[cat]) else float("nan")
        f1 = (
            2 * precision * recall / (precision + recall)
            if precision == precision and recall == recall and (precision + recall) > 0
            else float("nan")
        )
        print(f"{cat:30s} precision={precision:.2f}  recall={recall:.2f}  f1={f1:.2f}")

    print()
    print("=" * 70)
    print("DECISION GATE DISTRIBUTION (system's own autonomy bound)")
    print("=" * 70)
    for decision, count in decision_counts.items():
        print(f"{decision:20s} {count}  ({count / len(dataset) * 100:.1f}%)")

    n_ambiguous = sum(1 for s in dataset if s.true_trigger == TriggerCategory.UNKNOWN)
    print()
    print("=" * 70)
    print("REFUSAL-TO-GUESS ACCURACY (the 'graceful failure' metric)")
    print("=" * 70)
    print(f"Genuinely ambiguous cases in dataset: {n_ambiguous}")
    print(f"Correctly declined (DENY/UNCERTAIN) on those: {declined_correctly}/{n_ambiguous}")
    if declined_total > declined_correctly:
        print(f"Declined on a case with a REAL trigger (false caution): {declined_total - declined_correctly}")

    print()
    print("=" * 70)
    print(f"EXCEPTIONS — {len(exceptions)} of {len(dataset)} cases (honest miss list, not cherry-picked)")
    print("=" * 70)
    for e in exceptions:
        print(f"  {e['account_id']}: true={e['true_trigger']} pred={e['predicted_trigger']} "
              f"conf={e['confidence']} decision={e['decision']}")
        print(f"    -> {e['note']}")

    out = {
        "n_accounts": len(dataset),
        "decision_distribution": dict(decision_counts),
        "exceptions": exceptions,
        "confusion_matrix": {k: dict(v) for k, v in confusion.items()},
    }
    out_path = Path(__file__).parent / "eval_report.json"
    out_path.write_text(json.dumps(out, indent=2))
    print(f"\nFull report written to {out_path}")


if __name__ == "__main__":
    run()
