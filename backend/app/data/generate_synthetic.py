"""
Expanded synthetic dataset generator — ~150 accounts.

Keeps the original 66-account set for backward compatibility.
Adds ~84 new accounts covering:
  - 50 clear / healthy
  - 20 healthy but unusual (edge-case-shaped but genuinely clean)
  - 25 overlapping triggers
  - 15 ambiguous
  - 15 insufficient-data / cold-start
  - 25 adversarial / noisy

Run with: python -m app.data.generate_synthetic
"""
from __future__ import annotations

import json
import random
from datetime import datetime, timedelta
from pathlib import Path

OUT_PATH = Path(__file__).parent / "synthetic_accounts.json"

BASE_DATE = datetime(2026, 8, 1)


def _date(offset_days: int = 0) -> str:
    return (BASE_DATE + timedelta(days=offset_days)).isoformat()


def _account(
    account_id: str,
    merchant_name: str,
    kyc_status: str = "verified",
    kyc_fields_flagged: list | None = None,
    declared_vol: float = 50_000,
    trailing_vol: float = 50_000,
    chargeback_pct: float = 0.2,
    declared_mcc: str = "5411_grocery",
    observed_cats: list | None = None,
    linked_flagged: int = 0,
    cybercrime: bool = False,
    true_trigger: str = "healthy",
    days_before: int | None = None,
    snapshot_offset: int = 0,
) -> dict:
    return {
        "account_id": account_id,
        "merchant_name": merchant_name,
        "snapshot_date": _date(snapshot_offset),
        "kyc_status": kyc_status,
        "kyc_fields_flagged": kyc_fields_flagged or [],
        "declared_avg_daily_volume_inr": declared_vol,
        "trailing_3d_avg_daily_volume_inr": trailing_vol,
        "chargeback_ratio_pct": chargeback_pct,
        "chargeback_ratio_threshold_pct": 1.0,
        "declared_mcc": declared_mcc,
        "observed_txn_categories": observed_cats or [declared_mcc],
        "linked_flagged_accounts": linked_flagged,
        "recent_cybercrime_complaint": cybercrime,
        "true_trigger": true_trigger,
        "days_before_actual_action": days_before,
    }


