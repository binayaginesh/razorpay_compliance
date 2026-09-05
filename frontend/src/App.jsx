import React, { useState, useEffect, useCallback, useMemo } from "react";
import "./index.css";
import { getAccounts, assessAccount, getHealth } from "./api";
import Sidebar from "./components/Sidebar";
import Header from "./components/Header";
import ComplianceOverview from "./components/ComplianceOverview";
import MerchantDirectory from "./components/MerchantDirectory";
import MerchantDetail from "./components/MerchantDetail";
import AuditTrail from "./components/AuditTrail";
import JudgeMode from "./components/JudgeMode";
import RedTeamPanel from "./components/RedTeamPanel";
import LiveFreezeDemo from "./components/LiveFreezeDemo";
import { getMerchantDisplayName } from "./utils/merchantNames";

export default function App() {
  const [tab, setTab] = useState("overview");
  const [accounts, setAccounts] = useState([]);
  const [accountsLoading, setAccountsLoading] = useState(true);
  const [selectedMerchant, setSelectedMerchant] = useState(null);
  const [investigationData, setInvestigationData] = useState(null);
  const [investigating, setInvestigating] = useState(false);
  const [aiOnline, setAiOnline] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [auditFilterId, setAuditFilterId] = useState(null);

  // Load accounts and health on mount
  useEffect(() => {
    loadAccounts();
    checkHealth();
  }, []);

  async function checkHealth() {
    try {
      const h = await getHealth();
      setAiOnline(h.ai_available);
    } catch {
      setAiOnline(false);
    }
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

  // Count calculations for sidebar badges
  const counts = useMemo(() => {
    if (!accounts) return { review: 0, conflicting: 0 };
    let review = 0;
    let conflicting = 0;
    accounts.forEach((a) => {
      if (a.risk_badge?.decision === "review_required") review++;
      if (a.risk_badge?.decision === "conflicting_signals") conflicting++;
    });
    return { review, conflicting };
  }, [accounts]);

  // When user selects a merchant to inspect/investigate
  async function handleSelectMerchant(account, autoAssess = true) {
    setSelectedMerchant(account);
    setInvestigationData(null);
    setTab("detail");

    if (autoAssess) {
      await runInvestigation(account.account_id);
    }
  }

  // Run or re-run investigation
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

  // Jump from investigation resolution plan directly to Audit Trail record
  function handleViewAuditRecord(recordId) {
    setAuditFilterId(recordId);
    setTab("audit");
  }

  return (
    <div className="app-container">
      {/* Left Navigation Sidebar */}
      <Sidebar
        activeTab={tab}
        onSelectTab={(newTab) => {
          setTab(newTab);
          if (newTab !== "detail") {
            // Keep selected merchant in memory, but clear audit filter if leaving audit
            if (newTab !== "audit") setAuditFilterId(null);
          }
        }}
        counts={counts}
        aiOnline={aiOnline}
      />

      {/* Main Content Area */}
      <div className="main-area">
        {/* Top Header */}
        <Header
          activeTab={tab}
          selectedMerchant={selectedMerchant}
          merchantName={selectedMerchant ? getMerchantDisplayName(selectedMerchant) : ""}
          onNavigateBack={() => setTab("merchants")}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          aiOnline={aiOnline}
        />

        {/* Scrollable Page Views */}
        <main className="content-scrollable">
          {tab === "overview" && (
            <ComplianceOverview
              accounts={accounts}
              loading={accountsLoading}
              onSelectMerchant={(acc) => handleSelectMerchant(acc, true)}
              onViewAllMerchants={() => setTab("merchants")}
            />
          )}

          {tab === "merchants" && (
            <MerchantDirectory
              accounts={accounts}
              loading={accountsLoading}
              onSelectMerchant={(acc) => handleSelectMerchant(acc, true)}
              searchTerm={searchTerm}
              onSearchChange={setSearchTerm}
            />
          )}

          {tab === "detail" && (
            <MerchantDetail
              account={selectedMerchant}
              investigationData={investigationData}
              investigating={investigating}
              onRunInvestigation={runInvestigation}
              onBack={() => setTab("merchants")}
              onViewAuditRecord={handleViewAuditRecord}
            />
          )}

          {tab === "audit" && (
            <AuditTrail
              initialFilterId={auditFilterId}
              onSelectMerchant={(accId) => {
                const found = accounts.find((a) => a.account_id === accId);
                if (found) handleSelectMerchant(found, true);
              }}
            />
          )}

          {tab === "judge" && <JudgeMode />}

          {tab === "redteam" && <RedTeamPanel />}

          {tab === "freeze_demo" && <LiveFreezeDemo />}
        </main>
      </div>
    </div>
  );
}
