import React, { useState, useEffect } from "react";
import { useLocation } from "react-router-dom";
import "./DashboardTabs.css";

const tabs = [
  { id: "tab1", label: "Tab 1", url: "https://dashboard.c4gt.samagra.io/public/dashboard/bc251c85-05d5-45a3-b21f-bd639151837f", pageTitle: "Community Dashboard - May 2025", },
  { id: "tab2", label: "Tab 2", url: "https://dashboard.c4gt.samagra.io/public/dashboard/80a3da06-7913-4d1c-b801-751c1bb83eef", pageTitle: "C4GT Community Dashboard", },
  { id: "tab3", label: "Tab 3", url: "https://dashboard.c4gt.samagra.io/public/dashboard/7666af71-2283-4d7c-8a55-f7ebc031e670", pageTitle: "Augtoberfest Leaderboard", },
];

function DashboardTabs() {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const tabFromQuery = searchParams.get("tab");

  const [activeTab, setActiveTab] = useState(tabFromQuery || tabs[0].id);

  const currentTab = tabs.find((t) => t.id === activeTab) || tabs[0];
  useEffect(() => {
    document.title = currentTab.pageTitle;
  }, [currentTab.pageTitle]);

  // Update activeTab whenever query param changes
  useEffect(() => {
    if (tabFromQuery && tabs.find((t) => t.id === tabFromQuery)) {
      setActiveTab(tabFromQuery);
    }
  }, [tabFromQuery]);

  return (
    <div className="dashboard-tabs">

      {/* Iframe Content */}
      <div className="tab-content">
        {tabs.map(
          (tab) =>
            activeTab === tab.id && (
              <iframe
                key={tab.id}
                src={tab.url}
                title={tab.label}
                className="tab-iframe"
              />
            )
        )}
      </div>
    </div>
  );
}

export default DashboardTabs;
