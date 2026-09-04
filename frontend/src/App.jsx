import React, { useState, useEffect, useCallback } from "react";
import "./index.css";
import { getAccounts, assessAccount, getHealth } from "./api";
import AccountList from "./components/AccountList";
import InvestigationView from "./components/InvestigationView";
import RedTeamPanel from "./components/RedTeamPanel";
import AuditTrail from "./components/AuditTrail";
import JudgeMode from "./components/JudgeMode";

const TABS = [
  { id: "investigate", label: "Investigate" },
  { id: "judge", label: "⚖ Judge Mode" },
  { id: "redteam", label: "🛡 Red Team" },
  { id: "audit", label: "📋 Audit Trail" },
];

export default function App() {
  const [tab, setTab] = useState("investigate");
  const [accounts, setAccounts] = useState([]);
  const [accountsLoading, setAccountsLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [investigationData, setInvestigationData] = useState(null);
  const [investigating, setInvestigating] = useState(false);
  const [aiOnline, setAiOnline] = useState(null);

  // Load accounts on mount
  useEffect(() => {
    loadAccounts();
    checkHealth();
  }, []);

  async function checkHealth() {
    try {
      const h = await getHealth();
      setAiOnline(h.ai_available);
    } catch { setAiOnline(false); }
  }

  async function loadAccounts() {
    setAccountsLoading(true);
    try {
      const data = await getAccounts();
      setAccounts(data);
    } catch (e) {
      console.error("Failed to load accounts:", e);
    } finally {
      setAccountsLoading(false);
    }
  }

  async function handleSelectAccount(account) {
    setSelected(account);
    setInvestigationData(null);
    setTab("investigate");
    await runInvestigation(account.account_id);
  }

  async function runInvestigation(accountId) {
    setInvestigating(true);
    try {
      const data = await assessAccount(accountId);
      setInvestigationData(data);
    } catch (e) {
      console.error("Investigation failed:", e);
    } finally {
      setInvestigating(false);
    }
  }

  return (
    <div className="app">
      {/* Topbar */}
      <div className="topbar">
        <div className="topbar-brand">
          <div className="shield">🛡</div>
          <span>WARDEN</span>
          <span style={{ color: "var(--text-muted)", fontWeight: 400, fontSize: 13 }}>
            Merchant Compliance Investigation Copilot
          </span>
        </div>

        <div className="topbar-tabs">
          {TABS.map(t => (
            <button
              key={t.id}
              className={`topbar-tab ${tab === t.id ? "active" : ""}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="row" style={{ gap: 10 }}>
          {aiOnline !== null && (
            <span style={{
              fontSize: 11,
              color: aiOnline ? "var(--green)" : "var(--yellow)",
              display: "flex", alignItems: "center", gap: 5
            }}>
              <span style={{
                width: 6, height: 6, borderRadius: "50%",
                background: aiOnline ? "var(--green)" : "var(--yellow)",
                display: "inline-block",
              }} />
              {aiOnline ? "AI Online" : "Deterministic Mode"}
            </span>
          )}
          <div className="status-dot" />
        </div>
      </div>

      <div className="main-content">
        {/* ── Investigate tab: sidebar + detail ── */}
        {tab === "investigate" && (
          <>
            <AccountList
              accounts={accounts}
              loading={accountsLoading}
              selected={selected}
              onSelect={handleSelectAccount}
            />
            <InvestigationView
              data={investigationData}
              loading={investigating}
              onAssess={() => selected && runInvestigation(selected.account_id)}
            />
          </>
        )}

        {tab === "judge" && <JudgeMode />}
        {tab === "redteam" && <RedTeamPanel />}
        {tab === "audit" && <AuditTrail />}
      </div>
    </div>
  );
}
