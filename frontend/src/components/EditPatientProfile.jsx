import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import dayjs from "dayjs"; // Import dayjs for date formatting
import "../styles/EditPatientProfile.css"; // Updated CSS file name
import { FaEdit, FaTrash, FaArrowLeft, FaUpload, FaTrashAlt, FaFileAlt } from "react-icons/fa";

function EditPatientProfile({ patient, medical, editType, onCancel, onSave }) {
  const navigate = useNavigate();
  const [editedData, setEditedData] = useState({
    general: {
      firstName: patient.firstName,
      middleName: patient.middleName || "",
      lastName: patient.lastName,
      gender: patient.gender,
      dateOfBirth: patient.dateOfBirth,
      telephone: patient.telephone,
      additionalPhone: patient.additionalPhone || "",
      email: patient.email,
      comments: patient.comments || "",
    },
    medical: {
      medicalHistory: medical?.medicalHistory || "",
      medicalComments: medical?.medicalComments || "",
      media: medical?.media || [], // Preserve existing media
    },
  });
  const [mediaFiles, setMediaFiles] = useState([]); // Store uploaded files

  // Handle input changes in edit mode
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    if (editType === "general") {
      setEditedData((prev) => ({
        ...prev,
        general: {
          ...prev.general,
          [name]: value,
        },
      }));
    } else if (editType === "medical") {
      setEditedData((prev) => ({
        ...prev,
        medical: {
          ...prev.medical,
          [name]: value,
        },
      }));
    }
  };

  // Handle file input change for media upload
  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    setMediaFiles((prev) => [
      ...prev,
      ...files.map((file) => ({
        file,
        url: URL.createObjectURL(file),
        type: file.type.startsWith("image/") ? "photo" : file.type.startsWith("video/") ? "video" : file.type.startsWith("audio/") ? "audio" : file.type === "application/pdf" ? "pdf" : "doc",
      })),
    ]);

    // Update editedData media array with file info (flat structure), preserving existing media
    setEditedData((prev) => ({
      ...prev,
      medical: {
        ...prev.medical,
        media: [
          ...prev.medical.media, // Keep existing media
          ...files.map((file) => ({
            url: URL.createObjectURL(file),
            type: file.type.startsWith("image/") ? "photo" : file.type.startsWith("video/") ? "video" : file.type.startsWith("audio/") ? "audio" : file.type === "application/pdf" ? "pdf" : "doc",
          })),
        ],
      },
    }));
  };

  // Handle deleting media
  const handleDeleteMedia = (index) => {
    setMediaFiles((prev) => prev.filter((_, i) => i !== index));
    setEditedData((prev) => ({
      ...prev,
      medical: {
        ...prev.medical,
        media: prev.medical.media.filter((_, i) => i !== index),
      },
    }));
  };

  // Handle form submission for editing
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (editType === "general") {
      if (!editedData.general.firstName || !editedData.general.lastName || !editedData.general.gender || !editedData.general.dateOfBirth || !editedData.general.telephone || !editedData.general.email) {
        alert("Please fill in all required fields! (First Name, Last Name, Gender, Date of Birth, Telephone, Email)");
        return;
      }
      try {
        const response = await axios.put(`http://localhost:5001/api/patients/${patient._id}`, editedData.general);
        onSave(response.data.patient);
        alert("Patient updated successfully!");
      } catch (error) {
        console.error("Error updating patient:", error);
        alert("Failed to update patient.");
      }
    } else if (editType === "medical") {
      try {
        // Prepare FormData for file upload, preserving existing media
        const formData = new FormData();
        formData.append("medicalHistory", editedData.medical.medicalHistory);
        formData.append("medicalComments", editedData.medical.medicalComments);

        // Add existing media URLs if they don't have new files, and upload new files
        editedData.medical.media.forEach((media, index) => {
          if (!mediaFiles[index]?.file && media.url) {
            // Preserve existing media URL if no new file is uploaded
            formData.append("existingMedia", JSON.stringify({ type: media.type, url: media.url }));
          }
          if (mediaFiles[index]?.file) {
            formData.append("media", mediaFiles[index].file);
          }
        });

        const response = await axios.put(`http://localhost:5001/api/patients/${patient._id}/medical`, formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        });
        onSave(response.data.medical);
        alert("Medical information updated successfully!");
      } catch (error) {
        console.error("Error updating medical information:", error);
        alert("Failed to update medical information.");
      }
    }
  };

  // Handle delete (only in edit mode)
  const handleDelete = async () => {
    if (!window.confirm("Are you sure you want to delete this patient?")) return;
    try {
      await axios.delete(`http://localhost:5001/api/patients/${patient._id}`);
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
        <h1 className="edit-patient-profile-title">Edit {editType === "general" ? "Patient" : "Medical"} Profile</h1>

        <div className="edit-form">
          {editType === "general" ? (
            <>
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
                      value={editedData.general.firstName}
                      onChange={handleInputChange}
                      required
                    />
                  </div>
                  <div className="form-group name-field">
                    <label>Middle Name</label>
                    <input
                      type="text"
                      name="middleName"
                      value={editedData.general.middleName}
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
                      value={editedData.general.lastName}
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
                    value={editedData.general.gender}
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
                    value={editedData.general.dateOfBirth}
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
                    value={editedData.general.telephone}
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
                    value={editedData.general.additionalPhone}
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
                    value={editedData.general.email}
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
                    value={editedData.general.comments}
                    onChange={handleInputChange}
                    placeholder="Add comments about the patient (optional)"
                    className="comments-textarea"
                  />
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Medical History Section */}
              <div className="form-section">
                <h2 className="section-title">Medical History</h2>
                <div className="form-group">
                  <label>Medical History</label>
                  <textarea
                    name="medicalHistory"
                    value={editedData.medical.medicalHistory}
                    onChange={handleInputChange}
                    placeholder="Enter medical history (optional)"
                    className="comments-textarea"
                  />
                </div>
              </div>

              {/* Medical Comments Section */}
              <div className="form-section">
                <h2 className="section-title">Medical Comments</h2>
                <div className="form-group">
                  <label>Medical Comments</label>
                  <textarea
                    name="medicalComments"
                    value={editedData.medical.medicalComments}
                    onChange={handleInputChange}
                    placeholder="Add medical comments (optional)"
                    className="comments-textarea"
                  />
                </div>
              </div>

              {/* Media Section */}
              <div className="form-section">
                <h2 className="section-title">Media</h2>
                {editedData.medical.media.map((media, index) => (
                  <div key={index} className="media-group" style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "15px" }}>
                    <div className="media-preview" style={{ flex: 1 }}>
                      {media.url && (
                        <div 
                          className="media-preview-content" 
                          style={{ 
                            maxWidth: "200px", 
                            maxHeight: "200px", 
                            overflow: "hidden",
                            border: "1px solid #ccc",
                            borderRadius: "6px",
                          }}
                        >
                          {media.type === "photo" && media.url && (
                            <img 
                              src={media.url} 
                              alt={`Preview ${index + 1}`} 
                              style={{ width: "100%", height: "auto", display: media.url ? "block" : "none" }} 
                            />
                          )}
                          {media.type === "video" && media.url && (
                            <video 
                              controls 
                              style={{ width: "100%", height: "auto", display: media.url ? "block" : "none" }}
                            >
                              <source src={media.url} type={`video/${media.url.split('.').pop()}`} />
                              Your browser does not support the video tag.
                            </video>
                          )}
                          {media.type === "audio" && media.url && (
                            <audio 
                              controls 
                              style={{ width: "100%", display: media.url ? "block" : "none" }}
                            >
                              <source src={media.url} type={`audio/${media.url.split('.').pop()}`} />
                              Your browser does not support the audio element.
                            </audio>
                          )}
                          {["pdf", "doc"].includes(media.type) && media.url && (
                            <div 
                              style={{ 
                                display: "flex", 
                                alignItems: "center", 
                                justifyContent: "center", 
                                width: "100%", 
                                height: "100%", 
                                background: "#f5f5f5", 
                                color: "#333" 
                              }}
                            >
                              <FaFileAlt style={{ fontSize: "24px" }} /> {media.type.toUpperCase()}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <button 
                      type="button" 
                      className="delete-media-btn" 
                      onClick={() => handleDeleteMedia(index)}
                      aria-label={`Delete media item ${index + 1}`}
                    >
                      <FaTrashAlt className="delete-icon" />
                    </button>
                  </div>
                ))}
                <div className="media-upload-group">
                  <input
                    type="file"
                    id="mediaUpload"
                    onChange={handleFileChange}
                    accept="image/*,video/*,audio/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    className="media-file-input"
                    multiple
                    style={{ display: "none" }}
                  />
                  <label htmlFor="mediaUpload" className="upload-media-btn">
                    <FaUpload className="upload-icon" /> Upload
                  </label>
                </div>
              </div>
            </>
          )}

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

export default EditPatientProfile;