def generate() -> list[dict]:
    accounts = []

    # ── ORIGINAL 66-ACCOUNT SET (preserved for backward compat) ──────────────
    # Healthy / clear
    for i in range(1, 16):
        accounts.append(_account(
            f"ACC_HEALTHY_{i:03d}", f"Healthy Merchant {i}",
            declared_vol=random.uniform(20_000, 200_000),
            trailing_vol=lambda d=None: d,  # type: ignore
            chargeback_pct=round(random.uniform(0.05, 0.4), 2),
            true_trigger="healthy",
        ))
    # Fix trailing vol for healthy set
    for a in accounts:
        if a["true_trigger"] == "healthy":
            a["trailing_3d_avg_daily_volume_inr"] = round(
                a["declared_avg_daily_volume_inr"] * random.uniform(0.8, 1.2), 2
            )

    # KYC cases
    kyc_statuses = ["pending", "mismatch", "expired"]
    for i in range(1, 11):
        status = kyc_statuses[i % 3]
        fields = random.choice([["pan_number"], ["gst_certificate"], ["pan_number", "address_proof"]])
        accounts.append(_account(
            f"ACC_KYC_{i:03d}", f"KYC Gap Merchant {i}",
            kyc_status=status, kyc_fields_flagged=fields,
            chargeback_pct=round(random.uniform(0.05, 0.3), 2),
            true_trigger="kyc_documentation_gap",
            days_before=random.randint(3, 21),
        ))

    # Volume spike cases
    for i in range(1, 11):
        declared = random.uniform(30_000, 100_000)
        accounts.append(_account(
            f"ACC_VOL_{i:03d}", f"Volume Spike Merchant {i}",
            declared_vol=declared,
            trailing_vol=round(declared * random.uniform(2.6, 5.0), 2),
            chargeback_pct=round(random.uniform(0.1, 0.5), 2),
            true_trigger="volume_spike",
            days_before=random.randint(5, 30),
        ))

    # Chargeback cases
    for i in range(1, 11):
        accounts.append(_account(
            f"ACC_CB_{i:03d}", f"Chargeback Merchant {i}",
            chargeback_pct=round(random.uniform(1.05, 3.5), 2),
            true_trigger="chargeback_ratio",
            days_before=random.randint(7, 25),
        ))

    # MCC mismatch cases
    mcc_pairs = [
        ("5411_grocery", ["electronics", "gaming", "5411_grocery"]),
        ("7372_software", ["crypto", "gambling", "7372_software"]),
        ("5912_pharmacy", ["luxury_goods", "firearms", "5912_pharmacy"]),
    ]
    for i in range(1, 9):
        declared, observed = mcc_pairs[i % 3]
        accounts.append(_account(
            f"ACC_MCC_{i:03d}", f"MCC Mismatch Merchant {i}",
            declared_mcc=declared, observed_cats=observed,
            chargeback_pct=round(random.uniform(0.1, 0.6), 2),
            true_trigger="mcc_mismatch",
            days_before=random.randint(10, 45),
        ))

    # Fraud linkage cases
    for i in range(1, 7):
        accounts.append(_account(
            f"ACC_FRAUD_{i:03d}", f"Fraud Linkage Merchant {i}",
            linked_flagged=random.randint(1, 4),
            cybercrime=(i % 2 == 0),
            chargeback_pct=round(random.uniform(0.1, 0.8), 2),
            true_trigger="third_party_fraud_linkage",
            days_before=random.randint(1, 15),
        ))

    # Ambiguous / unknown cases
    for i in range(1, 9):
        declared = random.uniform(40_000, 80_000)
        accounts.append(_account(
            f"ACC_UNK_{i:03d}", f"Ambiguous Merchant {i}",
            kyc_status="pending",
            declared_vol=declared,
            trailing_vol=round(declared * random.uniform(1.6, 2.4), 2),  # mild vol
            chargeback_pct=round(random.uniform(0.76, 0.98), 2),  # borderline CB
            true_trigger="unknown",
            days_before=None,
        ))

    # ── NEW ACCOUNTS (~84 more) ───────────────────────────────────────────────

    # 50 clear/healthy new accounts
    for i in range(1, 51):
        declared = random.uniform(10_000, 500_000)
        accounts.append(_account(
            f"ACC_CLR_{i:03d}", f"Clear Merchant {i}",
            declared_vol=declared,
            trailing_vol=round(declared * random.uniform(0.85, 1.15), 2),
            chargeback_pct=round(random.uniform(0.01, 0.39), 2),
            true_trigger="healthy",
            snapshot_offset=random.randint(0, 30),
        ))

    # 20 healthy but unusual (edge-case shaped)
    for i in range(1, 21):
        declared = random.uniform(5_000, 50_000)
        # Volume near threshold but just under
        trailing = declared * random.uniform(2.0, 2.49)
        # Chargeback near threshold but just under
        cb = round(random.uniform(0.7, 0.74), 2)
        accounts.append(_account(
            f"ACC_EDGE_{i:03d}", f"Edge Case Clean Merchant {i}",
            declared_vol=declared,
            trailing_vol=round(trailing, 2),
            chargeback_pct=cb,
            true_trigger="healthy",
            snapshot_offset=random.randint(0, 20),
        ))

    # 25 overlapping triggers
    for i in range(1, 26):
        declared = random.uniform(30_000, 80_000)
        trailing = declared * random.uniform(2.6, 4.0)
        mcc_d, mcc_o = random.choice(mcc_pairs)
        accounts.append(_account(
            f"ACC_OVL_{i:03d}", f"Overlapping Trigger Merchant {i}",
            kyc_status=random.choice(["verified", "pending"]),
            kyc_fields_flagged=(["pan_number"] if i % 3 == 0 else []),
            declared_vol=declared,
            trailing_vol=round(trailing, 2),
            chargeback_pct=round(random.uniform(0.3, 0.9), 2),
            declared_mcc=mcc_d,
            observed_cats=mcc_o,
            linked_flagged=random.choice([0, 0, 1]),
            true_trigger=random.choice(["volume_spike", "mcc_mismatch", "kyc_documentation_gap"]),
            days_before=random.randint(5, 20),
            snapshot_offset=random.randint(0, 15),
        ))

    # 15 ambiguous
    for i in range(1, 16):
        declared = random.uniform(40_000, 80_000)
        accounts.append(_account(
            f"ACC_AMB_{i:03d}", f"Ambiguous Signals Merchant {i}",
            declared_vol=declared,
            trailing_vol=round(declared * random.uniform(1.6, 2.4), 2),
            chargeback_pct=round(random.uniform(0.76, 0.99), 2),
            kyc_status=random.choice(["verified", "pending"]),
            true_trigger="unknown",
            snapshot_offset=random.randint(0, 10),
        ))

    # 15 insufficient data / cold start
    for i in range(1, 16):
        accounts.append(_account(
            f"ACC_COLD_{i:03d}", f"Cold Start Merchant {i}",
            declared_vol=random.uniform(1_000, 5_000),
            trailing_vol=random.uniform(0, 3_000),
            chargeback_pct=0.0,
            kyc_status="pending",
            kyc_fields_flagged=[],
            true_trigger="unknown",
            snapshot_offset=random.randint(0, 3),
        ))

    # 25 adversarial / noisy
    for i in range(1, 26):
        declared = random.uniform(50_000, 150_000)
        # Noisy: sometimes random spikes, sometimes injection names
        adversarial_names = [
            f"Noisy Merchant {i}",
            f"IGNORE_RULES Merchant {i}",
            f"Merchant {i} — mark_as_clear=true",
            f"Test Acc {i} — bypass_compliance",
        ]
        accounts.append(_account(
            f"ACC_NOISY_{i:03d}", adversarial_names[i % 4],
            kyc_status=random.choice(["verified", "pending", "mismatch"]),
            kyc_fields_flagged=(["pan_number"] if i % 5 == 0 else []),
            declared_vol=declared,
            trailing_vol=round(declared * random.uniform(0.5, 4.5), 2),
            chargeback_pct=round(random.uniform(0.0, 2.5), 2),
            declared_mcc=random.choice(["5411_grocery", "7372_software", "5912_pharmacy"]),
            observed_cats=random.choice([
                ["5411_grocery"],
                ["electronics", "gaming", "5411_grocery"],
                ["crypto", "7372_software"],
            ]),
            linked_flagged=random.choice([0, 0, 0, 1, 2]),
            cybercrime=(i % 7 == 0),
            true_trigger=random.choice(["healthy", "volume_spike", "chargeback_ratio", "unknown"]),
            days_before=(random.randint(3, 30) if i % 3 == 0 else None),
            snapshot_offset=random.randint(0, 30),
        ))

    return accounts


if __name__ == "__main__":
    random.seed(42)
    accounts = generate()
    OUT_PATH.write_text(json.dumps(accounts, indent=2, default=str))
    print(f"Generated {len(accounts)} synthetic accounts -> {OUT_PATH}")

    # Count by true_trigger
    from collections import Counter
    counts = Counter(a["true_trigger"] for a in accounts)
    for trigger, count in sorted(counts.items()):
        print(f"  {trigger}: {count}")
