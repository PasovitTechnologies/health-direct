const mongoose = require("mongoose");

const medicalSchema = new mongoose.Schema({
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Patient",
    required: true,
  },
  medicalHistory: {
    type: String,
    default: "",
  },
  medicalComments: {
    type: String,
    default: "",
  },
  media: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "Media", // Reference to Media documents
  }],
}, {
  timestamps: true,
});

module.exports = mongoose.model("Medical", medicalSchema);