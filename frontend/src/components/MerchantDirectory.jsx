import React, { useState, useMemo } from "react";
import { DecisionBadge, TriggerBadge, ConfidenceBar } from "./Shared";
import { getMerchantDisplayName, getMerchantLocation, getMerchantCategory } from "../utils/merchantNames";

export default function MerchantDirectory({
  accounts,
  loading,
  onSelectMerchant,
  searchTerm,
  onSearchChange,
}) {
  const [decisionFilter, setDecisionFilter] = useState("all");
  const [triggerFilter, setTriggerFilter] = useState("all");
  const [sortBy, setSortBy] = useState("priority");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 15;

  // Filter accounts
  const filtered = useMemo(() => {
    if (!accounts) return [];

    return accounts.filter((acc) => {
      // Search
      if (searchTerm) {
        const query = searchTerm.toLowerCase();
        const dispName = getMerchantDisplayName(acc).toLowerCase();
        const accId = (acc.account_id || "").toLowerCase();
        const trig = (acc.risk_badge?.trigger || "").toLowerCase();
        if (!dispName.includes(query) && !accId.includes(query) && !trig.includes(query)) {
          return false;
        }
      }

      // Decision filter
      if (decisionFilter !== "all") {
        if (acc.risk_badge?.decision !== decisionFilter) return false;
      }

      // Trigger filter
      if (triggerFilter !== "all") {
        if (acc.risk_badge?.trigger !== triggerFilter) return false;
      }

      return true;
    });
  }, [accounts, searchTerm, decisionFilter, triggerFilter]);

  // Sort filtered accounts
  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      if (sortBy === "priority") {
        const order = { review_required: 1, conflicting_signals: 2, insufficient_data: 3, clear: 4 };
        const dA = order[a.risk_badge?.decision] || 99;
        const dB = order[b.risk_badge?.decision] || 99;
        if (dA !== dB) return dA - dB;
        return (b.risk_badge?.confidence || 0) - (a.risk_badge?.confidence || 0);
      }
      if (sortBy === "confidence") {
        return (b.risk_badge?.confidence || 0) - (a.risk_badge?.confidence || 0);
      }
      if (sortBy === "evidence") {
        return (b.risk_badge?.evidence_count || 0) - (a.risk_badge?.evidence_count || 0);
      }
      if (sortBy === "name") {
        return getMerchantDisplayName(a).localeCompare(getMerchantDisplayName(b));
      }
      return 0;
    });
  }, [filtered, sortBy]);

  // Pagination
  const totalPages = Math.ceil(sorted.length / pageSize) || 1;
  const paginated = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sorted.slice(start, start + pageSize);
  }, [sorted, currentPage, pageSize]);

  return (
    <div className="merchant-directory-page">
      {/* Header */}
      <div className="page-header-row">
        <div>
          <h1 className="page-title">Merchant Directory</h1>
          <p className="page-description">
            Complete registry of {accounts?.length || 0} onboarded accounts with proactive compliance risk gating.
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div
        className="fintech-card"
        style={{
          marginBottom: 16,
          padding: 16,
          display: "flex",
          flexWrap: "wrap",
          gap: 12,
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", flex: 1 }}>
          {/* Search */}
          <div className="search-bar-input" style={{ width: 280 }}>
            <span>🔍</span>
            <input
              type="text"
              placeholder="Search by business name or ID..."
              value={searchTerm}
              onChange={(e) => {
                onSearchChange(e.target.value);
                setCurrentPage(1);
              }}
            />
            {searchTerm && (
              <button
                onClick={() => onSearchChange("")}
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}
              >
                ✕
              </button>
            )}
          </div>

          {/* Decision Filter */}
          <select
            className="select-filter"
            value={decisionFilter}
            onChange={(e) => {
              setDecisionFilter(e.target.value);
              setCurrentPage(1);
            }}
          >
            <option value="all">All Decision States</option>
            <option value="review_required">⚠ Review Required</option>
            <option value="conflicting_signals">⟷ Conflicting Signals</option>
            <option value="insufficient_data">? Insufficient Data</option>
            <option value="clear">✓ Clear</option>
          </select>

          {/* Trigger Filter */}
          <select
            className="select-filter"
            value={triggerFilter}
            onChange={(e) => {
              setTriggerFilter(e.target.value);
              setCurrentPage(1);
            }}
          >
            <option value="all">All Triggers</option>
            <option value="chargeback_ratio">Chargeback Ratio</option>
            <option value="volume_spike">Volume Spike</option>
            <option value="kyc_documentation_gap">KYC Documentation Gap</option>
            <option value="mcc_mismatch">MCC Mismatch</option>
            <option value="third_party_fraud_linkage">Fraud Linkage</option>
            <option value="healthy">Healthy (No Trigger)</option>
          </select>
        </div>

        {/* Sort */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 12.5, color: "var(--text-muted)", fontWeight: 500 }}>Sort by:</span>
          <select
            className="select-filter"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
          >
            <option value="priority">Priority Alert</option>
            <option value="confidence">Highest Confidence</option>
            <option value="evidence">Most Evidence Signals</option>
            <option value="name">Merchant Name (A-Z)</option>
          </select>
        </div>
      </div>

      {/* Directory Table */}
      <div className="fintech-card">
        <div className="table-responsive">
          <table className="rzp-table">
            <thead>
              <tr>
                <th>Merchant Business Name</th>
                <th>Category & City</th>
                <th>Triggered Risk Signal</th>
                <th>Deterministic Decision</th>
                <th>Confidence</th>
                <th>Evidence Count</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: "40px 0" }}>
                    <div className="spinner" style={{ width: 24, height: 24, margin: "0 auto 8px" }} />
                    <p style={{ color: "var(--text-muted)" }}>Loading merchant directory...</p>
                  </td>
                </tr>
              ) : paginated.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", padding: "40px 0", color: "var(--text-muted)" }}>
                    No merchants matching your search criteria.
                  </td>
                </tr>
              ) : (
                paginated.map((acc) => {
                  const displayName = getMerchantDisplayName(acc);
                  const location = getMerchantLocation(acc);
                  const category = getMerchantCategory(acc.risk_badge?.trigger);

                  return (
                    <tr key={acc.account_id} onClick={() => onSelectMerchant(acc)}>
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
                          className="btn btn-sm btn-secondary"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectMerchant(acc);
                          }}
                        >
                          <span>View Detail</span>
                          <span>→</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 20px",
            borderTop: "1px solid var(--border-light)",
            fontSize: 12.5,
            color: "var(--text-muted)",
          }}
        >
          <div>
            Showing {(currentPage - 1) * pageSize + 1} to{" "}
            {Math.min(currentPage * pageSize, sorted.length)} of {sorted.length} merchants
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              className="btn btn-sm btn-secondary"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
            >
              Previous
            </button>
            <span style={{ display: "flex", alignItems: "center", padding: "0 8px" }}>
              Page {currentPage} of {totalPages}
            </span>
            <button
              className="btn btn-sm btn-secondary"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
