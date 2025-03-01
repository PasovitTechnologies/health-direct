import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import dayjs from "dayjs"; // Import dayjs for date formatting
import "../styles/EditGeneralProfile.css"; // New CSS file
import { FaEdit, FaTrash, FaArrowLeft } from "react-icons/fa";

function EditGeneralProfile({ patient, onCancel, onSave }) {
  const navigate = useNavigate();
  const [editedData, setEditedData] = useState({
    firstName: patient.firstName,
    middleName: patient.middleName || "",
    lastName: patient.lastName,
    gender: patient.gender,
    dateOfBirth: patient.dateOfBirth,
    telephone: patient.telephone,
    additionalPhone: patient.additionalPhone || "",
    email: patient.email,
    comments: patient.comments || "",
  });

  // Handle input changes in edit mode
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setEditedData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // Handle form submission for editing
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editedData.firstName || !editedData.lastName || !editedData.gender || !editedData.dateOfBirth || !editedData.telephone || !editedData.email) {
      alert("Please fill in all required fields! (First Name, Last Name, Gender, Date of Birth, Telephone, Email)");
      return;
    }
    try {
      const response = await axios.put(`${BASE_URL}/api/patients/${patient._id}`, editedData);
      onSave(response.data.patient);
      alert("Patient updated successfully!");
    } catch (error) {
      console.error("Error updating patient:", error);
      alert("Failed to update patient.");
    }
  };

  // Handle delete (only in edit mode)
  const handleDelete = async () => {
    if (!window.confirm("Are you sure you want to delete this patient?")) return;
    try {
      await axios.delete(`${BASE_URL}/api/patients/${patient._id}`);
      alert("Patient deleted successfully!");
      navigate("/patients"); // Redirect back to Patients tab after deletion
    } catch (error) {
      console.error("Error deleting patient:", error);
      alert("Failed to delete patient.");
    }
  };

  return (
    <div className="edit-patient-profile-container">
      <header className="edit-patient-profile-header">
        <button className="back-button" onClick={onCancel} aria-label="Back to patient profile">
          <FaArrowLeft className="back-icon" />
        </button>
      </header>

      <div className="edit-patient-profile-content">
        <h1 className="edit-patient-profile-title">Edit Patient Profile</h1>

        <div className="edit-form">
          {/* Name Section */}
          <div className="form-section">
            <h2 className="section-title">Name</h2>
            <div className="name-row">
              <div className="form-group name-field">
                <label>
                  First Name <span>*</span>
                </label>
                <input
                  type="text"
                  name="firstName"
                  value={editedData.firstName}
                  onChange={handleInputChange}
                  required
                />
              </div>
              <div className="form-group name-field">
                <label>Middle Name</label>
                <input
                  type="text"
                  name="middleName"
                  value={editedData.middleName}
                  onChange={handleInputChange}
                />
              </div>
              <div className="form-group name-field">
                <label>
                  Last Name <span>*</span>
                </label>
                <input
                  type="text"
                  name="lastName"
                  value={editedData.lastName}
                  onChange={handleInputChange}
                  required
                />
              </div>
            </div>
          </div>

          {/* Gender Section */}
          <div className="form-section">
            <h2 className="section-title">Gender</h2>
            <div className="form-group">
              <label>
                Gender <span>*</span>
              </label>
              <select
                name="gender"
                value={editedData.gender}
                onChange={handleInputChange}
                required
                className="patient-select"
              >
                <option value="">Select Gender</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>

          {/* Date of Birth Section */}
          <div className="form-section">
            <h2 className="section-title">Date of Birth</h2>
            <div className="form-group">
              <label>
                Date of Birth <span>*</span>
              </label>
              <input
                type="date"
                name="dateOfBirth"
                value={editedData.dateOfBirth}
                onChange={handleInputChange}
                required
              />
            </div>
          </div>

          {/* Contact Information Section */}
          <div className="form-section">
            <h2 className="section-title">Contact Information</h2>
            <div className="form-group">
              <label>
                Telephone <span>*</span>
              </label>
              <input
                type="tel"
                name="telephone"
                placeholder="Enter telephone number"
                value={editedData.telephone}
                onChange={handleInputChange}
                required
              />
            </div>
            <div className="form-group">
              <label>Additional Phone</label>
              <input
                type="tel"
                name="additionalPhone"
                placeholder="Optional additional phone number"
                value={editedData.additionalPhone}
                onChange={handleInputChange}
              />
            </div>
            <div className="form-group">
              <label>
                Email <span>*</span>
              </label>
              <input
                type="email"
                name="email"
                placeholder="patient@example.com"
                value={editedData.email}
                onChange={handleInputChange}
                required
              />
            </div>
          </div>

          {/* Comments Section (Edit Mode) */}
          <div className="form-section">
            <h2 className="section-title">Comments</h2>
            <div className="form-group">
              <label>Comments</label>
              <textarea
                name="comments"
                value={editedData.comments}
                onChange={handleInputChange}
                placeholder="Add comments about the patient (optional)"
                className="comments-textarea"
              />
            </div>
          </div>

          <div className="profile-actions">
            <button type="submit" className="edit-btn" onClick={handleEditSubmit}>
              <FaEdit className="action-icon" /> Save Changes
            </button>
            <button className="delete-btn" onClick={handleDelete} aria-label="Delete patient">
              <FaTrash className="action-icon" /> Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default EditGeneralProfile;