// src/components/Dashboard.jsx
import React from "react";
import DashboardLayout from "./DashboardLayout";
import "../styles/Dashboard.css";

function Dashboard() {
  return (
    <DashboardLayout initialActiveTab="Overview">
      <header className="dashboard-header">
        <h1>Dashboard</h1>
        <div className="search-bar-container">
          <input
            type="search"
            placeholder="Search transactions, customers, subscriptions"
            className="search-bar"
          />
        </div>
      </header>

      <section className="stats-overview">
        <div className="stat-card">
          Current MRR: <strong>$12.4k</strong>
        </div>
        <div className="stat-card">
          Current Customers: <strong>16,601</strong>
        </div>
        <div className="stat-card">
          Active Customers: <strong>33%</strong>
        </div>
        <div className="stat-card">
          Churn Rate: <strong>2%</strong>
        </div>
      </section>

      <section className="dashboard-widgets">
        <div className="chart">Trend Chart Placeholder</div>
        <div className="chart">Sales Chart Placeholder</div>
        <div className="transactions">
          Transactions List Placeholder
        </div>
        <div className="tickets">Support Tickets Placeholder</div>
        <div className="demographics">
          Customer Demographics Placeholder
        </div>
      </section>
    </DashboardLayout>
  );
}

export default Dashboard;
