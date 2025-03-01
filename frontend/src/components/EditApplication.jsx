import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import "../styles/EditApplication.css";
import { FaTimes, FaTrash, FaFilePdf } from "react-icons/fa";
import { formatForDatetimeLocal, formatForMongoDB } from "../utils/dateUtils"; // Import date utilities
import { io } from "socket.io-client"; // Import socket.io-client

const socket = io("${BASE_URL}"); // Connect to backend WebSocket

function EditApplication() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [application, setApplication] = useState(null);
  const [formData, setFormData] = useState({
    patient: "",
    serviceType: "Consultation",
    doctor: "",
    specialty: "",
    appointmentMode: "Online",
    appointmentStatus: "New",
    meetingLink: "",
    recordDate: "",
    paymentStatus: "new",
    previousComments: [], // Initialize as empty array of Comment _ids
  });
  const [doctors, setDoctors] = useState([]);
  const [patients, setPatients] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchApplication();
    fetchDoctors();
    fetchPatients();
  }, [id]);

  const fetchApplication = async () => {
    try {
      const response = await axios.get(`${BASE_URL}/api/applications/${id}`); // Remove .populate(), rely on backend
      setApplication(response.data);
      const recordDate = formatForDatetimeLocal(response.data.recordDate);
      setFormData({
        patient: response.data.patient ? response.data.patient._id : "",
        serviceType: response.data.serviceType,
        doctor: response.data.doctor ? response.data.doctor._id : "",
        specialty: response.data.specialty,
        appointmentMode: response.data.appointmentMode,
        appointmentStatus: response.data.appointmentStatus,
        meetingLink: response.data.meetingLink || "",
        recordDate: recordDate,
        paymentStatus: response.data.paymentStatus,
        previousComments: (response.data.previousComments || []).map(comment => comment._id.toString()),
      });
      setIsLoading(false);
    } catch (error) {
      console.error("Error fetching application:", error);
      setError("Failed to load application: " + error.message);
    }
  };

  const fetchDoctors = async () => {
    try {
      const response = await axios.get("${BASE_URL}/api/doctors"); // Remove .populate(), rely on backend
      setDoctors(response.data);
    } catch (error) {
      console.error("Error fetching doctors:", error);
      setError("Failed to load doctors: " + error.message);
    }
  };

  const fetchPatients = async () => {
    try {
      const response = await axios.get("${BASE_URL}/api/patients"); // Remove .populate(), rely on backend
      setPatients(response.data);
    } catch (error) {
      console.error("Error fetching patients:", error);
      setError("Failed to load patients: " + error.message);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (name === "doctor" && value) {
      fetchDoctorSpecialty(value);
    }
  };

  const fetchDoctorSpecialty = async (doctorId) => {
    try {
      const response = await axios.get(`${BASE_URL}/api/doctors/${doctorId}`);
      setFormData((prev) => ({
        ...prev,
        specialty: response.data.specialty || "",
      }));
    } catch (error) {
      console.error("Error fetching doctor specialty:", error);
      setError("Failed to fetch doctor specialty: " + error.message);
    }
  };

  const checkAppointmentConflict = async () => {
    const { doctor, recordDate } = formData;
    if (!doctor || !recordDate) {
      return false; // No conflict if required fields are missing
    }

    try {
      const date = new Date(recordDate);
      if (isNaN(date.getTime())) {
        throw new Error("Invalid date format");
      }

      const startTime = date.toISOString().split("T")[1].split(".")[0].slice(0, 5); // HH:MM
      const endTime = new Date(date.getTime() + 60 * 60 * 1000).toISOString().split("T")[1].split(".")[0].slice(0, 5); // +1 hour

      const response = await axios.get("${BASE_URL}/api/applications", {
        params: {
          doctor,
          recordDate: date.toISOString().split("T")[0], // Only date part
          _id: { $ne: id }, // Exclude current application
        },
      });
      const existingApps = response.data.applications || [];

      return existingApps.some((app) => {
        if (app.id === application.id) return false; // Skip the current application to avoid self-conflict
        const appDate = new Date(app.recordDate);
        const appStart = appDate.toISOString().split("T")[1].split(".")[0].slice(0, 5);
        const appEnd = new Date(appDate.getTime() + 60 * 60 * 1000).toISOString().split("T")[1].split(".")[0].slice(0, 5);
        return checkTimeOverlap(startTime, endTime, appStart, appEnd);
      });
    } catch (error) {
      console.error("Error checking appointment conflict:", error);
      setError("Failed to check appointment conflict: " + error.message);
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

  const handleUpdate = async (e) => {
    e.preventDefault();
    setError(""); // Reset error state

    // Validate required fields
    if (!formData.patient || !formData.doctor || !formData.recordDate) {
      setError("Patient, Doctor, and Record Date are required fields.");
      return;
    }

    const hasConflict = await checkAppointmentConflict();
    if (hasConflict) {
      setError("This time slot conflicts with an existing appointment for the selected doctor. Please choose a different time or doctor.");
      return;
    }

    try {
      const formattedRecordDate = formatForMongoDB(formData.recordDate);
      console.log("Updating with payload:", {
        ...formData,
        recordDate: formattedRecordDate,
        previousComments: formData.previousComments,
      });

      const response = await axios.put(`${BASE_URL}/api/applications/${id}`, {
        ...formData,
        recordDate: formattedRecordDate,
        previousComments: formData.previousComments,
      });

      // Sync with appointment using new endpoint in appointment-routes.js, with URL-encoded ID
      const encodedId = encodeURIComponent(response.data.id);
      await axios.put(`${BASE_URL}/api/appointments/sync/${encodedId}`, { applicationId: response.data._id });
      socket.emit("updateApplication", response.data); // Notify Tasks.jsx
      alert("Application updated successfully!");
      navigate("/applications"); // Redirect back to applications page
    } catch (error) {
      console.error("Error updating application:", error);
      setError("Failed to update application: " + (error.response?.data?.message || error.message));
    }
  };

  const handleDelete = async () => {
    if (window.confirm("Are you sure you want to delete this application?")) {
      try {
        await axios.delete(`${BASE_URL}/api/applications/${id}`);
        socket.emit("deleteApplication", id); // Notify Tasks.jsx (optional)
        alert("Application deleted successfully!");
        navigate("/applications"); // Redirect back to applications page
      } catch (error) {
        console.error("Error deleting application:", error);
        setError("Failed to delete application: " + (error.response?.data?.message || error.message));
      }
    }
  };

  const handleDeleteDocument = async (docId) => {
    if (window.confirm("Are you sure you want to delete this document?")) {
      try {
        await axios.delete(`${BASE_URL}/api/media/${docId}`); // Exclusive to EditApplication
        fetchApplication(); // Refresh application data
        alert("Document deleted successfully!");
      } catch (error) {
        console.error("Error deleting document:", error);
        setError("Failed to delete document: " + error.message);
      }
    }
  };

  const handleDeleteComment = async (commentId) => {
    if (window.confirm("Are you sure you want to delete this comment?")) {
      try {
        console.log("Deleting comment with ID:", commentId, "at URL:", `${BASE_URL}/api/comments/${commentId}`);
        await axios.delete(`${BASE_URL}/api/comments/${commentId}`);
        fetchApplication(); // Refresh application data
        alert("Comment deleted successfully!");
      } catch (error) {
        console.error("Error deleting comment:", error);
        setError("Failed to delete comment: " + error.message);
      }
    }
  };

  const previewDocument = (doc) => {
    if (doc.url) {
      window.open(doc.url, "_blank");
    } else if (doc.path) {
      window.open(`${BASE_URL}/api/media/${doc._id}`, "_blank");
    } else {
      setError("No preview available for this document.");
    }
  };

  if (isLoading) return <div>Loading...</div>;

  return (
    <div className="modal-overlay" onClick={() => navigate("/applications")} aria-label="Edit application modal">
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="close-button" onClick={() => navigate("/applications")} aria-label="Close modal">
          <FaTimes className="close-icon" />
        </button>
        <h2 className="modal-title">Edit Application</h2>
        {error && <div className="error-message" role="alert">{error}</div>}
        <form onSubmit={handleUpdate} className="edit-application-form" aria-label="Edit application form">
          <div className="form-section">
            <label className="form-label">Application ID</label>
            <input
              type="text"
              value={application.id || "N/A"}
              readOnly
              className="form-input"
              aria-label="Application ID (read-only)"
            />
          </div>
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

          {/* Documents Section (With Red Trash Icon, Exclusive to EditApplication) */}
          <div className="form-section">
            <h3 className="section-title">Documents</h3>
            <hr className="section-divider" />
            {application.documents.map((doc) => (
              <div key={doc._id} className="document-item">
                <FaFilePdf className="document-icon" onClick={() => previewDocument(doc)} />
                <span>{doc.filename}</span>
                <button
                  className="delete-doc-btn"
                  onClick={() => handleDeleteDocument(doc._id)}
                  aria-label={`Delete document ${doc.filename}`}
                >
                  <FaTrash className="trash-icon" />
                </button>
              </div>
            ))}
          </div>

          {/* Comments Section (With Red Trash Icon, Deletion Only) */}
          <div className="form-section">
            <h3 className="section-title">Comments</h3>
            <hr className="section-divider" />
            <div className="comments-bubbles">
              {(application.previousComments || []).map((comment) => (
                <div 
                  key={comment._id} 
                  className="comment-bubble" 
                  aria-label={`Delete comment ${comment.text}`}
                >
                  <span>{comment.text}</span>
                  <button
                    className="delete-comment-btn"
                    onClick={() => handleDeleteComment(comment._id)}
                    aria-label={`Delete comment ${comment.text}`}
                  >
                    <FaTrash className="trash-icon" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="modal-actions">
            <button type="submit" className="submit-btn" aria-label="Update application">
              Update
            </button>
            <button type="button" className="delete-btn" onClick={handleDelete} aria-label="Delete application">
              Delete
            </button>
            <button type="button" className="cancel-btn" onClick={() => navigate("/applications")} aria-label="Cancel">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default EditApplication;