const mongoose = require("mongoose");

const paymentCounterSchema = new mongoose.Schema({
  sequence: {
    type: Number,
    default: 0,
  },
  monthlySequence: {
    type: Number,
    default: 0,
  },
  lastMonth: {
    type: String, // Format: "MM/YYYY"
    default: new Date().toISOString().substr(5, 7).replace("-", "/"), // e.g., "02/2025"
  },
});

module.exports = mongoose.model("PaymentCounter", paymentCounterSchema);