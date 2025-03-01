import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import DashboardLayout from "./DashboardLayout";
import "../styles/Doctor.css";
import {
  FaFilter,
  FaPlus,
  FaCheck,
} from "react-icons/fa";
import { MdClose } from "react-icons/md";

function Doctor() {
  const navigate = useNavigate();
  const [showModal, setShowModal] = useState(false);
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [doctors, setDoctors] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");

  // Filter states: final selected filters
  const [selectedSpecialtyFilters, setSelectedSpecialtyFilters] = useState([]);
  const [selectedServiceTypeFilters, setSelectedServiceTypeFilters] = useState([]);
  // Temporary filter selections in the dropdown
  const [tempSpecialtyFilters, setTempSpecialtyFilters] = useState([]);
  const [tempServiceTypeFilters, setTempServiceTypeFilters] = useState([]);

  // Fetch doctors from backend
  const fetchDoctors = async () => {
    try {
      const response = await axios.get("${BASE_URL}/api/doctors");
      setDoctors(response.data);
    } catch (error) {
      console.error("Error fetching doctors:", error);
    }
  };

  useEffect(() => {
    fetchDoctors();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("authToken");
    navigate("/");
  };

  const openModal = () => setShowModal(true);
  const closeModal = () => {
    setShowModal(false);
    fetchDoctors(); // refresh table after adding a doctor
  };

  // Toggle the filter dropdown
  const toggleFilterDropdown = () => setShowFilterDropdown((prev) => !prev);

  // Toggle an item in the "tempSpecialtyFilters"
  const toggleTempSpecialty = (spec) => {
    if (tempSpecialtyFilters.includes(spec)) {
      setTempSpecialtyFilters(tempSpecialtyFilters.filter((s) => s !== spec));
    } else {
      setTempSpecialtyFilters([...tempSpecialtyFilters, spec]);
    }
  };

  // Toggle an item in the "tempServiceTypeFilters"
  const toggleTempServiceType = (st) => {
    if (tempServiceTypeFilters.includes(st)) {
      setTempServiceTypeFilters(tempServiceTypeFilters.filter((s) => s !== st));
    } else {
      setTempServiceTypeFilters([...tempServiceTypeFilters, st]);
    }
  };

  // Apply button: copy temp selections into final filters
  const applyFilters = () => {
    setSelectedSpecialtyFilters(tempSpecialtyFilters);
    setSelectedServiceTypeFilters(tempServiceTypeFilters);
    setShowFilterDropdown(false);
  };

  // Distinct specialties and service types from the data
  const distinctSpecialties = Array.from(new Set(doctors.map((doc) => doc.specialty)));
  const distinctServiceTypes = Array.from(new Set(doctors.flatMap((doc) => doc.serviceType)));

  return (
    <DashboardLayout initialActiveTab="Doctor">
      <header className="doctor-header">
        <h1 className="doctor-title">Doctors</h1>
      </header>

      <div className="doctor-divider"></div>

      <div className="doctor-search-row" style={{ position: "relative" }}>
        <input
          type="search"
          placeholder="Search via name..."
          className="doctor-search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          aria-label="Search doctors by name"
        />
        <button className="filter-button" onClick={toggleFilterDropdown} aria-label="Open filter dropdown">
          <FaFilter className="filter-icon" /> Filter
        </button>

        {showFilterDropdown && (
          <div className="filter-dropdown-3d">
            <div className="filter-heading">FILTER OPTIONS</div>

            {/* Specialty Section */}
            <div className="filter-section">
              <span className="filter-section-title">SPECIALTIES</span>
              {distinctSpecialties.length === 0 ? (
                <div className="filter-no-items">No specialties found.</div>
              ) : (
                distinctSpecialties.map((spec) => (
                  <div
                    key={spec}
                    className={`filter-item-row ${
                      tempSpecialtyFilters.includes(spec) ? "selected" : ""
                    }`}
                    onClick={() => toggleTempSpecialty(spec)}
                    data-selected={tempSpecialtyFilters.includes(spec) ? "true" : "false"}
                    aria-label={`Filter by specialty ${spec} ${tempSpecialtyFilters.includes(spec) ? '(selected)' : ''}`}
                  >
                    <span className="filter-item-name">{spec}</span>
                    {tempSpecialtyFilters.includes(spec) && (
                      <FaCheck className="filter-check-icon" />
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Service Type Section */}
            <div className="filter-section">
              <span className="filter-section-title">SERVICE TYPE</span>
              {distinctServiceTypes.length === 0 ? (
                <div className="filter-no-items">No service types found.</div>
              ) : (
                distinctServiceTypes.map((st) => (
                  <div
                    key={st}
                    className={`filter-item-row ${
                      tempServiceTypeFilters.includes(st) ? "selected" : ""
                    }`}
                    onClick={() => toggleTempServiceType(st)}
                    data-selected={tempServiceTypeFilters.includes(st) ? "true" : "false"}
                    aria-label={`Filter by service type ${st} ${tempServiceTypeFilters.includes(st) ? '(selected)' : ''}`}
                  >
                    <span className="filter-item-name">{st}</span>
                    {tempServiceTypeFilters.includes(st) && (
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

      <div className="doctor-add-container">
        <button className="add-button" onClick={openModal} aria-label="Add new doctor">
          <FaPlus className="add-icon" /> Add
        </button>
      </div>

      <DoctorTable
        doctors={doctors}
        searchQuery={searchQuery}
        specialtyFilters={selectedSpecialtyFilters}
        serviceTypeFilters={selectedServiceTypeFilters}
      />

      {showModal && <AddDoctorModal closeModal={closeModal} />}
    </DashboardLayout>
  );
}

export default Doctor;

function DoctorTable({ doctors, searchQuery, specialtyFilters, serviceTypeFilters }) {
  const navigate = useNavigate();

  // Builds a slug from first, middle, and last
  const handleRowClick = (doctor) => {
    const slugParts = [
      encodeURIComponent(doctor.firstName),
      doctor.middleName ? encodeURIComponent(doctor.middleName) : null,
      encodeURIComponent(doctor.lastName),
    ].filter(Boolean); // remove null if middleName doesn't exist
    const slug = slugParts.join("-");
    navigate(`/doctor/${slug}`);
  };

  // Filter doctors based on search, specialty, and service type
  const filteredDoctors = doctors.filter((doctor) => {
    const fullName = `${doctor.firstName} ${doctor.middleName ? doctor.middleName + " " : ""}${doctor.lastName}`.toLowerCase();
    const matchesName = fullName.includes(searchQuery.toLowerCase());

    const matchesSpecialty =
      specialtyFilters.length === 0 || specialtyFilters.includes(doctor.specialty);

    const matchesServiceType =
      serviceTypeFilters.length === 0 ||
      doctor.serviceType.some((st) => serviceTypeFilters.includes(st));

    // Add fees filtering if needed (e.g., by amount or currency)
    return matchesName && matchesSpecialty && matchesServiceType;
  });

  return (
    <div className="doctor-table-container">
      <table className="doctor-table">
        <thead>
          <tr>
            <th aria-label="Serial number">S. No.</th>
            <th aria-label="Doctor name">Name</th>
            <th aria-label="Doctor specialty">Specialty</th>
            <th aria-label="Doctor service type">Service-Type</th>
            <th aria-label="Doctor fees">Fees</th> {/* New column for fees */}
          </tr>
        </thead>
        <tbody>
          {filteredDoctors.map((doctor, index) => {
            const fullName = `${doctor.firstName} ${
              doctor.middleName ? doctor.middleName + " " : ""
            }${doctor.lastName}`;

            return (
              <tr key={doctor._id} onClick={() => handleRowClick(doctor)} aria-label={`Doctor ${fullName}`}>
                <td>{index + 1}</td>
                <td>{fullName}</td>
                <td>{doctor.specialty}</td>
                <td>{doctor.serviceType.join(", ")}</td>
                <td>{`${doctor.fees.amount} ${doctor.fees.currency}`}</td> {/* Display fees */}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* Modal Component for Adding Doctor with Split Name Fields */
function AddDoctorModal({ closeModal }) {
  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [lastName, setLastName] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [serviceType, setServiceType] = useState([]);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [fees, setFees] = useState({ amount: 0, currency: "RUB" }); // Updated default to RUB

  const handleCheckboxChange = (e) => {
    const { value, checked } = e.target;
    if (checked) {
      setServiceType((prev) => [...prev, value]);
    } else {
      setServiceType((prev) => prev.filter((item) => item !== value));
    }
  };

  const handleFeesChange = (e) => {
    const { name, value } = e.target;
    setFees((prev) => ({
      ...prev,
      [name]: name === "amount" ? Number(value) || 0 : value, // Ensure amount is a number
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!firstName || !lastName || !specialty || serviceType.length === 0 || !email) {
      alert("Please fill in all required fields! (First Name, Last Name, Specialty, Service Type, Email)");
      return;
    }
    try {
      const newDoctor = { 
        firstName, 
        middleName, 
        lastName, 
        specialty, 
        serviceType, 
        email, 
        phone,
        fees, // Include fees in the payload
      };
      await axios.post("${BASE_URL}/api/doctors", newDoctor);
      alert("Doctor added successfully!");
      closeModal();
    } catch (error) {
      console.error("Error adding doctor:", error);
      alert("Failed to add doctor: " + error.message);
    }
  };

  return (
    <div className="modal-overlay" aria-label="Add doctor modal">
      <div className="modal-content">
        {/* Close Button */}
        <button className="close-button" onClick={closeModal} aria-label="Close modal">
          <MdClose className="close-icon" />
        </button>
        <h2>Add Doctor</h2>
        <form onSubmit={handleSubmit} className="add-doctor-form" aria-label="Doctor form">
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

          {/* Specialty Section */}
          <div className="form-section">
            <h3 className="section-title">Specialty</h3>
            <hr className="section-divider" />
            <div className="form-group">
              <label>
                Specialty <span>*</span>
              </label>
              <input
                type="text"
                placeholder="E.g. Cardiology"
                value={specialty}
                onChange={(e) => setSpecialty(e.target.value)}
                required
                aria-label="Specialty"
              />
            </div>
          </div>

          {/* Service Type Section */}
          <div className="form-section">
            <h3 className="section-title">Service Type</h3>
            <hr className="section-divider" />
            <div className="form-group">
              <label>
                Service Type <span>*</span>
              </label>
              <div className="checkbox-group">
                <label>
                  <input
                    type="checkbox"
                    value="Online"
                    checked={serviceType.includes("Online")}
                    onChange={handleCheckboxChange}
                    aria-label="Online service"
                  />
                  <span>Online</span>
                </label>
                <label>
                  <input
                    type="checkbox"
                    value="Offline"
                    checked={serviceType.includes("Offline")}
                    onChange={handleCheckboxChange}
                    aria-label="Offline service"
                  />
                  <span>Offline</span>
                </label>
              </div>
            </div>
          </div>

          {/* Contact Information Section */}
          <div className="form-section">
            <h3 className="section-title">Contact Information</h3>
            <hr className="section-divider" />
            <div className="form-group">
              <label>
                Email <span>*</span>
              </label>
              <input
                type="email"
                placeholder="doctor@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                aria-label="Email"
              />
            </div>
            <div className="form-group">
              <label>Phone</label>
              <input
                type="text"
                placeholder="Optional phone number"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                aria-label="Phone"
              />
            </div>
          </div>

          {/* Fees Section */}
          <div className="form-section">
            <h3 className="section-title">Fees</h3>
            <hr className="section-divider" />
            <div className="form-group">
              <label>
                Amount <span>*</span>
              </label>
              <input
                type="number"
                name="amount"
                value={fees.amount}
                onChange={handleFeesChange}
                min="0"
                placeholder="Enter fee amount"
                required
                className="doctor-input"
                aria-label="Fees amount"
              />
            </div>
            <div className="form-group">
              <label>
                Currency <span>*</span>
              </label>
              <select
                name="currency"
                value={fees.currency}
                onChange={handleFeesChange}
                required
                className="doctor-select"
                aria-label="Fees currency"
              >
                {["RUB", "INR", "EUR"].map(currency => ( // Updated to RUB, INR, EUR
                  <option key={currency} value={currency}>{currency}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="modal-actions">
            <button type="submit" className="submit-btn" aria-label="Submit doctor form">
              Submit
            </button>
            <button type="button" onClick={closeModal} className="cancel-btn" aria-label="Cancel">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}