import React, { useState, useEffect } from "react";
import { getAuditTrail } from "../api";
import { DecisionBadge, Spinner } from "./Shared";
import { getMerchantDisplayName } from "../utils/merchantNames";

export default function AuditTrail({ initialFilterId = null, onSelectMerchant = null }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState(initialFilterId || "");
  const [selectedRecord, setSelectedRecord] = useState(null);

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (initialFilterId) {
      setSearch(initialFilterId);
    }
  }, [initialFilterId]);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await getAuditTrail();
      setRecords(data.reverse()); // newest first
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  const filtered = records.filter((r) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (r.account_id || "").toLowerCase().includes(q) ||
      (r.record_id || "").toLowerCase().includes(q) ||
      (r.decision || "").toLowerCase().includes(q) ||
      (r.assessment_hash || "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="audit-trail-page">
      {/* Header */}
      <div className="page-header-row">
        <div>
          <h1 className="page-title">Compliance Audit Trail & Immutable Ledger</h1>
          <p className="page-description">
            Cryptographically hashed, append-only ledger of every assessment and investigation.
          </p>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn btn-secondary" onClick={load} disabled={loading}>
            {loading ? <Spinner size={12} /> : "🔄 Refresh Ledger"}
          </button>
        </div>
      </div>

      {/* Filter Row */}
      <div
        className="fintech-card"
        style={{
          padding: 16,
          marginBottom: 16,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div className="search-bar-input" style={{ width: 320 }}>
          <span>🔍</span>
          <input
            type="text"
            placeholder="Search by Record ID, Account ID, or Decision..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}
            >
              ✕
            </button>
          )}
        </div>

        <div style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
          Showing <strong>{filtered.length}</strong> of {records.length} immutable records
        </div>
      </div>

      {error && (
        <div
          style={{
            background: "var(--red-bg)",
            color: "var(--red-text)",
            border: "1px solid var(--red-border)",
            padding: 14,
            borderRadius: 8,
            marginBottom: 16,
            fontSize: 13,
          }}
        >
          ⚠ Failed to load audit trail: {error}
        </div>
      )}

      {/* Ledger Table */}
      <div className="fintech-card">
        <div className="table-responsive">
          <table className="rzp-table">
            <thead>
              <tr>
                <th>Timestamp & Record ID</th>
                <th>Merchant Account</th>
                <th>Decision Outcome</th>
                <th>Gate Confidence</th>
                <th>Assessment Hash</th>
                <th>Evidence Items</th>
                <th style={{ textAlign: "right" }}>Inspection</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: "40px 0" }}>
                    <Spinner size={24} />
                    <p style={{ color: "var(--text-muted)", marginTop: 8 }}>Loading ledger records...</p>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: "40px 0", color: "var(--text-muted)" }}>
                    {search ? "No records matched your search query." : "No audit entries recorded yet."}
                  </td>
                </tr>
              ) : (
                filtered.map((r) => {
                  const merchantName = getMerchantDisplayName({ account_id: r.account_id });

                  return (
                    <tr key={r.record_id} onClick={() => setSelectedRecord(r)}>
                      <td>
                        <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-main)" }}>
                          {new Date(r.timestamp).toLocaleString()}
                        </div>
                        <div style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>
                          {r.record_id}
                        </div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, color: "var(--text-main)" }}>
                          {merchantName}
                        </div>
                        <div style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>
                          {r.account_id}
                        </div>
                      </td>
                      <td>
                        <DecisionBadge decision={r.decision} />
                      </td>
                      <td>
                        <span style={{ fontFamily: "var(--font-mono)", fontWeight: 600 }}>
                          {Math.round((r.confidence || 0) * 100)}%
                        </span>
                      </td>
                      <td>
                        <span
                          className="weight-tag"
                          title={r.assessment_hash}
                          style={{ fontFamily: "var(--font-mono)" }}
                        >
                          #{r.assessment_hash ? r.assessment_hash.slice(0, 10) : "n/a"}...
                        </span>
                      </td>
                      <td>
                        <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                          {r.evidence?.length || 0} signals
                        </span>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <button
                          className="btn btn-sm btn-secondary"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedRecord(r);
                          }}
                        >
                          Inspect JSON
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Selected Record Inspection Modal / Drawer */}
      {selectedRecord && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(15, 23, 42, 0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
            padding: 20,
          }}
          onClick={() => setSelectedRecord(null)}
        >
          <div
            className="fintech-card"
            style={{
              width: "100%",
              maxWidth: 700,
              maxHeight: "85vh",
              display: "flex",
              flexDirection: "column",
              boxShadow: "var(--shadow-lg)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="card-header-bar">
              <div className="card-heading">
                <span>🔒</span>
                <span>Immutable Audit Record Details</span>
              </div>
              <button
                className="btn btn-sm btn-secondary"
                onClick={() => setSelectedRecord(null)}
              >
                ✕ Close
              </button>
            </div>
            <div className="card-body" style={{ overflowY: "auto", display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, fontSize: 13 }}>
                <div>
                  <span style={{ color: "var(--text-muted)" }}>Record ID:</span>
                  <div style={{ fontFamily: "var(--font-mono)", fontWeight: 600 }}>
                    {selectedRecord.record_id}
                  </div>
                </div>
                <div>
                  <span style={{ color: "var(--text-muted)" }}>Merchant ID:</span>
                  <div style={{ fontFamily: "var(--font-mono)", fontWeight: 600 }}>
                    {selectedRecord.account_id}
                  </div>
                </div>
                <div>
                  <span style={{ color: "var(--text-muted)" }}>Decision State:</span>
                  <div>
                    <DecisionBadge decision={selectedRecord.decision} />
                  </div>
                </div>
                <div>
                  <span style={{ color: "var(--text-muted)" }}>Integrity Hash:</span>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, wordBreak: "break-all" }}>
                    {selectedRecord.assessment_hash}
                  </div>
                </div>
              </div>

              <div>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-main)" }}>
                  Decision Rationale:
                </span>
                <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4 }}>
                  {selectedRecord.rationale}
                </p>
              </div>

              <div>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-main)" }}>
                  Raw Serialized Record Payload:
                </span>
                <div className="draft-box" style={{ marginTop: 6, maxHeight: 260, overflowY: "auto" }}>
                  {JSON.stringify(selectedRecord, null, 2)}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
