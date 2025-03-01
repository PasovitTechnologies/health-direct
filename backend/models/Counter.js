const mongoose = require("mongoose");

const counterSchema = new mongoose.Schema({
  monthlyCount: {
    type: Number,
    default: 0, // Reset to 0 at the start of each month
  },
  overallCount: {
    type: Number,
    default: 0, // Never resets
  },
  monthYear: {
    type: String, // Format MM/YYYY
    index: true, // For efficient queries
  },
});

module.exports = mongoose.model("Counter", counterSchema);