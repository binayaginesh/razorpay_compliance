"""
Append-only audit trail store.

Deliberately JSON-lines on disk rather than a database: for a 5-day
buildathon demo, a human (or a judge) should be able to `tail -f` this file
and watch the reasoning happen in real time, with zero setup. Swapping this
for Postgres later is a one-file change (see docs/ARCHITECTURE.md).
"""
from __future__ import annotations

import json
from pathlib import Path

from app.models import AuditRecord

_AUDIT_LOG_PATH = Path(__file__).parent / "audit_log.jsonl"


def write(record: AuditRecord) -> None:
    with _AUDIT_LOG_PATH.open("a") as f:
        f.write(record.model_dump_json() + "\n")


def read_all() -> list[AuditRecord]:
    if not _AUDIT_LOG_PATH.exists():
        return []
    records = []
    with _AUDIT_LOG_PATH.open() as f:
        for line in f:
            line = line.strip()
            if line:
                records.append(AuditRecord.model_validate_json(line))
    return records


def read_for_account(account_id: str) -> list[AuditRecord]:
    return [r for r in read_all() if r.account_id == account_id]


def find_by_hash(account_id: str, assessment_hash: str) -> AuditRecord | None:
    """
    Idempotency lookup: has this exact conclusion already been recorded for
    this account? Used by the decision gate to avoid writing a duplicate
    audit entry when the same assessment is triggered twice (a re-click, a
    retried API call, a replayed event).
    """
    for record in read_all():
        if record.account_id == account_id and record.assessment_hash == assessment_hash:
            return record
    return None


def clear() -> None:
    _AUDIT_LOG_PATH.write_text("")
