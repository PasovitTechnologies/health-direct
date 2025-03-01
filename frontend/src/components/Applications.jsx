import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "./DashboardLayout";
import "../styles/Applications.css";
import { FaFilePdf, FaPhone, FaWhatsapp, FaEnvelope, FaTelegram, FaFilter, FaLink, FaPlus, FaArrowLeft, FaArrowRight, FaTimes } from "react-icons/fa";
import AddApplicationPopup from "./AddApplicationPopup";
import AddDocumentPopup from "./AddDocumentPopup";
import ApplicationPayment from "./ApplicationPayment"; // New import
import axios from "axios";
const mongoose = require("mongoose");

function Applications() {
  const navigate = useNavigate();
  const [applications, setApplications] = useState([]);
  const [newComments, setNewComments] = useState({});
  const [showAddPopup, setShowAddPopup] = useState(false);
  const [showDocumentPopup, setShowDocumentPopup] = useState(false);
  const [selectedApplicationId, setSelectedApplicationId] = useState(null);
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [filters, setFilters] = useState({
    appointmentStatus: "",
    paymentStatus: "",
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedComment, setSelectedComment] = useState(null);
  const [editCommentText, setEditCommentText] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showPaymentPopup, setShowPaymentPopup] = useState(false); // New state
  const [selectedApplication, setSelectedApplication] = useState(null); // New state
  const [showEmailPopup, setShowEmailPopup] = useState(false); // New state for email popup
  const [emailRecipient, setEmailRecipient] = useState(""); // Store recipient email (patient or doctor)
  const [emailSubject, setEmailSubject] = useState(""); // Email subject input
  const [emailBody, setEmailBody] = useState(""); // Email body input
  const [error, setError] = useState(""); // Add error state for email
  const [loading, setLoading] = useState(false); // Add loading state for email
  const [showActContractPopup, setShowActContractPopup] = useState(false); // New state for Act/Contract popup
  const itemsPerPage = 10;

  useEffect(() => {
    fetchApplications();
  }, [currentPage, searchTerm, filters]);

  const fetchApplications = async () => {
    try {
      console.log("Fetching applications with params:", {
        page: currentPage,
        limit: itemsPerPage,
        search: searchTerm.trim() || undefined,
        appointmentStatus: filters.appointmentStatus || undefined,
        paymentStatus: filters.paymentStatus || undefined,
      });
      const response = await axios.get("${BASE_URL}/api/applications", {
        params: {
          page: currentPage,
          limit: itemsPerPage,
          search: searchTerm.trim() || undefined,
          appointmentStatus: filters.appointmentStatus || undefined,
          paymentStatus: filters.paymentStatus || undefined,
        },
      });
      setApplications(response.data.applications);
      setTotalPages(response.data.totalPages);
      console.log("Fetched applications:", response.data.applications, "Total pages:", response.data.totalPages);
    } catch (error) {
      console.error("Error fetching applications:", error);
      alert("Failed to fetch applications: " + error.message);
    }
  };

  const handleCommentChange = (index, value) => {
    setNewComments((prev) => ({ ...prev, [index]: value }));
  };

  const copyMeetingLink = (link) => {
    navigator.clipboard.writeText(link).then(() => {
      alert("Meeting link copied to clipboard!");
    }).catch((err) => {
      console.error("Failed to copy link:", err);
      alert("Failed to copy meeting link.");
    });
  };

  const handleEditAppointment = (app) => {
    navigate(`/applications/edit/${app._id}`);
  };

  const handleAddApplication = () => {
    setShowAddPopup(true);
  };

  const handleSearchSubmit = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      setCurrentPage(1);
      fetchApplications();
    }
  };

  const handleAddDocument = (applicationId) => {
    if (!applicationId) {
      console.error("No applicationId provided for document upload");
      return;
    }
    setSelectedApplicationId(applicationId);
    setShowDocumentPopup(true);
  };

  const handleDocumentAdded = () => {
    fetchApplications(); // Refresh applications list after adding documents
    setShowDocumentPopup(false);
    setSelectedApplicationId(null);
  };

  const handleAddComment = async (index) => {
    const application = applications[index];
    const commentText = newComments[index] || "";
    if (!commentText.trim()) {
      alert("Please enter a comment.");
      return;
    }

    try {
      console.log("Adding comment to application:", application._id, "with text:", commentText);
      const response = await axios.post(`${BASE_URL}/api/applications/${application._id}/comments`, {
        text: commentText,
      });
      fetchApplications();
      setNewComments((prev) => ({ ...prev, [index]: "" }));
      console.log("Comment added:", response.data);
    } catch (error) {
      console.error("Error adding comment:", error);
      alert("Failed to add comment: " + error.message);
    }
  };

  const handleCommentClick = (comment) => {
    console.log("Clicked comment:", comment);
    setSelectedComment({
      ...comment,
      applicationId: applications.find(app => app.previousComments.some(c => c._id.toString() === comment._id.toString()))._id,
    });
    setEditCommentText(comment.text);
  };

  const handleEditCommentSubmit = async (applicationId, commentId) => {
    if (!editCommentText.trim()) {
      alert("Please enter a comment.");
      return;
    }
    try {
      console.log("Updating comment with ID:", commentId, "at URL:", `${BASE_URL}/api/comments/${commentId}`);
      await axios.put(`${BASE_URL}/api/comments/${commentId}`, {
        text: editCommentText,
      });
      fetchApplications();
      setSelectedComment(null);
      setEditCommentText("");
      alert("Comment updated successfully!");
    } catch (error) {
      console.error("Error updating comment:", error);
      alert("Failed to update comment: " + error.message);
    }
  };

  const handleFilterApply = () => {
    setCurrentPage(1);
    fetchApplications();
    setShowFilterDropdown(false);
  };

  const handleFilterReset = () => {
    setFilters({
      appointmentStatus: "",
      paymentStatus: "",
    });
    setCurrentPage(1);
    fetchApplications();
    setShowFilterDropdown(false);
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  const handleAddPayment = (application) => {
    setSelectedApplication(application);
    setShowPaymentPopup(true);
  };

  const handlePaymentSuccess = () => {
    fetchApplications(); // Refresh applications after payment
    setShowPaymentPopup(false);
    setSelectedApplication(null);
  };

  const handleEmailClick = async (recipientType, application) => { // recipientType: "patient" or "doctor"
    try {
      let recipientId, endpoint;
      if (recipientType === "patient") {
        recipientId = application.patient?._id?.toString() || application.patient;
        endpoint = `${BASE_URL}/api/patients/${recipientId}`; // Use patient-routes.js
      } else if (recipientType === "doctor") {
        recipientId = application.doctor?._id?.toString() || application.doctor;
        endpoint = `${BASE_URL}/api/doctors/${recipientId}`; // Use doctor-routes.js
      }

      if (!recipientId || typeof recipientId !== "string") {
        throw new Error("Invalid recipient ID");
      }

      const response = await axios.get(endpoint);
      const recipient = response.data;
      setEmailRecipient(recipient.email || "default@example.com");
      setShowEmailPopup(true);
    } catch (err) {
      console.error(`Error fetching ${recipientType} email:`, err);
      alert(`Failed to fetch ${recipientType} email: ${err.message}`);
    }
  };

  const handleSendEmail = async () => {
    if (!emailRecipient || !emailSubject.trim() || !emailBody.trim()) {
      setError("Recipient, subject, and body are required.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await axios.post("${BASE_URL}/api/applications/emails/send", {
        to: emailRecipient,
        subject: emailSubject,
        body: emailBody,
      });
      alert("Email sent successfully!");
      setShowEmailPopup(false);
      setEmailRecipient("");
      setEmailSubject("");
      setEmailBody("");
    } catch (err) {
      console.error("Error sending email:", err);
      setError("Failed to send email: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleActContractClick = (action, application) => {
    if (application.payments && application.payments.length > 0) {
      setShowActContractPopup(true); // Show popup for both "Act" and "Contract"
    }
  };

  const closeActContractPopup = () => {
    setShowActContractPopup(false);
  };

  const handlePatientNameClick = (patientId) => {
    // Navigate to the patient profile page using the patient ID
    const patientIdStr = patientId?._id?.toString() || patientId; // Handle both ObjectId and string
    if (patientIdStr && typeof patientIdStr === "string" && mongoose.Types.ObjectId.isValid(patientIdStr)) {
      navigate(`/patient/${patientIdStr}`);
    } else {
      console.error("Invalid patient ID:", patientId);
      alert("Invalid patient ID, cannot navigate to profile.");
    }
  };

  const renderPagination = () => {
    const pageNumbers = [];
    const maxVisiblePages = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

    if (endPage - startPage < maxVisiblePages - 1) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
      pageNumbers.push(
        <button
          key={i}
          onClick={() => handlePageChange(i)}
          className={`pagination-button ${currentPage === i ? "active" : ""}`}
          aria-label={`Go to page ${i}`}
        >
          {i}
        </button>
      );
    }

    return (
      <div className="pagination-container">
        <button
          onClick={() => handlePageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="pagination-arrow"
          aria-label="Previous page"
        >
          <FaArrowLeft />
        </button>
        {pageNumbers}
        <button
          onClick={() => handlePageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="pagination-arrow"
          aria-label="Next page"
        >
          <FaArrowRight />
        </button>
        <span className="pagination-info" aria-live="polite">
          Showing {((currentPage - 1) * itemsPerPage) + 1}–{Math.min(currentPage * itemsPerPage, applications.length || totalPages * itemsPerPage)} of {totalPages * itemsPerPage}
        </span>
      </div>
    );
  };

  const previewDocument = (doc) => {
    if (doc.url) {
      window.open(doc.url, "_blank");
    } else {
      window.open(`${BASE_URL}/api/media/${doc._id}`, "_blank");
    }
  };

  return (
    <DashboardLayout initialActiveTab="HD Applications">
      <div className="applications-container">
        <header className="applications-header">
          <h1 className="applications-title">HD Applications</h1>
          <div className="applications-divider"></div>
        </header>

        <div className="applications-table">
          <div className="table-controls">
            <div className="controls-container">
              <div className="search-container">
                <div className="search-bar">
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyPress={handleSearchSubmit}
                    placeholder="Search by patient name, phone, email, or ID..."
                    className="search-input"
                    aria-label="Search applications"
                  />
                </div>
              </div>
              <div className="search-filter-container">
                <button 
                  className="filter-btn" 
                  onClick={() => setShowFilterDropdown(!showFilterDropdown)} 
                  aria-label="Open filter dropdown"
                >
                  <FaFilter className="filter-icon" /> Filter
                </button>
                {showFilterDropdown && (
                  <div className="filter-dropdown" role="menu" aria-label="Filter options">
                    <div className="filter-section">
                      <h3 className="filter-section-title">Appointments Filter</h3>
                      <select 
                        value={filters.appointmentStatus} 
                        onChange={(e) => setFilters(prev => ({ ...prev, appointmentStatus: e.target.value }))}
                        className="filter-select"
                        aria-label="Appointments filter"
                      >
                        <option value="">All</option>
                        <option value="New">New</option>
                        <option value="In Process">In Process</option>
                        <option value="Old">Old</option>
                        <option value="Cancelled">Cancelled</option>
                      </select>
                    </div>
                    <div className="filter-section">
                      <h3 className="filter-section-title">Payments Filter</h3>
                      <select 
                        value={filters.paymentStatus} 
                        onChange={(e) => setFilters(prev => ({ ...prev, paymentStatus: e.target.value }))}
                        className="filter-select"
                        aria-label="Payments filter"
                      >
                        <option value="">All</option>
                        <option value="New">New</option>
                        <option value="In Process">In Process</option>
                        <option value="Paid">Paid</option>
                        <option value="Cancelled">Cancelled</option>
                        <option value="Free">Free</option>
                      </select>
                    </div>
                    <div className="filter-actions">
                      <button 
                        className="filter-apply-btn" 
                        onClick={handleFilterApply} 
                        aria-label="Apply filters"
                      >
                        Apply
                      </button>
                      <button 
                        className="filter-reset-btn" 
                        onClick={handleFilterReset} 
                        aria-label="Reset filters"
                      >
                        Reset
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <button className="add-btn" onClick={handleAddApplication} aria-label="Add new application">
              <FaPlus className="add-icon" /> Add
            </button>
          </div>

          <table>
            <thead>
              <tr>
                <th className="appointments-header">Appointments</th>
                <th className="consultation-details-header">Consultation Details</th>
                <th className="documents-header">Documents</th>
                <th className="comments-header">Comments</th>
                <th className="payment-header">Payment</th>
              </tr>
            </thead>
            <tbody>
              {applications.map((app, index) => (
                <tr key={app._id}>
                  <td className="appointments-cell">
                    <div className="appointments-row">
                      <span 
                        className="request-id" 
                        onClick={() => handleEditAppointment(app)}
                        aria-label={`Edit appointment ${app.id}`}
                      >
                        {app.id}
                      </span>
                      <p 
                        className="patient-name" 
                        onClick={() => handlePatientNameClick(app.patient)}
                        style={{ cursor: 'pointer', color: '#37b8c0' }} // Verdigris color for clickable link
                        aria-label={`View profile for patient ${app.patient.firstName || "N/A"}`}
                      >
                        {(app.patient && app.patient.firstName ? `${app.patient.firstName} ${app.patient.middleName || ""} ${app.patient.lastName || ""}` : "N/A")}
                      </p>
                      <p className="appointment-status">{app.appointmentStatus}</p>
                      <p className="appointment-datetime">{new Date(app.recordDate).toLocaleString()}</p>
                      <div className="contact-icons-row">
                        <FaEnvelope 
                          className="contact-icon email-icon" 
                          onClick={() => handleEmailClick("patient", app)}
                          title="Send Email to Patient"
                          aria-label="Send email to patient"
                        />
                        <FaWhatsapp className="contact-icon" />
                        <FaPhone className="contact-icon" />
                        <FaTelegram className="contact-icon" />
                      </div>
                    </div>
                  </td>
                  <td className="consultation-details">
                    <p>{(app.doctor && app.doctor.firstName ? `${app.doctor.firstName} ${app.doctor.middleName || ""} ${app.doctor.lastName || ""}` : "N/A")}</p>
                    <p>{app.specialty || "N/A"}</p>
                    <div className="appointment-mode">
                      <span>{app.appointmentMode}</span>
                      {app.appointmentMode === "Online" && app.meetingLink && (
                        <FaLink
                          className="copy-link-icon"
                          onClick={() => copyMeetingLink(app.meetingLink)}
                          title="Copy Link"
                          aria-label="Copy meeting link"
                        />
                      )}
                    </div>
                    <div className="contact-icons-row">
                      <FaEnvelope 
                        className="contact-icon email-icon" 
                        onClick={() => handleEmailClick("doctor", app)}
                        title="Send Email to Doctor"
                        aria-label="Send email to doctor"
                      />
                      <FaPhone className="contact-icon" />
                      <FaWhatsapp className="contact-icon" />
                    </div>
                  </td>
                  <td className="documents-cell">
                    <div className="document-bubbles">
                      {app.documents.map((doc, docIndex) => (
                        <div key={doc._id} className="document-item">
                          <FaFilePdf className="document-icon" onClick={() => previewDocument(doc)} />
                          <span>{doc.filename || "Unnamed Document"}</span>
                          <span className="document-action">
                            {doc.url ? "Link" : "View"}
                          </span>
                        </div>
                      ))}
                    </div>
                    <label htmlFor={`upload-${app._id}`} className="add-doc-btn" aria-label="Upload document">
                      <FaPlus className="add-icon" /> Add
                      <input
                        type="button"
                        id={`upload-${app._id}`}
                        onClick={() => handleAddDocument(app._id)}
                        style={{ display: "none" }}
                      />
                    </label>
                  </td>
                  <td className="comments-cell">
                    <div className="comments-bubbles" role="list" aria-label="Previous comments">
                      {(app.previousComments || []).map((comment) => (
                        <div 
                          key={comment._id} 
                          className="comment-bubble" 
                          onClick={() => handleCommentClick(comment)}
                          aria-label={`Edit comment ${comment.text}`}
                        >
                          <span>{comment.text.substring(0, 20) + (comment.text.length > 20 ? "..." : "")}</span>
                        </div>
                      ))}
                    </div>
                    <div className="comments-input-container">
                      <textarea
                        value={newComments[index] || ""}
                        onChange={(e) => handleCommentChange(index, e.target.value)}
                        placeholder="Type your comment..."
                        className="comments-input"
                        aria-label="Enter comment"
                      />
                      <button
                        className="add-comment-btn"
                        onClick={() => handleAddComment(index)}
                        aria-label="Add comment"
                      >
                        <FaPlus className="add-icon" /> Add
                      </button>
                    </div>
                  </td>
                  <td className="payment-cell">
                    <button
                      className="add-payment-btn"
                      onClick={() => handleAddPayment(app)}
                      aria-label={`Add invoice for application ${app.id}`}
                    >
                      Add Invoice
                    </button>
                    <div className="act-contract-buttons">
                      <button
                        className={`act-btn ${app.payments && app.payments.length > 0 ? "enabled" : "disabled"}`}
                        onClick={() => app.payments && app.payments.length > 0 && handleActContractClick("Act", app)}
                        disabled={!app.payments || app.payments.length === 0}
                        aria-label={`Act for application ${app.id}`}
                      >
                        Act
                      </button>
                      <button
                        className={`contract-btn ${app.payments && app.payments.length > 0 ? "enabled" : "disabled"}`}
                        onClick={() => app.payments && app.payments.length > 0 && handleActContractClick("Contract", app)}
                        disabled={!app.payments || app.payments.length === 0}
                        aria-label={`Contract for application ${app.id}`}
                      >
                        Contract
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {renderPagination()}
        </div>

        {showAddPopup && (
          <AddApplicationPopup onClose={() => setShowAddPopup(false)} onAdd={fetchApplications} />
        )}

        {showDocumentPopup && selectedApplicationId && (
          <AddDocumentPopup
            applicationId={selectedApplicationId}
            onClose={() => {
              setShowDocumentPopup(false);
              setSelectedApplicationId(null);
            }}
            onAdd={handleDocumentAdded}
          />
        )}

        {showPaymentPopup && selectedApplication && (
          <ApplicationPayment
            application={selectedApplication}
            onClose={() => {
              setShowPaymentPopup(false);
              setSelectedApplication(null);
            }}
            onSuccess={handlePaymentSuccess}
          />
        )}

        {showEmailPopup && (
          <div className="email-popup" onClick={() => setShowEmailPopup(false)}>
            <div className="email-content" onClick={(e) => e.stopPropagation()}>
              <div className="email-header">
                <h2 className="email-heading">New Email</h2>
                <button
                  className="close-btn"
                  onClick={() => setShowEmailPopup(false)}
                  aria-label="Close email popup"
                >
                  ×
                </button>
              </div>
              <div className="email-form">
                <p><strong>To:</strong> {emailRecipient}</p>
                <input
                  type="text"
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  placeholder="Subject"
                  className="email-input"
                  aria-label="Email subject"
                />
                <textarea
                  value={emailBody}
                  onChange={(e) => setEmailBody(e.target.value)}
                  placeholder="Type your message here..."
                  className="email-textarea"
                  aria-label="Email body"
                />
                {error && <div className="error-message" role="alert">{error}</div>}
                <button
                  className="send-email-btn"
                  onClick={handleSendEmail}
                  disabled={loading}
                  aria-label="Send email"
                >
                  {loading ? "Sending..." : "Send Email"}
                </button>
              </div>
            </div>
          </div>
        )}

        {selectedComment && (
          <div 
            className="comment-edit-popup" 
            onClick={(e) => e.stopPropagation()}
          >
            <div className="comment-edit-content" onClick={(e) => e.stopPropagation()}>
              <textarea
                value={editCommentText}
                onChange={(e) => setEditCommentText(e.target.value)}
                className="comment-edit-input"
                placeholder="Edit your comment..."
                aria-label="Edit comment input"
              />
              <div className="comment-edit-actions">
                <button 
                  className="comment-edit-save" 
                  onClick={() => handleEditCommentSubmit(selectedComment.applicationId, selectedComment._id)}
                  aria-label="Save edited comment"
                >
                  Save
                </button>
                <button 
                  className="comment-edt-close" 
                  onClick={() => {
                    setSelectedComment(null);
                    setEditCommentText("");
                  }}
                  aria-label="Close comment popup"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {showActContractPopup && (
          <div className="act-contract-popup" onClick={closeActContractPopup}>
            <div className="act-contract-popup-content" onClick={(e) => e.stopPropagation()}>
              <button 
                className="close-popup-btn" 
                onClick={closeActContractPopup}
                aria-label="Close Act/Contract popup"
              >
                <FaTimes />
              </button>
              <p className="popup-message">Come back soon 👷‍♂️ Under construction</p>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

export default Applications;