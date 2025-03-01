import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import dayjs from "dayjs"; // Import dayjs
import DashboardLayout from "./DashboardLayout";
import "../styles/Patient.css";
import {
  FaFilter,
  FaPlus,
  FaCheck,
} from "react-icons/fa";
import { MdClose } from "react-icons/md";

function Patient() {
  const navigate = useNavigate();
  const [showModal, setShowModal] = useState(false);
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [patients, setPatients] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");

  // Filter states: final selected filters (assuming Gender as the primary filter)
  const [selectedGenderFilters, setSelectedGenderFilters] = useState([]);
  // Temporary filter selections in the dropdown
  const [tempGenderFilters, setTempGenderFilters] = useState([]);

  // Fetch patients from backend
  const fetchPatients = async () => {
    try {
      const response = await axios.get("${BASE_URL}/api/patients");
      setPatients(response.data || []); // Ensure patients is always an array, even if empty
    } catch (error) {
      console.error("Error fetching patients:", error);
      setPatients([]); // Set to empty array on error to prevent undefined
    }
  };

  useEffect(() => {
    fetchPatients();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("authToken");
    navigate("/");
  };

  const openModal = () => setShowModal(true);
  const closeModal = () => {
    setShowModal(false);
    fetchPatients(); // Refresh table after adding a patient
  };

  // Toggle the filter dropdown
  const toggleFilterDropdown = () => setShowFilterDropdown((prev) => !prev);

  // Toggle an item in the "tempGenderFilters"
  const toggleTempGender = (gender) => {
    if (tempGenderFilters.includes(gender)) {
      setTempGenderFilters(tempGenderFilters.filter((g) => g !== gender));
    } else {
      setTempGenderFilters([...tempGenderFilters, gender]);
    }
  };

  // Apply button: copy temp selections into final filters
  const applyFilters = () => {
    setSelectedGenderFilters(tempGenderFilters);
    setShowFilterDropdown(false);
  };

  // Distinct genders from the data (assuming Gender is "Male", "Female", or "Other")
  const distinctGenders = Array.from(new Set((patients || []).map((patient) => patient.gender)));

  return (
    <DashboardLayout initialActiveTab="Patient">
      <header className="patient-header">
        <h1 className="patient-title">Patients</h1>
      </header>

      <div className="patient-divider"></div>

      <div className="patient-search-row" style={{ position: "relative" }}>
        <input
          type="search"
          placeholder="Search via name..."
          className="patient-search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          aria-label="Search patients by name"
        />
        <button className="filter-button" onClick={toggleFilterDropdown} aria-label="Open filter dropdown">
          <FaFilter className="filter-icon" /> Filter
        </button>

        {showFilterDropdown && (
          <div className="filter-dropdown-3d">
            <div className="filter-heading">FILTER OPTIONS</div>

            {/* Gender Section */}
            <div className="filter-section">
              <span className="filter-section-title">GENDER</span>
              {distinctGenders.length === 0 ? (
                <div className="filter-no-items">No genders found.</div>
              ) : (
                distinctGenders.map((gender) => (
                  <div
                    key={gender}
                    className={`filter-item-row ${
                      tempGenderFilters.includes(gender) ? "selected" : ""
                    }`}
                    onClick={() => toggleTempGender(gender)}
                    data-selected={tempGenderFilters.includes(gender) ? "true" : "false"}
                    aria-label={`Filter by ${gender} ${tempGenderFilters.includes(gender) ? '(selected)' : ''}`}
                  >
                    <span className="filter-item-name">{gender}</span>
                    {tempGenderFilters.includes(gender) && (
                      <FaCheck className="filter-check-icon" />
                    )}
                  </div>
                ))
              )}
            </div>

            <button className="apply-button" onClick={applyFilters} aria-label="Apply filters">
              Apply
            </button>
          </div>
        )}
      </div>

      <div className="patient-add-container">
        <button className="add-button" onClick={openModal} aria-label="Add new patient">
          <FaPlus className="add-icon" /> Add
        </button>
      </div>

      <PatientTable
        patients={patients}
        searchQuery={searchQuery}
        genderFilters={selectedGenderFilters}
      />

      {showModal && <AddPatientModal closeModal={closeModal} />}
    </DashboardLayout>
  );
}

export default Patient;

function PatientTable({ patients, searchQuery, genderFilters }) {
  const navigate = useNavigate();

  // Builds a slug from first, middle, and last name, or uses _id as fallback
  const handleRowClick = (patient) => {
    // Use _id for a reliable, unique identifier (preferred for routing)
    if (patient._id) {
      navigate(`/patient/${patient._id}`); // Use _id for exact matching
    } else {
      // Fallback: Use name-based slug if _id is unavailable (less reliable, but matches previous logic)
      const slugParts = [
        encodeURIComponent(patient.firstName),
        patient.middleName ? encodeURIComponent(patient.middleName) : null,
        encodeURIComponent(patient.lastName),
      ].filter(Boolean); // Remove null if middleName doesn't exist
      const slug = slugParts.join("-");
      navigate(`/patient/${slug}`);
    }
  };

  // Filter patients based on search and gender
  const filteredPatients = (patients || []).filter((patient) => {
    if (!patient) return false; // Skip undefined patients
    const fullName = `${patient.firstName || ""} ${patient.middleName || ""} ${
      patient.lastName || ""
    }`.toLowerCase();
    const matchesName = fullName.includes(searchQuery.toLowerCase());

    const matchesGender =
      genderFilters.length === 0 || genderFilters.includes(patient.gender);

    return matchesName && matchesGender;
  });

  return (
    <div className="patient-table-container">
      <table className="patient-table">
        <thead>
          <tr>
            <th aria-label="Serial number">S. No.</th>
            <th aria-label="Patient name">Name</th>
            <th aria-label="Patient gender">Gender</th>
            <th aria-label="Patient date of birth">Date of Birth</th>
            <th aria-label="Patient telephone">Telephone</th>
          </tr>
        </thead>
        <tbody>
          {filteredPatients.map((patient, index) => {
            if (!patient) return null; // Skip undefined patients
            const fullName = `${patient.firstName} ${
              patient.middleName ? patient.middleName + " " : ""
            }${patient.lastName}`;

            return (
              <tr key={patient._id} onClick={() => handleRowClick(patient)} aria-label={`Patient ${fullName}`}>
                <td>{index + 1}</td>
                <td>{fullName}</td>
                <td>{patient.gender || "N/A"}</td>
                <td>{dayjs(patient.dateOfBirth).format("MMMM D, YYYY") || "N/A"}</td>
                <td>{patient.telephone || "N/A"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* Modal Component for Adding Patient */
function AddPatientModal({ closeModal }) {
  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [lastName, setLastName] = useState("");
  const [gender, setGender] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [telephone, setTelephone] = useState("");
  const [additionalPhone, setAdditionalPhone] = useState("");
  const [email, setEmail] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!firstName || !lastName || !gender || !dateOfBirth || !telephone || !email) {
      alert("Please fill in all required fields! (First Name, Last Name, Gender, Date of Birth, Telephone, Email)");
      return;
    }
    try {
      const newPatient = {
        firstName,
        middleName,
        lastName,
        gender,
        dateOfBirth,
        telephone,
        additionalPhone,
        email,
      };
      await axios.post("${BASE_URL}/api/patients", newPatient);
      alert("Patient added successfully!");
      closeModal();
    } catch (error) {
      console.error("Error adding patient:", error);
      alert("Failed to add patient.");
    }
  };

  return (
    <div className="modal-overlay" aria-label="Add patient modal">
      <div className="modal-content">
        {/* Close Button */}
        <button className="close-button" onClick={closeModal} aria-label="Close modal">
          <MdClose className="close-icon" />
        </button>
        <h2>Add Patient</h2>
        <form onSubmit={handleSubmit} className="add-patient-form" aria-label="Patient form">
          {/* Name Section */}
          <div className="form-section">
            <h3 className="section-title">Name</h3>
            <hr className="section-divider" />
            <div className="name-row">
              <div className="form-group name-field">
                <label>
                  First Name <span>*</span>
                </label>
                <input
                  type="text"
                  placeholder="Enter first name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                  aria-label="First name"
                />
              </div>
              <div className="form-group name-field">
                <label>Middle Name</label>
                <input
                  type="text"
                  placeholder="Enter middle name (optional)"
                  value={middleName}
                  onChange={(e) => setMiddleName(e.target.value)}
                  aria-label="Middle name"
                />
              </div>
              <div className="form-group name-field">
                <label>
                  Last Name <span>*</span>
                </label>
                <input
                  type="text"
                  placeholder="Enter last name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                  aria-label="Last name"
                />
              </div>
            </div>
          </div>

          {/* Gender Section */}
          <div className="form-section">
            <h3 className="section-title">Gender</h3>
            <hr className="section-divider" />
            <div className="form-group">
              <label>
                Gender <span>*</span>
              </label>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                required
                className="patient-select"
                aria-label="Select gender"
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
            <h3 className="section-title">Date of Birth</h3>
            <hr className="section-divider" />
            <div className="form-group">
              <label>
                Date of Birth <span>*</span>
              </label>
              <input
                type="date"
                value={dateOfBirth}
                onChange={(e) => setDateOfBirth(e.target.value)}
                required
                aria-label="Date of birth"
              />
            </div>
          </div>

          {/* Contact Information Section */}
          <div className="form-section">
            <h3 className="section-title">Contact Information</h3>
            <hr className="section-divider" />
            <div className="form-group">
              <label>
                Telephone <span>*</span>
              </label>
              <input
                type="tel"
                placeholder="Enter telephone number"
                value={telephone}
                onChange={(e) => setTelephone(e.target.value)}
                required
                aria-label="Telephone"
              />
            </div>
            <div className="form-group">
              <label>Additional Phone</label>
              <input
                type="tel"
                placeholder="Optional additional phone number"
                value={additionalPhone}
                onChange={(e) => setAdditionalPhone(e.target.value)}
                aria-label="Additional phone"
              />
            </div>
            <div className="form-group">
              <label>
                Email <span>*</span>
              </label>
              <input
                type="email"
                placeholder="patient@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                aria-label="Email"
              />
            </div>
          </div>

          <div className="modal-actions">
            <button type="submit" className="submit-btn" aria-label="Submit patient form">
              Submit
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}