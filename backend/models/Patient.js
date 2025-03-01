const mongoose = require("mongoose");

const patientSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: true,
    trim: true,
  },
  middleName: {
    type: String,
    trim: true,
  },
  lastName: {
    type: String,
    required: true,
    trim: true,
  },
  gender: {
    type: String,
    required: true,
    enum: ["Male", "Female", "Other"],
    trim: true,
  },
  dateOfBirth: {
    type: String, // Storing as YYYY-MM-DD string for simplicity
    required: true,
    validate: {
      validator: (v) => /^\d{4}-\d{2}-\d{2}$/.test(v),
      message: "Invalid date format. Use YYYY-MM-DD.",
    },
  },
  telephone: {
    type: String,
    required: true,
    trim: true,
  },
  additionalPhone: {
    type: String,
    trim: true,
  },
  email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true,
    validate: {
      validator: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
      message: "Invalid email format.",
    },
  },
  comments: {
    type: String,
    default: "", // Empty by default, only editable in profile
    trim: true,
  },
  applications: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "Application", // Reference to all applications for this patient
  }],
}, {
  timestamps: true, // Add createdAt and updatedAt fields
});

module.exports = mongoose.model("Patient", patientSchema);