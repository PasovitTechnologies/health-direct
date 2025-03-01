import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import "../styles/EditMedicalProfile.css"; // New CSS file
import { FaEdit, FaTrash, FaArrowLeft, FaUpload, FaTrashAlt, FaFileAlt } from "react-icons/fa";

function EditMedicalProfile({ patient, medical, onCancel, onSave }) {
  const navigate = useNavigate();
  const [editedData, setEditedData] = useState({
    medicalHistory: medical.medicalHistory || "",
    medicalComments: medical.medicalComments || "",
    media: medical.media || [], // Store media IDs (ObjectIds)
  });
  const [mediaFiles, setMediaFiles] = useState([]); // Store uploaded files

  // Handle input changes in edit mode
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setEditedData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // Handle file input change for media upload
  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    setMediaFiles((prev) => [
      ...prev,
      ...files.map((file) => ({
        file,
        contentType: file.type, // Store MIME type for MongoDB
      })),
    ]);

    // Update editedData media array with temporary references, preserving existing media IDs
    setEditedData((prev) => ({
      ...prev,
      media: [
        ...prev.media,
        ...files.map(() => null), // Placeholder for new media IDs (will be updated on save)
      ],
    }));
  };

  // Handle deleting media
  const handleDeleteMedia = (index) => {
    setMediaFiles((prev) => prev.filter((_, i) => i !== index));
    setEditedData((prev) => ({
      ...prev,
      media: prev.media.filter((_, i) => i !== index),
    }));
  };

  // Handle form submission for editing
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    try {
      // Prepare FormData for file upload, preserving existing media
      const formData = new FormData();
      formData.append("medicalHistory", editedData.medicalHistory);
      formData.append("medicalComments", editedData.medicalComments);

      // Add existing media IDs if they exist, and upload new files
      editedData.media.forEach((mediaId, index) => {
        if (mediaId && typeof mediaId === 'string') { // If it's an ObjectId (string)
          formData.append("existingMedia", mediaId);
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
        <h1 className="edit-patient-profile-title">Edit Medical Profile</h1>

        <div className="edit-form">
          {/* Medical History Section */}
          <div className="form-section">
            <h2 className="section-title">Medical History</h2>
            <div className="form-group">
              <label>Medical History</label>
              <textarea
                name="medicalHistory"
                value={editedData.medicalHistory}
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
                value={editedData.medicalComments}
                onChange={handleInputChange}
                placeholder="Add medical comments (optional)"
                className="comments-textarea"
              />
            </div>
          </div>

          {/* Media Section */}
          <div className="form-section">
            <h2 className="section-title">Media</h2>
            {editedData.media.map((mediaId, index) => (
              <div key={index} className="media-group" style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "15px" }}>
                <div className="media-preview" style={{ flex: 1 }}>
                  {mediaId && (
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
                      {/* Placeholder for preview - fetch media data dynamically if needed */}
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
                        <FaFileAlt style={{ fontSize: "24px" }} /> {`Media ${index + 1}`}
                      </div>
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

export default EditMedicalProfile;