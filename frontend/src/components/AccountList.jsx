import React, { useState } from "react";
import { DecisionBadge, TriggerBadge, Spinner } from "./Shared";

function getDecisionClass(d) {
  const m = { clear: "badge-clear", review_required: "badge-review", conflicting_signals: "badge-conflicting", insufficient_data: "badge-insufficient" };
  return m[d] || "badge-loading";
}

export default function AccountList({ accounts, loading, selected, onSelect }) {
  const [search, setSearch] = useState("");

  const filtered = accounts.filter(a =>
    a.merchant_name.toLowerCase().includes(search.toLowerCase()) ||
    a.account_id.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <span className="sidebar-title">Merchants</span>
        <span className="account-count">{accounts.length} accounts</span>
      </div>
      <div className="sidebar-search">
        <input
          className="search-input"
          placeholder="Search merchants..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <div className="account-list">
        {loading && (
          <div className="loading-row"><Spinner /> Loading accounts...</div>
        )}
        {!loading && filtered.length === 0 && (
          <div style={{ padding: 16, color: "var(--text-muted)", fontSize: 13, textAlign: "center" }}>
            No accounts found
          </div>
        )}
        {filtered.map(a => {
          const badge = a.risk_badge;
          const isActive = selected?.account_id === a.account_id;
          return (
            <div
              key={a.account_id}
              className={`account-item ${isActive ? "active" : ""}`}
              onClick={() => onSelect(a)}
            >
              <div className="account-item-name" title={a.merchant_name}>
                {a.merchant_name}
              </div>
              <div className="account-item-meta">
                {badge ? (
                  <>
                    <DecisionBadge decision={badge.decision} />
                    <TriggerBadge trigger={badge.trigger} />
                    {badge.evidence_count > 0 && (
                      <span className="badge badge-loading">
                        {badge.evidence_count} signal{badge.evidence_count !== 1 ? "s" : ""}
                      </span>
                    )}
                  </>
                ) : (
                  <span className="badge badge-loading">Loading...</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
