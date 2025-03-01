import React, { useState, useRef } from "react";
import "../styles/AddDocumentPopup.css";
import { FaTimes, FaCloudUploadAlt, FaLink } from "react-icons/fa";
import axios from "axios";

function AddDocumentPopup({ applicationId, onClose, onAdd }) {
  const [files, setFiles] = useState([]);
  const [urls, setUrls] = useState([""]);
  const [error, setError] = useState("");
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const selectedFiles = Array.from(e.target.files);
    setFiles(selectedFiles);
    setError("");
  };

  const handleUrlChange = (index, value) => {
    const newUrls = [...urls];
    newUrls[index] = value.trim();
    setUrls(newUrls);
    setError("");
  };

  const addUrlInput = () => {
    if (urls.length < 5) {
      setUrls([...urls, ""]);
    } else {
      setError("Maximum 5 URLs allowed.");
    }
  };

  const removeUrlInput = (index) => {
    const newUrls = urls.filter((_, i) => i !== index);
    setUrls(newUrls);
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!files.length && !urls.some(url => url.trim())) {
      setError("Please upload at least one file or provide a valid URL.");
      return;
    }

    const formData = new FormData();
    files.forEach(file => formData.append("documents", file));

    const validUrls = urls.filter(url => url.trim() && url.match(/^https?:\/\//i));
    if (validUrls.length > 0) {
      formData.append("url", JSON.stringify(validUrls));
    }

    try {
      console.log("Submitting documents with formData:", Object.fromEntries(formData));
      await axios.post(`${BASE_URL}/api/applications/${applicationId}/documents`, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });
      onAdd();
      onClose();
    } catch (error) {
      console.error("Error adding documents:", error.response ? error.response.data : error.message);
      setError("Failed to add documents: " + (error.response?.data?.message || error.message));
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose} aria-label="Add document modal">
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="close-button" onClick={onClose} aria-label="Close modal">
          <FaTimes className="close-icon" />
        </button>
        <h2 className="modal-title">Add Document</h2>
        <form onSubmit={handleSubmit} className="add-document-form" aria-label="Add document form">
          <div className="form-section">
            <label htmlFor="fileUpload" className="form-label">Upload Files</label>
            <div className="file-upload-container">
              <input
                type="file"
                id="fileUpload"
                ref={fileInputRef}
                multiple
                accept="*/*"
                onChange={handleFileChange}
                className="file-input"
                style={{ display: "none" }}
                aria-label="Upload files"
              />
              <button
                type="button"
                className="upload-btn"
                onClick={() => fileInputRef.current.click()}
                aria-label="Upload files button"
              >
                <FaCloudUploadAlt className="upload-icon" /> Upload
              </button>
            </div>
            {files.length > 0 && (
              <div className="file-list">
                {files.map((file, index) => (
                  <p key={index} className="file-name">{file.name}</p>
                ))}
              </div>
            )}
          </div>

          <div className="form-section">
            <label className="form-label">Add URL (e.g., Google Drive)</label>
            {urls.map((url, index) => (
              <div key={index} className="url-input-container">
                <input
                  type="text"
                  value={url}
                  onChange={(e) => handleUrlChange(index, e.target.value)}
                  placeholder="Enter URL (e.g., https://drive.google.com/file/d/123)"
                  className="url-input"
                  aria-label={`URL input ${index + 1}`}
                />
                {urls.length > 1 && (
                  <button
                    type="button"
                    className="remove-url-btn"
                    onClick={() => removeUrlInput(index)}
                    aria-label={`Remove URL input ${index + 1}`}
                  >
                    <FaTimes className="remove-icon" />
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              className="add-url-btn"
              onClick={addUrlInput}
              aria-label="Add another URL input"
            >
              <FaLink className="link-icon" /> Add URL
            </button>
          </div>

          {error && <p className="error-message" aria-live="polite">{error}</p>}

          <div className="modal-actions">
            <button type="submit" className="submit-btn" aria-label="Add documents">
              Add Documents
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

export default AddDocumentPopup;