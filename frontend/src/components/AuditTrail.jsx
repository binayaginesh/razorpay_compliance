import React, { useState, useEffect } from "react";
import { getAuditTrail } from "../api";
import { DecisionBadge, TriggerBadge, CardSection, Spinner } from "./Shared";

export default function AuditTrail() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const data = await getAuditTrail();
      setRecords(data.reverse()); // newest first
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="full-page">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 6 }}>
            📋 Audit Trail
          </h2>
          <p style={{ color: "var(--text-secondary)", fontSize: 14 }}>
            Immutable, append-only log of every investigation. Every decision is traceable.
          </p>
        </div>
        <div className="row">
          <span className="badge badge-loading">{records.length} records</span>
          <button className="btn btn-ghost" onClick={load}>🔄 Refresh</button>
        </div>
      </div>

      {loading && (
        <div className="loading-row"><Spinner /> Loading audit records...</div>
      )}

      {error && (
        <div style={{ color: "var(--red)", fontSize: 13, padding: 16 }}>⚠ {error}</div>
      )}

      {!loading && records.length === 0 && (
        <div style={{ textAlign: "center", color: "var(--text-muted)", padding: 40 }}>
          No audit records yet. Run an investigation to see records here.
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {records.map(r => (
          <div key={r.record_id} className={`audit-item ${r.decision}`}>
            <div className="audit-meta">
              <DecisionBadge decision={r.decision} />
              <span className="audit-time">{new Date(r.timestamp).toLocaleString()}</span>
              <span className="font-mono text-xs text-muted">{r.account_id}</span>
              <span className="ml-auto font-mono text-xs text-muted">
                conf: {Math.round(r.confidence * 100)}%
              </span>
            </div>
            <div className="audit-rationale">{r.rationale}</div>
            {r.evidence?.length > 0 && (
              <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
                {r.evidence.map((e, i) => (
                  <span key={i} className="badge badge-loading text-xs">
                    {e.signal}: {e.observed_value}
                  </span>
                ))}
              </div>
            )}
            <div style={{ marginTop: 6, display: "flex", gap: 8 }}>
              <span className="text-xs font-mono text-muted">{r.record_id.slice(0, 8)}...</span>
              <span className="text-xs font-mono text-muted"># {r.assessment_hash.slice(0, 8)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
