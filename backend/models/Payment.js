const mongoose = require("mongoose");

const serviceSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  price: {
    type: Number,
    required: true,
    min: 0.01, // Ensure price is positive
  },
  quantity: {
    type: Number,
    required: true,
    min: 1, // Ensure quantity is at least 1
  },
  totalAmount: {
    type: Number,
    required: true, // Ensure totalAmount is required
    min: 0.01, // Ensure total is positive
  },
});

const paymentSchema = new mongoose.Schema({
  invoiceNumber: {
    type: String,
    required: true,
    unique: true, // Ensure unique custom invoice numbers
    trim: true,
  },
  stripeInvoiceId: {
    type: String, // Store the Stripe-generated invoice ID
    trim: true,
    default: null, // Optional, can be null if not provided by Stripe
  },
  services: [serviceSchema], // Array of services with name, price, quantity, and totalAmount
  totalAmount: {
    type: Number,
    required: true,
    min: 0.01, // Ensure total amount is positive
  },
  paymentStatus: {
    type: String,
    required: true,
    enum: ["New", "In Process", "Paid", "Cancelled", "Free"], // Match your specified enums
    default: "New", // Default to "New" as requested
  },
  application: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Application",
    required: true, // Reference to the related application
  },
  doctor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Doctor",
    required: true, // Reference to the doctor for fee fetching
  },
  patient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Patient",
    required: true, // Reference to the patient for storage
  },
  comment: {
    type: String,
    trim: true,
    default: "", // Optional comment field
  },
  paymentUrl: {
    type: String, // Store the generated Stripe payment URL
    trim: true,
  },
  createdAt: {
    type: Date,
    default: Date.now, // Automatically set when created
    immutable: true, // Cannot be modified after creation
  },
  updatedAt: {
    type: Date,
    default: Date.now, // Automatically updated on modification
  },
  // Additional relevant fields
  currency: {
    type: String,
    required: true,
    enum: ["RUB", "INR", "EUR"], // Match doctor's currency options
    default: "INR", // Default to INR as per your Stripe code
  },
  expiryDate: {
    type: Date, // Store the payment link expiry (23 hours from creation)
    required: true,
  },
  transactionId: {
    type: String, // Store Stripe transaction ID if payment is completed
    trim: true,
    default: null,
  },
}, {
  timestamps: true, // Ensures createdAt and updatedAt are automatically managed
});

module.exports = mongoose.model("Payment", paymentSchema);