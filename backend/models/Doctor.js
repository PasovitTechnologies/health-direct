const mongoose = require("mongoose");

const doctorSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: true,
  },
  middleName: {
    type: String,
    required: false,
  },
  lastName: {
    type: String,
    required: true,
  },
  specialty: {
    type: String,
    required: true,
  },
  serviceType: {
    type: [String], // e.g. ["Online", "Offline"]
    required: true,
  },
  email: {
    type: String,
  },
  phone: {
    type: String, // not required
  },
  fees: {
    amount: {
      type: Number, // Numeric value for the fee amount
      required: false, // Made optional to allow null/empty
      min: 0, // Ensure no negative fees if present
      default: null, // Default to null instead of 0
    },
    currency: {
      type: String, // Currency code (e.g., RUB, INR, EUR)
      required: true,
      enum: ["RUB", "INR", "EUR"], // Limited to RUB, INR, EUR
      default: "RUB", // Default to RUB
    },
  },
}, {
  timestamps: true, // Add createdAt and updatedAt for tracking
});

module.exports = mongoose.model("Doctor", doctorSchema);