import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import logo from "../assets/HD.png";
import {
  FaChartPie,
  FaCalendarAlt,
  FaWhatsapp,
  FaTelegram,
  FaProcedures,
  FaUserMd,
  FaPhone,
  FaFileAlt,
  FaBars,
} from "react-icons/fa";
import "../styles/DashboardLayout.css";
import "../styles/Dashboard.css";

function DashboardLayout({ children, initialActiveTab = "Overview" }) {
  const navigate = useNavigate();
  const location = useLocation();
  // Initialize state from localStorage, default to false if not set
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    const savedState = localStorage.getItem("sidebarCollapsed");
    return savedState ? JSON.parse(savedState) : false;
  });
  const [activeTab, setActiveTab] = useState(initialActiveTab);

  // Save to localStorage whenever isSidebarCollapsed changes
  useEffect(() => {
    localStorage.setItem("sidebarCollapsed", JSON.stringify(isSidebarCollapsed));
    console.log("Saved to localStorage - isSidebarCollapsed:", isSidebarCollapsed);
  }, [isSidebarCollapsed]);

  // Update activeTab based on path
  useEffect(() => {
    const pathToTab = {
      "/tasks": "Tasks",
      "/applications": "HD Applications",
      "/patients": "Patient",
      "/doctor": "Doctor",
      "/whatsapp": "WhatsApp",
      "/telegram": "Telegram",
      "/calls": "Calls",
    };
    const currentPath = location.pathname;
    const newActiveTab = pathToTab[currentPath] || initialActiveTab;
    setActiveTab(newActiveTab);
    console.log("useEffect ran - Path:", currentPath, "ActiveTab:", newActiveTab);
  }, [location.pathname, initialActiveTab]);

  const handleLogout = () => {
    localStorage.removeItem("authToken");
    navigate("/");
  };

  const handleNavClick = (tab, path) => {
    console.log("Before click - isSidebarCollapsed:", isSidebarCollapsed);
    setActiveTab(tab);
    navigate(path);
    if (!isSidebarCollapsed) {
      setIsSidebarCollapsed(true);
      console.log("After collapse - isSidebarCollapsed:", true);
    }
  };

  const toggleSidebar = () => {
    setIsSidebarCollapsed((prev) => {
      console.log("Toggle sidebar - new state:", !prev);
      return !prev;
    });
  };

  const menuItems = [
    { tab: "Tasks", path: "/tasks", icon: <FaCalendarAlt /> },
    { tab: "HD Applications", path: "/applications", icon: <FaFileAlt /> },
    { tab: "Patient", path: "/patients", icon: <FaProcedures /> },
    { tab: "Doctor", path: "/doctor", icon: <FaUserMd /> },
    { tab: "WhatsApp", path: "/whatsapp", icon: <FaWhatsapp /> },
    { tab: "Telegram", path: "/telegram", icon: <FaTelegram /> },
    { tab: "Calls", path: "/calls", icon: <FaPhone /> },
  ];

  console.log("Render - isSidebarCollapsed:", isSidebarCollapsed);

  return (
    <div className="dashboard-container">
      <aside className={`sidebar ${isSidebarCollapsed ? "collapsed" : ""}`}>
        <div className="sidebar-header">
          <button
            className="toggle-btn"
            onClick={toggleSidebar}
            aria-label={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <FaBars className="toggle-icon" />
          </button>
          <div className="logo-box">
            <img src={logo} alt="Health+Direct Logo" className="sidebar-logo" />
          </div>
        </div>
        <ul className="sidebar-menu">
          {menuItems.map((item) => (
            <li
              key={item.tab}
              className={activeTab === item.tab ? "active" : ""}
              onClick={() => handleNavClick(item.tab, item.path)}
              aria-label={`Navigate to ${item.tab}`}
            >
              {isSidebarCollapsed ? (
                <span className="sidebar-icon">{item.icon}</span>
              ) : (
                <>
                  <span className="sidebar-icon">{item.icon}</span>
                  <span className="sidebar-text">{item.tab}</span>
                </>
              )}
            </li>
          ))}
        </ul>
        <div className="logout">
          <button onClick={handleLogout} aria-label="Log out">
            Log out
          </button>
        </div>
      </aside>
      <main className={`main-content ${isSidebarCollapsed ? "expanded" : ""}`}>
        {children}
      </main>
    </div>
  );
}

export default DashboardLayout;