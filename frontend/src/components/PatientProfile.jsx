import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import dayjs from "dayjs"; // Import dayjs for date formatting
import DashboardLayout from "./DashboardLayout";
import "../styles/PatientProfile.css";
import { FaArrowLeft, FaEdit, FaFilePdf, FaTimes } from "react-icons/fa";
import EditGeneralProfile from "./EditGeneralProfile"; // Import new general edit component
import EditMedicalProfile from "./EditMedicalProfile"; // Import new medical edit component

function PatientProfile() {
  const { id } = useParams(); // Get the patient ID from the URL
  const navigate = useNavigate();
  const [patient, setPatient] = useState(null);
  const [medical, setMedical] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("general"); // Default to General Details
  const [applicationHistory, setApplicationHistory] = useState([]); // Store application history
  const [selectedApplication, setSelectedApplication] = useState(null); // Track selected application for popup

  // Fetch patient, medical data, and application history based on patient ID
  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch patient data
        const patientResponse = await axios.get(`${BASE_URL}/api/patients/${id}`);
        const foundPatient = patientResponse.data;

        if (!foundPatient) {
          throw new Error("Patient not found");
        }

        setPatient(foundPatient);

        // Fetch medical data with populated media
        try {
          const medicalResponse = await axios.get(`${BASE_URL}/api/patients/${id}/medical`);
          setMedical(medicalResponse.data || { medicalHistory: "", medicalComments: "", media: [] });
        } catch (medicalError) {
          if (medicalError.response && medicalError.response.status === 404) {
            // Create default medical record if not found
            const newMedical = await axios.put(`${BASE_URL}/api/patients/${id}/medical`, {
              medicalHistory: "",
              medicalComments: "",
              media: [],
            });
            setMedical(newMedical.data.medical);
          } else {
            throw medicalError;
          }
        }

        // Fetch application history for the patient using the improved route
        const historyResponse = await axios.get(`${BASE_URL}/api/applications/patient/${id}/history`);
        setApplicationHistory(historyResponse.data.applications || []);
      } catch (err) {
        setError(err.message || "Error fetching patient data or history");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id]);

  // Function to generate Blob URL for medical media
  const getMediaBlobUrl = async (mediaId) => {
    try {
      const response = await axios.get(`${BASE_URL}/api/patients/${id}/medical/media/${mediaId}`, {
        responseType: 'blob', // Ensure binary data is received as Blob
      });
      return URL.createObjectURL(new Blob([response.data], { type: response.headers['content-type'] }));
    } catch (error) {
      console.error("Error fetching medical media Blob:", error);
      return null;
    }
  };

  // Function to preview application document
  const previewApplicationDocument = async (doc) => {
    if (doc.url) {
      window.open(doc.url, "_blank");
    } else {
      const response = await axios.get(`${BASE_URL}/api/applications/media/${doc._id}`, {
        responseType: 'blob',
      });
      const blobUrl = URL.createObjectURL(new Blob([response.data], { type: response.headers['content-type'] }));
      window.open(blobUrl, "_blank");
    }
  };

  // Handle click on application box to open popup
  const handleBubbleClick = (application) => {
    setSelectedApplication(application);
  };

  // Handle click on application ID in popup to navigate to applications page
  const handleApplicationIdClick = () => {
    navigate(`/applications`);
  };

  // Close the popup
  const closePopup = () => {
    setSelectedApplication(null);
  };

  if (loading) {
    return (
      <DashboardLayout initialActiveTab="Patient">
        <div className="loading-spinner">Loading patient profile...</div>
      </DashboardLayout>
    );
  }

  if (error || !patient) {
    return (
      <DashboardLayout initialActiveTab="Patient">
        <div className="error-message" role="alert">
          {error || "Patient not found or data is missing."}
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout initialActiveTab="Patient">
      <div className="patient-profile-container">
        <header className="patient-profile-header">
          <button className="back-button" onClick={() => navigate("/patients")} aria-label="Back to patients list">
            <FaArrowLeft className="back-icon" />
          </button>
        </header>

        <h1 className="patient-profile-title">Patient Profile</h1>

        <div className="patient-profile-tabs">
          <button
            className={`tab-button ${activeTab === "general" ? "active" : ""}`}
            onClick={() => setActiveTab("general")}
            aria-label="General Details tab"
          >
            General Details
          </button>
          <button
            className={`tab-button ${activeTab === "medical" ? "active" : ""}`}
            onClick={() => setActiveTab("medical")}
            aria-label="Medical Information tab"
          >
            Medical Information
          </button>
          <button
            className={`tab-button ${activeTab === "appointments" ? "active" : ""}`}
            onClick={() => setActiveTab("appointments")}
            aria-label="Appointments tab"
          >
            Appointments
          </button>
        </div>

        <div className="patient-profile-content">
          {activeTab === "general" && (
            <div className="profile-details">
              {/* Name Section */}
              <div className="profile-section">
                <h2 className="section-title">Name</h2>
                <p className="profile-field">
                  <span className="field-label">Full Name:</span> {`${patient.firstName} ${patient.middleName || ""} ${patient.lastName}`}
                </p>
              </div>

              {/* Gender Section */}
              <div className="profile-section">
                <h2 className="section-title">Gender</h2>
                <p className="profile-field">
                  <span className="field-label">Gender:</span> {patient.gender}
                </p>
              </div>

              {/* Date of Birth Section */}
              <div className="profile-section">
                <h2 className="section-title">Date of Birth</h2>
                <p className="profile-field">
                  <span className="field-label">Date of Birth:</span> {dayjs(patient.dateOfBirth).format("MMMM D, YYYY")}
                </p>
              </div>

              {/* Contact Information Section */}
              <div className="profile-section">
                <h2 className="section-title">Contact Information</h2>
                <p className="profile-field">
                  <span className="field-label">Telephone:</span> {patient.telephone}
                </p>
                <p className="profile-field">
                  <span className="field-label">Additional Phone:</span> {patient.additionalPhone || <em className="none-text">none</em>}
                </p>
                <p className="profile-field">
                  <span className="field-label">Email:</span> {patient.email}
                </p>
              </div>

              {/* Comments Section (View Mode) */}
              <div className="profile-section">
                <h2 className="section-title">Comments</h2>
                <p className="profile-field">
                  <span className="field-label">Comments:</span> {patient.comments || <em className="none-text">none</em>}
                </p>
              </div>
              <button
                className="edit-btn"
                onClick={() => setActiveTab("edit-general")}
                aria-label="Edit patient information"
              >
                <FaEdit className="action-icon" /> Edit
              </button>
            </div>
          )}
          {activeTab === "medical" && (
            <div className="profile-details">
              <div className="profile-section">
                <h2 className="section-title">Medical History</h2>
                <p className="profile-field">
                  <span className="field-label">History:</span> {medical?.medicalHistory || <em className="none-text">none</em>}
                </p>
              </div>
              <div className="profile-section">
                <h2 className="section-title">Medical Comments</h2>
                <p className="profile-field">
                  <span className="field-label">Comments:</span> {medical?.medicalComments || <em className="none-text">none</em>}
                </p>
              </div>
              <div className="profile-section">
                <h2 className="section-title">Media</h2>
                {medical?.media?.length > 0 ? (
                  <ul className="media-list">
                    {medical.media.map((mediaId, index) => (
                      <li 
                        key={index} 
                        className="media-item" 
                        onClick={async () => {
                          const blobUrl = await getMediaBlobUrl(mediaId);
                          if (blobUrl) {
                            window.open(blobUrl, '_blank');
                          }
                        }}
                        style={{ cursor: 'pointer', color: '#37b8c0', display: 'flex', alignItems: 'center', gap: '10px' }}
                      >
                        {`Media ${index + 1}`}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="profile-field">
                    <span className="field-label">Media:</span> <em className="none-text">none</em>
                  </p>
                )}
              </div>
              <button
                className="edit-btn"
                onClick={() => setActiveTab("edit-medical")}
                aria-label="Edit medical information"
              >
                <FaEdit className="action-icon" /> Edit
              </button>
            </div>
          )}
          {activeTab === "appointments" && (
            <div className="profile-details">
              <h2 className="section-title">Appointment History</h2>
              {applicationHistory.length > 0 ? (
                <div className="appointment-boxes-container">
                  {applicationHistory.map((app, index) => (
                    <div 
                      key={index} 
                      className="appointment-box"
                      onClick={() => handleBubbleClick(app)}
                    >
                      <span className="box-text">
                        Application ID: {app.id} - {app.serviceType}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="no-appointments">No appointment history available.</p>
              )}
            </div>
          )}
          {activeTab === "edit-general" && (
            <EditGeneralProfile 
              patient={patient} 
              onCancel={() => setActiveTab("general")} 
              onSave={(updatedPatient) => {
                setPatient(updatedPatient);
                setActiveTab("general");
              }} 
            />
          )}
          {activeTab === "edit-medical" && (
            <EditMedicalProfile 
              patient={patient} 
              medical={medical} 
              onCancel={() => setActiveTab("medical")} 
              onSave={(updatedMedical) => {
                setMedical(updatedMedical);
                setActiveTab("medical");
              }} 
            />
          )}
        </div>

        {/* Popup for Expanded Application Details */}
        {selectedApplication && (
          <div className="application-popup" onClick={closePopup}>
            <div className="application-popup-content" onClick={(e) => e.stopPropagation()}>
              <button 
                className="close-popup-btn" 
                onClick={closePopup}
                aria-label="Close application details popup"
              >
                <FaTimes />
              </button>
              <h3 
                className="popup-title" 
                onClick={handleApplicationIdClick}
                style={{ cursor: 'pointer', color: '#37b8c0' }}
                aria-label={`Navigate to application ${selectedApplication.id}`}
              >
                Application ID: {selectedApplication.id}
              </h3>
              <p><strong>Doctor:</strong> {`${selectedApplication.doctor.firstName} ${selectedApplication.doctor.middleName || ""} ${selectedApplication.doctor.lastName || ""}` || "N/A"}</p>
              <p><strong>Specialty:</strong> {selectedApplication.specialty || "N/A"}</p>
              <p><strong>Mode:</strong> {selectedApplication.appointmentMode}</p>
              <p><strong>Status:</strong> {selectedApplication.appointmentStatus}</p>
              <p><strong>Date:</strong> {dayjs(selectedApplication.recordDate).format("MMMM D, YYYY, h:mm A")}</p>
              <p><strong>Payment Status:</strong> {selectedApplication.paymentStatus}</p>
              <p><strong>Comments:</strong> {selectedApplication.comments || "None"}</p>

              <h4 className="payment-history-heading">Payment Details</h4>
              {selectedApplication.payments && selectedApplication.payments.length > 0 ? (
                <div className="payment-details">
                  {selectedApplication.payments.map((payment, paymentIndex) => (
                    <div key={paymentIndex} className="payment-item">
                      <p><strong>Invoice #:</strong> {payment.invoiceNumber}</p>
                      <p><strong>Status:</strong> {payment.paymentStatus}</p>
                      <p><strong>Total Amount:</strong> {payment.totalAmount} {payment.currency}</p>
                      <p><strong>Date:</strong> {dayjs(payment.createdAt).format("MMMM D, YYYY")}</p>
                      {payment.paymentUrl && <p><strong>Payment Link:</strong> <a href={payment.paymentUrl} target="_blank" rel="noopener noreferrer">View Link</a></p>}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="no-payments">No payment history available.</p>
              )}

              <h4 className="documents-heading">Attached Documents</h4>
              {selectedApplication.documents && selectedApplication.documents.length > 0 ? (
                <div className="document-list">
                  {selectedApplication.documents.map((doc, docIndex) => (
                    <div key={docIndex} className="document-item" onClick={() => previewApplicationDocument(doc)}>
                      <FaFilePdf className="document-icon" />
                      <span className="document-name">{doc.filename || `Document ${docIndex + 1}`}</span>
                      <span className="document-action">
                        {doc.url ? "Link" : "View"}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="no-documents">No documents attached.</p>
              )}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

export default PatientProfile;