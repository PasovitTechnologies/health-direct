import React, { useState, useEffect } from "react";
import axios from "axios";
import "../styles/AddApplicationPopup.css";
import { FaTimes } from "react-icons/fa";
import { io } from "socket.io-client"; // Import socket.io-client

const socket = io(BASE_URL); // Connect to backend WebSocket

function AddApplicationPopup({ onClose, onAdd }) {
  const [patients, setPatients] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [formData, setFormData] = useState({
    patient: "",
    serviceType: "Consultation",
    doctor: "",
    appointmentMode: "Online",
    appointmentStatus: "New",
    meetingLink: "",
    recordDate: "",
    paymentStatus: "new",
    comments: "",
    previousComments: [], // Initialize as empty array of Comment _ids, backend will handle
  });

  useEffect(() => {
    fetchPatients();
    fetchDoctors();
  }, []);

  const fetchPatients = async () => {
    try {
      const response = await axios.get("${BASE_URL}/api/patients"); // Remove .populate(), rely on backend
      setPatients(response.data);
    } catch (error) {
      console.error("Error fetching patients:", error);
    }
  };

  const fetchDoctors = async () => {
    try {
      const response = await axios.get("${BASE_URL}/api/doctors"); // Remove .populate(), rely on backend
      setDoctors(response.data);
    } catch (error) {
      console.error("Error fetching doctors:", error);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (name === "doctor") {
      fetchDoctorSpecialty(value);
    }
  };

  const fetchDoctorSpecialty = async (doctorId) => {
    try {
      const response = await axios.get(`${BASE_URL}/api/doctors/${doctorId}`);
      setFormData((prev) => ({
        ...prev,
        specialty: response.data.specialty,
      }));
    } catch (error) {
      console.error("Error fetching doctor specialty:", error);
      alert("Failed to fetch doctor specialty: " + error.message);
    }
  };

  const checkAppointmentConflict = async () => {
    const { doctor, recordDate } = formData;
    if (!doctor || !recordDate) return false;

    const date = new Date(recordDate);
    const startTime = date.toISOString().split("T")[1].split(".")[0]; // HH:MM:SS
    const endTime = new Date(date.getTime() + 60 * 60 * 1000).toISOString().split("T")[1].split(".")[0]; // Assume 1-hour duration

    try {
      const response = await axios.get("${BASE_URL}/api/applications", {
        params: {
          doctor,
          recordDate: date.toISOString().split("T")[0], // Only date part
        },
      });
      const existingApps = response.data.applications || [];
      return existingApps.some((app) => {
        const appDate = new Date(app.recordDate);
        const appStart = appDate.toISOString().split("T")[1].split(".")[0];
        const appEnd = new Date(appDate.getTime() + 60 * 60 * 1000).toISOString().split("T")[1].split(".")[0];
        return checkTimeOverlap(startTime, endTime, appStart, appEnd);
      });
    } catch (error) {
      console.error("Error checking appointment conflict:", error);
      return false;
    }
  };

  const checkTimeOverlap = (start1, end1, start2, end2) => {
    const startDate1 = new Date(`2000-01-01 ${start1}`);
    const endDate1 = new Date(`2000-01-01 ${end1}`);
    const startDate2 = new Date(`2000-01-01 ${start2}`);
    const endDate2 = new Date(`2000-01-01 ${end2}`);
    return startDate1 < endDate2 && endDate1 > startDate2;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const hasConflict = await checkAppointmentConflict();
    if (hasConflict) {
      alert("This time slot conflicts with an existing appointment for the selected doctor. Please choose a different time or doctor.");
      return;
    }
  
    try {
      const response = await axios.post("${BASE_URL}/api/applications", {
        ...formData,
        patient: formData.patient, // Ensure patient is _id
        doctor: formData.doctor, // Ensure doctor is _id
        recordDate: new Date(formData.recordDate || Date.now()).toISOString().replace("Z", "+05:30"), // IST Example
        previousComments: formData.previousComments, // Send empty array or Comment _ids
      });

      // Sync with appointment using new endpoint in appointment-routes.js, including patientName and doctorName
      const patient = await axios.get(`${BASE_URL}/api/patients/${formData.patient}`);
      const doctor = await axios.get(`${BASE_URL}/api/doctors/${formData.doctor}`);
      const patientName = `${patient.data.firstName || ""} ${patient.data.middleName || ""} ${patient.data.lastName || ""}`.trim() || "Unknown Patient";
      const doctorName = `${doctor.data.firstName || ""} ${doctor.data.middleName || ""} ${doctor.data.lastName || ""}`.trim() || "Unknown Doctor";

      const date = new Date(formData.recordDate);
      const startTime = date.toTimeString().split(" ")[0].slice(0, 5); // HH:MM (UTC)
      const endTime = new Date(date.getTime() + 60 * 60 * 1000).toTimeString().split(" ")[0].slice(0, 5); // +1 hour

      await axios.post("${BASE_URL}/api/appointments/sync", {
        applicationId: response.data._id,
        patientName,
        doctorName,
        specialty: formData.specialty || "Unknown Specialty",
        appointmentMode: formData.appointmentMode || "Online",
        startTime,
        endTime,
        date: date.toISOString().split("T")[0], // YYYY-MM-DD (UTC)
        appointmentStatus: formData.appointmentStatus || "New",
      });
      socket.emit("newApplication", response.data); // Notify Tasks.jsx
      onAdd(); // Refresh applications list
      onClose(); // Close popup
    } catch (error) {
      console.error("Error adding application:", error);
      alert("Failed to add application: " + error.message);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose} aria-label="Add application modal">
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="close-button" onClick={onClose} aria-label="Close modal">
          <FaTimes className="close-icon" />
        </button>
        <h2 className="modal-title">Add Application</h2>
        <form onSubmit={handleSubmit} className="add-application-form" aria-label="Application form">
          <div className="form-section">
            <label htmlFor="patient" className="form-label">Patient *</label>
            <select
              id="patient"
              name="patient"
              value={formData.patient}
              onChange={handleChange}
              required
              className="form-select"
              aria-label="Select patient"
            >
              <option value="">Select Patient</option>
              {patients.map((patient) => (
                <option key={patient._id} value={patient._id}>
                  {`${patient.firstName || ""} ${patient.middleName || ""} ${patient.lastName || ""}`}
                </option>
              ))}
            </select>
          </div>
          <div className="form-section">
            <label htmlFor="serviceType" className="form-label">Service Type *</label>
            <select
              id="serviceType"
              name="serviceType"
              value={formData.serviceType}
              onChange={handleChange}
              required
              className="form-select"
              aria-label="Select service type"
            >
              <option value="Consultation">Consultation</option>
              <option value="Follow-up">Follow-up</option>
              <option value="Procedure">Procedure</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <div className="form-section">
            <label htmlFor="doctor" className="form-label">Doctor *</label>
            <select
              id="doctor"
              name="doctor"
              value={formData.doctor}
              onChange={handleChange}
              required
              className="form-select"
              aria-label="Select doctor"
            >
              <option value="">Select Doctor</option>
              {doctors.map((doctor) => (
                <option key={doctor._id} value={doctor._id}>
                  {`${doctor.firstName || ""} ${doctor.middleName || ""} ${doctor.lastName || ""}`}
                </option>
              ))}
            </select>
          </div>
          <div className="form-section">
            <label className="form-label">Specialty *</label>
            <input
              type="text"
              value={formData.specialty}
              readOnly
              className="form-input"
              aria-label="Doctor specialty (read-only)"
            />
          </div>
          <div className="form-section">
            <label htmlFor="appointmentMode" className="form-label">Appointment Mode *</label>
            <select
              id="appointmentMode"
              name="appointmentMode"
              value={formData.appointmentMode}
              onChange={handleChange}
              required
              className="form-select"
              aria-label="Select appointment mode"
            >
              <option value="Online">Online</option>
              <option value="Offline">Offline</option>
            </select>
          </div>
          <div className="form-section">
            <label htmlFor="appointmentStatus" className="form-label">Appointment Status *</label>
            <select
              id="appointmentStatus"
              name="appointmentStatus"
              value={formData.appointmentStatus}
              onChange={handleChange}
              required
              className="form-select"
              aria-label="Select appointment status"
            >
              <option value="New">New</option>
              <option value="In Process">In Process</option>
              <option value="Old">Old</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>
          <div className="form-section">
            <label htmlFor="meetingLink" className="form-label">Meeting Link</label>
            <input
              type="text"
              id="meetingLink"
              name="meetingLink"
              value={formData.meetingLink}
              onChange={handleChange}
              className="form-input"
              placeholder="e.g., https://meet.example.com/123"
              aria-label="Meeting link"
            />
          </div>
          <div className="form-section">
            <label htmlFor="recordDate" className="form-label">Record Date *</label>
            <input
              type="datetime-local"
              id="recordDate"
              name="recordDate"
              value={formData.recordDate}
              onChange={handleChange}
              required
              className="form-input"
              aria-label="Record date and time"
            />
          </div>
          <div className="form-section">
            <label htmlFor="paymentStatus" className="form-label">Payment Status *</label>
            <select
              id="paymentStatus"
              name="paymentStatus"
              value={formData.paymentStatus}
              onChange={handleChange}
              required
              className="form-select"
              aria-label="Select payment status"
            >
              <option value="new">New</option>
              <option value="in process">In Process</option>
              <option value="paid">Paid</option>
              <option value="cancelled">Cancelled</option>
              <option value="free">Free</option>
            </select>
          </div>
          <div className="form-section">
            <label htmlFor="comments" className="form-label">Comments</label>
            <textarea
              id="comments"
              name="comments"
              value={formData.comments}
              onChange={handleChange}
              className="form-input"
              placeholder="Add comments..."
              aria-label="Comments"
            />
          </div>
          <div className="form-section">
            <label className="form-label">Previous Comments</label>
            <div className="comments-bubbles">
              {formData.previousComments.length === 0 ? (
                <span className="no-comments">No previous comments</span>
              ) : (
                formData.previousComments.map((commentId, index) => (
                  <div 
                    key={commentId} 
                    className="comment-bubble" 
                    aria-label={`Previous comment ${index + 1}`}
                  >
                    <span>Loading...</span> {/* Placeholder until comments are fetched, optional */}
                  </div>
                ))
              )}
            </div>
          </div>
          <div className="modal-actions">
            <button type="submit" className="submit-btn" aria-label="Submit application">
              Submit
            </button>
            <button type="button" className="cancel-btn" onClick={onClose} aria-label="Cancel">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AddApplicationPopup;