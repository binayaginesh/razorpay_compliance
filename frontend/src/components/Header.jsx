import React from "react";

export default function Header({
  activeTab,
  selectedMerchant,
  merchantName,
  onNavigateBack,
  searchTerm,
  onSearchChange,
  aiOnline,
}) {
  return (
    <header className="top-header">
      {/* Breadcrumb / Title */}
      <div className="header-left">
        <div className="header-breadcrumb">
          <span>Razorpay Ops</span>
          <span>/</span>
          {activeTab === "overview" && (
            <span className="active-crumb">Compliance Overview</span>
          )}
          {activeTab === "merchants" && (
            <span className="active-crumb">Merchant Directory</span>
          )}
          {activeTab === "detail" && (
            <>
              <button
                onClick={onNavigateBack}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--rzp-blue)",
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: 500,
                  padding: 0,
                }}
              >
                Merchants
              </button>
              <span>/</span>
              <span className="active-crumb">{merchantName || selectedMerchant?.account_id}</span>
            </>
          )}
          {activeTab === "audit" && (
            <span className="active-crumb">Audit Trail & Immutable Ledger</span>
          )}
          {activeTab === "judge" && (
            <span className="active-crumb">Warden Judge Benchmark</span>
          )}
          {activeTab === "redteam" && (
            <span className="active-crumb">Adversarial Red Team Suite</span>
          )}
        </div>
      </div>

      {/* Right Controls */}
      <div className="header-right">
        {activeTab !== "detail" && (
          <div className="search-bar-input" style={{ width: 240 }}>
            <span>🔍</span>
            <input
              type="text"
              placeholder="Search merchant or ID..."
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
            />
          </div>
        )}

        <div className="env-pill">
          <span style={{ color: "var(--green)", marginRight: 5 }}>●</span>
          Live Monitoring
        </div>

        <div
          style={{
            fontSize: 11.5,
            padding: "4px 8px",
            borderRadius: 4,
            background: aiOnline ? "var(--green-bg)" : "var(--amber-bg)",
            color: aiOnline ? "var(--green-text)" : "var(--amber-text)",
            border: `1px solid ${aiOnline ? "var(--green-border)" : "var(--amber-border)"}`,
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            gap: 5,
          }}
        >
          <span>{aiOnline ? "AI Copilot" : "Deterministic Engine"}</span>
        </div>
      </div>
    </header>
  );
}
