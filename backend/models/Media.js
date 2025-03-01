const mongoose = require("mongoose");

const mediaSchema = new mongoose.Schema({
  filename: {
    type: String,
    required: true,
  },
  data: {
    type: Buffer, // Store file content as binary data
    required: function () {
      return !this.url; // Required if no URL is provided
    },
  },
  url: {
    type: String, // URL if hosted online (e.g., Google Drive)
    default: null,
  },
  mimetype: {
    type: String, // MIME type (e.g., "application/pdf")
    required: function () {
      return !this.url; // Required if no URL is provided
    },
  },
  size: {
    type: Number, // File size in bytes
    required: function () {
      return !this.url; // Required if no URL is provided
    },
  },
  application: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Application",
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("Media", mediaSchema);