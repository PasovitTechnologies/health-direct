const mongoose = require("mongoose");

const appointmentSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true }, // Maps to Application.id
  patientName: { type: String, required: true }, // Full name from Patient
  doctorName: { type: String, required: true }, // Full name from Doctor
  specialty: { type: String, required: true }, // From Application.specialty
  appointmentMode: { type: String, required: true, enum: ["Online", "Offline"] }, // From Application.appointmentMode
  startTime: { type: String, required: true }, // HH:MM (e.g., "09:00")
  endTime: { type: String, required: true }, // HH:MM (e.g., "10:00")
  date: { type: String, required: true }, // YYYY-MM-DD (e.g., "2025-02-28")
  appointmentStatus: { type: String, required: true, enum: ["New", "In Process", "Old", "Cancelled"] }, // From Application.appointmentStatus
}, {
  timestamps: true, // Add createdAt and updatedAt
});

module.exports = mongoose.model("Appointment", appointmentSchema);