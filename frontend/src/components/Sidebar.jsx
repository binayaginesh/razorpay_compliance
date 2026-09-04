import React from "react";
import { WardenCopilotChip } from "./Shared";

export default function Sidebar({ activeTab, onSelectTab, counts, aiOnline }) {
  return (
    <aside className="sidebar">
      {/* Header / Brand */}
      <div className="sidebar-header">
        <div className="rzp-logo-row">
          <div className="rzp-lightning">⚡</div>
          <div className="rzp-brand-text">
            <div className="rzp-brand-title">Razorpay</div>
            <div className="rzp-brand-subtitle">Merchant Operations</div>
          </div>
        </div>
        <WardenCopilotChip status={aiOnline ? "AI Active" : "Rules Active"} />
      </div>

      {/* Navigation Groups */}
      <div className="sidebar-nav">
        <div>
          <div className="nav-group-label">Compliance Operations</div>
          <div className="nav-items">
            <button
              className={`nav-item ${activeTab === "overview" ? "active" : ""}`}
              onClick={() => onSelectTab("overview")}
            >
              <span className="nav-icon">📊</span>
              <span>Overview</span>
            </button>

            <button
              className={`nav-item ${activeTab === "merchants" || activeTab === "detail" ? "active" : ""}`}
              onClick={() => onSelectTab("merchants")}
            >
              <span className="nav-icon">🏢</span>
              <span>All Merchants</span>
              {counts?.review > 0 && (
                <span className="nav-badge" title="Merchants requiring review">
                  {counts.review}
                </span>
              )}
            </button>

            <button
              className={`nav-item ${activeTab === "audit" ? "active" : ""}`}
              onClick={() => onSelectTab("audit")}
            >
              <span className="nav-icon">📋</span>
              <span>Audit Trail</span>
            </button>
          </div>
        </div>

        <div>
          <div className="nav-group-label">Warden Intelligence Lab</div>
          <div className="nav-items">
            <button
              className={`nav-item ${activeTab === "judge" ? "active" : ""}`}
              onClick={() => onSelectTab("judge")}
            >
              <span className="nav-icon">⚖️</span>
              <span>Judge Mode</span>
            </button>

            <button
              className={`nav-item ${activeTab === "redteam" ? "active" : ""}`}
              onClick={() => onSelectTab("redteam")}
            >
              <span className="nav-icon">🛡️</span>
              <span>Red Team Suite</span>
            </button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="sidebar-footer">
        <div className="ai-engine-status">
          <span>Engine Status</span>
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span
              className={`status-indicator-dot ${aiOnline ? "" : "warning"}`}
            />
            <strong style={{ color: "#fff", fontSize: 11 }}>
              {aiOnline ? "Gemini AI Online" : "Deterministic"}
            </strong>
          </span>
        </div>
        <div style={{ fontSize: 10.5, color: "#64748b" }}>
          Razorpay Compliance v2.0
        </div>
      </div>
    </aside>
  );
}
