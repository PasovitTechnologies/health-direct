import React from "react";
import DashboardLayout from "./DashboardLayout";
import "../styles/UnderConstruction.css"; // New CSS file for styling

function Calls() {
  return (
    <DashboardLayout initialActiveTab="Calls">
      <div className="under-construction">
        <p className="construction-message">Under Construction come back soon 👷‍♂️</p>
      </div>
    </DashboardLayout>
  );
}

export default Calls;