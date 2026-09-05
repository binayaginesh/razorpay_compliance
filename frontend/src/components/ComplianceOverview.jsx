import React from "react";
import { StatCard, DecisionBadge, TriggerBadge, ConfidenceBar } from "./Shared";
import { getMerchantDisplayName, getMerchantLocation, getMerchantCategory } from "../utils/merchantNames";

export default function ComplianceOverview({
  accounts,
  loading,
  onSelectMerchant,
  onViewAllMerchants,
}) {
  // Aggregate stats from accounts
  const stats = React.useMemo(() => {
    if (!accounts || accounts.length === 0) {
      return { total: 0, clear: 0, review: 0, conflicting: 0, insufficient: 0, triggers: {} };
    }

    let clear = 0;
    let review = 0;
    let conflicting = 0;
    let insufficient = 0;
    const triggers = {};

    accounts.forEach((acc) => {
      const d = acc.risk_badge?.decision || "clear";
      const t = acc.risk_badge?.trigger || "healthy";

      if (d === "clear") clear++;
      else if (d === "review_required") review++;
      else if (d === "conflicting_signals") conflicting++;
      else if (d === "insufficient_data") insufficient++;

      triggers[t] = (triggers[t] || 0) + 1;
    });

    return {
      total: accounts.length,
      clear,
      review,
      conflicting,
      insufficient,
      triggers,
    };
  }, [accounts]);

  // Priority Attention Queue: merchants that need immediate attention (review_required, conflicting_signals)
  const priorityQueue = React.useMemo(() => {
    if (!accounts) return [];
    return accounts
      .filter(
        (a) =>
          a.risk_badge?.decision === "review_required" ||
          a.risk_badge?.decision === "conflicting_signals" ||
          a.risk_badge?.decision === "insufficient_data"
      )
      .sort((a, b) => {
        // Sort review_required first, then conflicting_signals
        const order = { review_required: 1, conflicting_signals: 2, insufficient_data: 3, clear: 4 };
        const dA = order[a.risk_badge?.decision] || 99;
        const dB = order[b.risk_badge?.decision] || 99;
        if (dA !== dB) return dA - dB;
        return (b.risk_badge?.confidence || 0) - (a.risk_badge?.confidence || 0);
      })
      .slice(0, 8); // Top 8 priority merchants
  }, [accounts]);

  if (loading) {
    return (
      <div style={{ padding: "60px 0", textAlign: "center", color: "var(--text-muted)" }}>
        <div className="spinner" style={{ width: 32, height: 32, margin: "0 auto 16px" }} />
        <p>Loading compliance universe data...</p>
      </div>
    );
  }

  return (
    <div className="overview-page">
      {/* Page Header */}
      <div className="page-header-row">
        <div>
          <h1 className="page-title">Merchant Compliance Overview</h1>
          <p className="page-description">
            Continuous risk surveillance across {stats.total} merchants. AI investigation layer grounds deterministic alerts.
          </p>
        </div>
        <button className="btn btn-secondary" onClick={onViewAllMerchants}>
          <span>View All Directory ({stats.total})</span>
          <span>→</span>
        </button>
      </div>

      {/* KPI Metric Cards */}
      <div className="metrics-grid">
        <StatCard
          label="Monitored Merchants"
          value={stats.total}
          subtext="Active onboarded portfolio"
          icon="🏢"
          onClick={onViewAllMerchants}
        />
        <StatCard
          label="Review Required"
          value={stats.review}
          subtext={`${Math.round((stats.review / (stats.total || 1)) * 100)}% of portfolio flagged`}
          icon="⚠"
          type="urgent"
          onClick={onViewAllMerchants}
        />
        <StatCard
          label="Conflicting Signals"
          value={stats.conflicting}
          subtext="Ambiguous case signals"
          icon="⟷"
          type="warden"
          onClick={onViewAllMerchants}
        />
        <StatCard
          label="Insufficient Data"
          value={stats.insufficient}
          subtext="Documentation gaps"
          icon="?"
          onClick={onViewAllMerchants}
        />
        <StatCard
          label="Clear / Healthy"
          value={stats.clear}
          subtext="Passing all deterministic gates"
          icon="✓"
          onClick={onViewAllMerchants}
        />
      </div>

      {/* Priority Attention Queue */}
      <div className="fintech-card">
        <div className="card-header-bar">
          <div>
            <div className="card-heading">
              <span>⚡</span>
              <span>Priority Compliance Attention Queue</span>
            </div>
            <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 2 }}>
              Merchants with active alerts flagged for human compliance operator investigation
            </div>
          </div>
          <button className="btn btn-sm btn-secondary" onClick={onViewAllMerchants}>
            See All Alerts ({stats.review + stats.conflicting + stats.insufficient})
          </button>
        </div>

        <div className="table-responsive">
          <table className="rzp-table">
            <thead>
              <tr>
                <th>Merchant Business Name</th>
                <th>Location & Category</th>
                <th>Triggered Risk Signal</th>
                <th>Deterministic Gate</th>
                <th>Confidence</th>
                <th>Evidence Items</th>
                <th style={{ textAlign: "right" }}>Investigation</th>
              </tr>
            </thead>
            <tbody>
              {priorityQueue.map((acc) => {
                const displayName = getMerchantDisplayName(acc);
                const location = getMerchantLocation(acc);
                const category = getMerchantCategory(acc.risk_badge?.trigger);
                const isReview = acc.risk_badge?.decision === "review_required";

                return (
                  <tr
                    key={acc.account_id}
                    onClick={() => onSelectMerchant(acc)}
                    className={`priority-queue-table-row ${isReview ? "high-priority" : "conflict-priority"}`}
                  >
                    <td>
                      <div style={{ fontWeight: 600, color: "var(--text-main)" }}>
                        {displayName}
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          fontFamily: "var(--font-mono)",
                          color: "var(--text-muted)",
                        }}
                      >
                        {acc.account_id}
                      </div>
                    </td>
                    <td>
                      <div style={{ fontSize: 12.5, color: "var(--text-main)" }}>{category}</div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{location}</div>
                    </td>
                    <td>
                      <TriggerBadge trigger={acc.risk_badge?.trigger} />
                    </td>
                    <td>
                      <DecisionBadge decision={acc.risk_badge?.decision} />
                    </td>
                    <td>
                      <ConfidenceBar value={acc.risk_badge?.confidence} />
                    </td>
                    <td>
                      <span className="weight-tag">
                        {acc.risk_badge?.evidence_count || 0} signals
                      </span>
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <button
                        className="btn btn-sm btn-warden"
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectMerchant(acc);
                        }}
                      >
                        <span>Investigate</span>
                        <span>→</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Two Column Grid: Signals Breakdown & Warden Architecture Invariants */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 20 }}>
        {/* Risk Signal Distribution */}
        <div className="fintech-card" style={{ marginBottom: 0 }}>
          <div className="card-header-bar">
            <div className="card-heading">
              <span>📊</span>
              <span>Trigger Distribution Breakdown</span>
            </div>
          </div>
          <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {Object.entries(stats.triggers).map(([trig, count]) => {
              const pct = Math.round((count / (stats.total || 1)) * 100);
              return (
                <div key={trig} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5 }}>
                    <span style={{ fontWeight: 500 }}>
                      <TriggerBadge trigger={trig} />
                    </span>
                    <span style={{ fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>
                      {count} merchants ({pct}%)
                    </span>
                  </div>
                  <div
                    style={{
                      height: 6,
                      background: "#f1f5f9",
                      borderRadius: 999,
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: `${pct}%`,
                        background:
                          trig === "healthy"
                            ? "var(--green)"
                            : trig === "chargeback_ratio"
                            ? "var(--amber)"
                            : trig === "volume_spike"
                            ? "var(--orange)"
                            : "var(--purple)",
                        borderRadius: 999,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Warden Trust Authority & Safety Guarantees */}
        <div className="fintech-card" style={{ marginBottom: 0 }}>
          <div className="card-header-bar">
            <div className="card-heading">
              <span>🛡️</span>
              <span>Warden Architectural Invariants</span>
            </div>
            <span
              style={{
                fontSize: 11,
                padding: "2px 8px",
                background: "var(--green-bg)",
                color: "var(--green-text)",
                borderRadius: 999,
                fontWeight: 600,
              }}
            >
              Enforced
            </span>
          </div>
          <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "flex", gap: 10, fontSize: 12.5 }}>
              <span style={{ color: "var(--green)", fontWeight: "bold" }}>✓</span>
              <div>
                <strong>Deterministic Gate Authority:</strong> AI Investigator reasons over evidence, but the deterministic Decision Gate retains final authority over the outcome state.
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, fontSize: 12.5 }}>
              <span style={{ color: "var(--green)", fontWeight: "bold" }}>✓</span>
              <div>
                <strong>Zero Send / Action Authority:</strong> WARDEN is strictly an advisory investigation copilot. No autonomous merchant suspension or account lock authority is granted.
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, fontSize: 12.5 }}>
              <span style={{ color: "var(--green)", fontWeight: "bold" }}>✓</span>
              <div>
                <strong>Evidence Grounding Guarantee:</strong> Hypotheses and rationales reference only observed signals. No invented transaction values or KYC records.
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, fontSize: 12.5 }}>
              <span style={{ color: "var(--green)", fontWeight: "bold" }}>✓</span>
              <div>
                <strong>Append-Only Immutable Ledger:</strong> Every decision and investigation is hashed and logged to an immutable audit record.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
