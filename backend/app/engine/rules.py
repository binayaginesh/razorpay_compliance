"""
Deterministic trigger-classification rules.

Deliberately NOT an LLM call. Classifying "is this account's chargeback
ratio over threshold" is a comparison, not a judgment call — using an LLM
here would add latency, cost, and a hallucination surface for zero benefit.
Reasoning/language happens later (see engine/investigator.py), only on the
already-classified evidence.

Each rule below returns (fires: bool, evidence: Evidence | None). The
combination step in classify_account() decides confidence + whether
signals conflict.

Revision: Evidence objects now carry a `weight` field — a simple,
rule-defined contribution score, not a learned weight. Shown ranked in
the dashboard under the confidence score.
"""
from __future__ import annotations

from app.models import AccountSnapshot, Evidence, TriggerAssessment, TriggerCategory

# Thresholds sourced from Razorpay's own published guidance + RBI's
# industry-standard chargeback soft-threshold convention (~1%).
VOLUME_SPIKE_MULTIPLIER = 2.5
CHARGEBACK_RATIO_THRESHOLD_PCT = 1.0
MILD_VOLUME_MULTIPLIER = 1.5  # below full-spike but worth flagging as a weak signal


def _check_kyc_gap(s: AccountSnapshot) -> Evidence | None:
    if s.kyc_status in ("pending", "mismatch", "expired") or s.kyc_fields_flagged:
        return Evidence(
            signal="kyc_status",
            observed_value=f"{s.kyc_status}; flagged_fields={s.kyc_fields_flagged}",
            threshold_or_reference="kyc_status == verified AND no flagged fields",
            contributes_to=TriggerCategory.KYC_DOCUMENTATION_GAP,
            weight=0.25,
        )
    return None


def _check_volume_spike(s: AccountSnapshot) -> Evidence | None:
    ratio = s.trailing_3d_avg_daily_volume_inr / max(s.declared_avg_daily_volume_inr, 1)
    if ratio >= VOLUME_SPIKE_MULTIPLIER:
        return Evidence(
            signal="volume_ratio",
            observed_value=f"{ratio:.2f}x declared average",
            threshold_or_reference=f">= {VOLUME_SPIKE_MULTIPLIER}x",
            contributes_to=TriggerCategory.VOLUME_SPIKE,
            weight=0.31,
        )
    if ratio >= MILD_VOLUME_MULTIPLIER:
        return Evidence(
            signal="volume_ratio_mild",
            observed_value=f"{ratio:.2f}x declared average",
            threshold_or_reference=f">= {MILD_VOLUME_MULTIPLIER}x (weak signal, below full threshold)",
            contributes_to=TriggerCategory.VOLUME_SPIKE,
            weight=0.11,
        )
    return None


def _check_chargeback(s: AccountSnapshot) -> Evidence | None:
    threshold = s.chargeback_ratio_threshold_pct or CHARGEBACK_RATIO_THRESHOLD_PCT
    if s.chargeback_ratio_pct >= threshold:
        return Evidence(
            signal="chargeback_ratio_pct",
            observed_value=f"{s.chargeback_ratio_pct}%",
            threshold_or_reference=f">= {threshold}%",
            contributes_to=TriggerCategory.CHARGEBACK_RATIO,
            weight=0.31,
        )
    if s.chargeback_ratio_pct >= threshold * 0.75:
        return Evidence(
            signal="chargeback_ratio_pct_borderline",
            observed_value=f"{s.chargeback_ratio_pct}%",
            threshold_or_reference=f">= {threshold * 0.75:.2f}% (borderline, below full threshold)",
            contributes_to=TriggerCategory.CHARGEBACK_RATIO,
            weight=0.11,
        )
    return None


def _check_mcc_mismatch(s: AccountSnapshot) -> Evidence | None:
    off_category = [c for c in s.observed_txn_categories if c != s.declared_mcc]
    if len(off_category) >= 2:
        return Evidence(
            signal="observed_txn_categories",
            observed_value=str(s.observed_txn_categories),
            threshold_or_reference=f"declared_mcc={s.declared_mcc}; >=2 off-category transactions",
            contributes_to=TriggerCategory.MCC_MISMATCH,
            weight=0.20,
        )
    return None


def _check_fraud_linkage(s: AccountSnapshot) -> Evidence | None:
    if s.linked_flagged_accounts > 0 or s.recent_cybercrime_complaint:
        return Evidence(
            signal="fraud_linkage",
            observed_value=(
                f"linked_flagged_accounts={s.linked_flagged_accounts}, "
                f"cybercrime_complaint={s.recent_cybercrime_complaint}"
            ),
            threshold_or_reference="linked_flagged_accounts > 0 OR recent_cybercrime_complaint",
            contributes_to=TriggerCategory.THIRD_PARTY_FRAUD_LINKAGE,
            weight=0.35,
        )
    return None


RULES = [
    _check_kyc_gap,
    _check_volume_spike,
    _check_chargeback,
    _check_mcc_mismatch,
    _check_fraud_linkage,
]

# Strong-signal evidence (full threshold crossed) vs weak-signal (below full
# threshold, mentioned above as "borderline"/"mild") — used to set confidence.
_WEAK_SIGNAL_MARKERS = ("mild", "borderline")


def classify_account(snapshot: AccountSnapshot) -> TriggerAssessment:
    # Safety: explicitly do NOT read true_trigger or days_before_actual_action
    # at inference time — those are eval-only fields.
    fired: list[Evidence] = [e for e in (rule(snapshot) for rule in RULES) if e]

    strong = [e for e in fired if not any(m in e.signal for m in _WEAK_SIGNAL_MARKERS)]
    weak = [e for e in fired if any(m in e.signal for m in _WEAK_SIGNAL_MARKERS)]

    if not fired:
        return TriggerAssessment(
            account_id=snapshot.account_id,
            predicted_trigger=TriggerCategory.HEALTHY,
            confidence=0.95,
            evidence=[],
            conflicting_signals=False,
        )

    distinct_categories = {e.contributes_to for e in strong} or {e.contributes_to for e in weak}

    if len(strong) == 1 and not weak:
        # single clean strong signal -> high confidence
        return TriggerAssessment(
            account_id=snapshot.account_id,
            predicted_trigger=strong[0].contributes_to,
            confidence=0.9,
            evidence=strong,
            conflicting_signals=False,
        )

    if len(strong) >= 1 and len(distinct_categories) == 1:
        # multiple pieces of evidence, all pointing the same way
        return TriggerAssessment(
            account_id=snapshot.account_id,
            predicted_trigger=strong[0].contributes_to,
            confidence=0.85,
            evidence=strong + weak,
            conflicting_signals=False,
        )

    if len(distinct_categories) > 1 or (weak and not strong):
        # signals disagree, or only weak/borderline evidence exists -> don't
        # force a confident single-category call
        best_guess = max(
            distinct_categories,
            key=lambda cat: sum(1 for e in fired if e.contributes_to == cat),
        )
        return TriggerAssessment(
            account_id=snapshot.account_id,
            predicted_trigger=best_guess,
            confidence=0.45,
            evidence=fired,
            conflicting_signals=True,
        )

    return TriggerAssessment(
        account_id=snapshot.account_id,
        predicted_trigger=TriggerCategory.UNKNOWN,
        confidence=0.3,
        evidence=fired,
        conflicting_signals=True,
    )
