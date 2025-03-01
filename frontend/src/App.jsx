import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import LoginPage from "./components/LoginPage";
import Dashboard from "./components/Dashboard";
import Doctor from "./components/Doctor";
import DoctorProfile from "./components/DoctorProfile";
import Tasks from "./components/Tasks";
import Patient from "./components/Patient";
import PatientProfile from "./components/PatientProfile";
import Applications from "./components/Applications";
import EditApplication from "./components/EditApplication"; 
import Whatsapp from "./components/Whatsapp";// Import PatientProfile
import Telegram from "./components/Telegram";
import Calls from "./components/Calls";

const App = () => {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LoginPage />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/doctor" element={<Doctor />} />
        <Route path="/doctor/:slug" element={<DoctorProfile />} />
        <Route path="/tasks" element={<Tasks />} />
        <Route path="/patients" element={<Patient />} /> 
        <Route path="/patient/:id" element={<PatientProfile />} />
        <Route path="/applications" element={<Applications />} />
        <Route path="applications/edit/:id" element={<EditApplication />} />
        <Route path="/whatsapp" element={<Whatsapp />} />
        <Route path="/telegram" element={<Telegram />} />
        <Route path="/calls" element={<Calls />} />
      </Routes>
    </Router>
  );
};

export default App;