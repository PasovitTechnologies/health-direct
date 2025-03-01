import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import DashboardLayout from "./DashboardLayout";
import { FaArrowLeft } from "react-icons/fa"; // Only back icon needed
import "../styles/DoctorProfile.css";

function DoctorProfile() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [editMode, setEditMode] = useState(false);
  const [doctor, setDoctor] = useState(null);

  const slugParts = slug.split("-");
  const firstName = decodeURIComponent(slugParts[0] || "");
  const middleName = slugParts.length === 3 ? decodeURIComponent(slugParts[1]) : "";
  const lastName = decodeURIComponent(slugParts[slugParts.length - 1] || "");

  useEffect(() => {
    fetchDoctorByName(firstName, middleName, lastName);
  }, [firstName, middleName, lastName]);

  async function fetchDoctorByName(f, m, l) {
    try {
      const res = await axios.get("http://localhost:5001/api/doctors/by-name", {
        params: { firstName: f, middleName: m, lastName: l },
      });
      setDoctor(res.data);
    } catch (error) {
      console.error("Error fetching doctor by name:", error);
    }
  }

  function toggleEditMode() {
    setEditMode((prev) => !prev);
  }

  async function handleSave() {
    try {
      // Ensure fees.amount is handled as a number or null/empty string
      const updatedDoctor = { ...doctor };
      if (updatedDoctor.fees.amount === "") {
        updatedDoctor.fees.amount = null; // Send null to backend if empty
      } else {
        updatedDoctor.fees.amount = Number(updatedDoctor.fees.amount) || null; // Convert to number or null if invalid
      }

      await axios.put(`http://localhost:5001/api/doctors/${doctor._id}`, updatedDoctor);
      alert("Profile updated successfully!");
      setEditMode(false);
    } catch (error) {
      console.error("Error saving doctor:", error);
      alert("Failed to save doctor: " + error.message);
    }
  }

  if (!doctor) return <p>Loading...</p>;

  const handleChange = (field, value) => {
    // Handle fees.amount and fees.currency separately to ensure they update correctly
    if (field === "fees.amount") {
      setDoctor((prev) => ({
        ...prev,
        fees: { ...prev.fees, amount: value === "" ? "" : value }, // Allow empty string or number
      }));
    } else if (field === "fees.currency") {
      setDoctor((prev) => ({
        ...prev,
        fees: { ...prev.fees, currency: value },
      }));
    } else {
      setDoctor((prev) => ({ ...prev, [field]: value }));
    }
  };

  const handleServiceTypeChange = (type) => {
    setDoctor((prev) => ({
      ...prev,
      serviceType: prev.serviceType.includes(type)
        ? prev.serviceType.filter((t) => t !== type)
        : [...prev.serviceType, type],
    }));
  };

  const goBack = () => {
    navigate("/doctor");
  };

  return (
    <DashboardLayout initialActiveTab="Doctor">
      <div className="doctor-profile-container">
        <header className="doctor-profile-header">
          <button className="back-button" onClick={goBack} aria-label="Back to doctors list">
            <FaArrowLeft className="back-icon" />
          </button>
          <h1 className="doctor-profile-title">Doctor Profile</h1>
          {!editMode && (
            <button className="edit-btn" onClick={toggleEditMode} aria-label="Edit doctor profile">
              Edit Profile
            </button>
          )}
          {editMode && (
            <>
              <button className="cancel-btn" onClick={toggleEditMode} aria-label="Cancel editing">
                Cancel
              </button>
              <button className="save-btn" onClick={handleSave} aria-label="Save changes">
                Save Changes
              </button>
            </>
          )}
        </header>

        <div className="doctor-profile-content">
          <div className="profile-section">
            <label htmlFor="firstName">First Name</label>
            {editMode ? (
              <input
                id="firstName"
                type="text"
                value={doctor.firstName}
                onChange={(e) => handleChange("firstName", e.target.value)}
                className="profile-input"
                aria-label="First name"
              />
            ) : (
              <div className="profile-field">{doctor.firstName}</div>
            )}
          </div>
          <div className="profile-section">
            <label htmlFor="middleName">Middle Name</label>
            {editMode ? (
              <input
                id="middleName"
                type="text"
                value={doctor.middleName || ""}
                onChange={(e) => handleChange("middleName", e.target.value)}
                className="profile-input"
                aria-label="Middle name"
              />
            ) : (
              <div className="profile-field">{doctor.middleName || "N/A"}</div>
            )}
          </div>
          <div className="profile-section">
            <label htmlFor="lastName">Last Name</label>
            {editMode ? (
              <input
                id="lastName"
                type="text"
                value={doctor.lastName}
                onChange={(e) => handleChange("lastName", e.target.value)}
                className="profile-input"
                aria-label="Last name"
              />
            ) : (
              <div className="profile-field">{doctor.lastName}</div>
            )}
          </div>
          <div className="profile-section">
            <label htmlFor="specialty">Specialty</label>
            {editMode ? (
              <input
                id="specialty"
                type="text"
                value={doctor.specialty}
                onChange={(e) => handleChange("specialty", e.target.value)}
                className="profile-input"
                aria-label="Specialty"
              />
            ) : (
              <div className="profile-field">{doctor.specialty}</div>
            )}
          </div>
          <div className="profile-section">
            <label htmlFor="email">Email</label>
            {editMode ? (
              <input
                id="email"
                type="email"
                value={doctor.email}
                onChange={(e) => handleChange("email", e.target.value)}
                className="profile-input"
                aria-label="Email"
              />
            ) : (
              <div className="profile-field">{doctor.email}</div>
            )}
          </div>
          <div className="profile-section">
            <label htmlFor="phone">Phone</label>
            {editMode ? (
              <input
                id="phone"
                type="text"
                value={doctor.phone}
                onChange={(e) => handleChange("phone", e.target.value)}
                className="profile-input"
                aria-label="Phone"
              />
            ) : (
              <div className="profile-field">{doctor.phone}</div>
            )}
          </div>
          <div className="profile-section">
            <label>Service Type</label>
            {editMode ? (
              <div className="service-type-checkboxes">
                <label>
                  <input
                    type="checkbox"
                    checked={doctor.serviceType.includes("Online")}
                    onChange={() => handleServiceTypeChange("Online")}
                    aria-label="Online service"
                  />
                  <span>Online</span>
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={doctor.serviceType.includes("Offline")}
                    onChange={() => handleServiceTypeChange("Offline")}
                    aria-label="Offline service"
                  />
                  <span>Offline</span>
                </label>
              </div>
            ) : (
              <div className="profile-field">{doctor.serviceType.join(", ")}</div>
            )}
          </div>
          <div className="profile-section">
            <label>Fees</label>
            {editMode ? (
              <>
                <div className="form-group">
                  <label htmlFor="feesAmount">Amount</label>
                  <input
                    id="feesAmount"
                    type="text" // Keep as text to remove arrows
                    value={doctor.fees.amount === null || doctor.fees.amount === "" ? "" : doctor.fees.amount}
                    onChange={(e) => handleChange("fees.amount", e.target.value)}
                    className="profile-input"
                    placeholder="Enter fee amount" // Placeholder for blank entry
                    aria-label="Fees amount"
                    required
                    onKeyPress={(e) => {
                      // Allow only numbers and decimal point
                      if (!/[\d.]/.test(e.key)) {
                        e.preventDefault();
                      }
                    }}
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="feesCurrency">Currency</label>
                  <select
                    id="feesCurrency"
                    value={doctor.fees.currency}
                    onChange={(e) => handleChange("fees.currency", e.target.value)}
                    className="profile-input profile-select"
                    aria-label="Fees currency"
                    required
                  >
                    {["RUB", "INR", "EUR"].map(currency => (
                      <option key={currency} value={currency}>{currency}</option>
                    ))}
                  </select>
                </div>
              </>
            ) : (
              <div className="profile-field">{doctor.fees.amount ? `${doctor.fees.amount} ${doctor.fees.currency}` : "Not set"}</div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

export default DoctorProfile;