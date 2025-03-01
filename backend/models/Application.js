const mongoose = require("mongoose");

const applicationSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true,
  },
  patient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Patient",
    required: true,
  },
  serviceType: {
    type: String,
    required: true,
    enum: ["Consultation", "Follow-up", "Procedure", "Other"],
  },
  doctor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Doctor",
    required: true,
  },
  specialty: {
    type: String,
    required: true,
  },
  appointmentMode: {
    type: String,
    required: true,
    enum: ["Online", "Offline"],
  },
  appointmentStatus: {
    type: String,
    required: true,
    enum: ["New", "In Process", "Old", "Cancelled"],
  },
  meetingLink: {
    type: String,
  },
  recordDate: {
    type: Date,
    required: true,
  },
  paymentStatus: {
    type: String,
    required: true,
    enum: ["new", "invoice-sent", "paid", "cancelled", "free"],
  },
  comments: {
    type: String,
    default: "",
  },
  previousComments: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "Comment",
  }], // Array of Comment _id references
  documents: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "Media",
  }],
  payments: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "Payment", // Reference to the Payment model
  }],
}, {
  timestamps: true, // Add createdAt and updatedAt
});

module.exports = mongoose.model("Application", applicationSchema);