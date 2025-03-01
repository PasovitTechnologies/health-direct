const express = require("express");
const router = express.Router();
const Payment = require("../models/Payment");
const Application = require("../models/Application");
const Patient = require("../models/Patient");
const Doctor = require("../models/Doctor");
const stripeRoutes = require("./stripe-routes"); // Import Stripe routes
const nodemailer = require("nodemailer"); // Add nodemailer for email
const mongoose = require("mongoose"); // Import mongoose for ObjectId validation
require("dotenv").config();

// Configure SMTP transporter (using Gmail as an example; adjust for your email service)
const transporter = nodemailer.createTransport({
  service: "gmail", // Use your email service (e.g., Gmail, Outlook)
  auth: {
    user: process.env.EMAIL_USER, // Your email address (e.g., from .env)
    pass: process.env.EMAIL_PASSWORD, // Your email password or app-specific password
  },
});

// Mount Stripe routes under /stripe (optional, for organization)
router.use("/stripe", stripeRoutes);

// POST create a payment/invoice for an application
router.post("/applications/:applicationId/invoice", async (req, res) => {
  try {
    const { applicationId } = req.params;
    const { services, totalAmount, comment, paymentUrl, stripeInvoiceId } = req.body; // Added stripeInvoiceId to request body

    // Validate application exists
    if (!mongoose.Types.ObjectId.isValid(applicationId)) {
      return res.status(400).json({ message: "Invalid application ID format" });
    }

    const application = await Application.findById(applicationId);
    if (!application) {
      return res.status(404).json({ message: "Application not found" });
    }

    // Validate doctor and patient references
    const doctor = await Doctor.findById(application.doctor);
    if (!doctor) {
      return res.status(404).json({ message: "Doctor not found" });
    }

    const patient = await Patient.findById(application.patient);
    if (!patient) {
      return res.status(404).json({ message: "Patient not found" });
    }

    // Calculate totalAmount for each service if not provided
    const processedServices = services.map(service => ({
      ...service,
      totalAmount: service.price * service.quantity, // Calculate totalAmount dynamically
    }));

    // Recalculate totalAmount for the payment to ensure consistency
    const calculatedTotalAmount = processedServices.reduce((sum, service) => sum + service.totalAmount, 0);

    // Generate custom invoice number
    const customInvoiceNumber = await generateInvoiceId();

    // Calculate expiry date (23 hours from now, as per Stripe)
    const expiryDate = new Date(Date.now() + 23 * 60 * 60 * 1000);

    // Create new payment document
    const newPayment = new Payment({
      invoiceNumber: customInvoiceNumber, // Use custom invoice number as primary
      stripeInvoiceId: stripeInvoiceId || null, // Store Stripe invoice ID (optional)
      services: processedServices,
      totalAmount: calculatedTotalAmount,
      paymentStatus: "New", // Default to "New" (remove status from request body handling for simplicity)
      application: applicationId,
      doctor: application.doctor,
      patient: application.patient,
      comment: comment || "",
      paymentUrl: paymentUrl || "",
      currency: "INR", // Default to INR as per your Stripe setup
      expiryDate,
    });

    const savedPayment = await newPayment.save();

    // Update the application's payments array
    application.payments.push(savedPayment._id);
    await application.save();

    // Optionally, update the patient's payment history (if needed)
    patient.payments = patient.payments || [];
    patient.payments.push(savedPayment._id);
    await patient.save();

    res.status(201).json({ message: "Payment invoice created successfully", payment: savedPayment });
  } catch (error) {
    console.error("Error creating payment invoice - detailed stack:", error.stack);
    res.status(500).json({ message: "Failed to create payment invoice: " + error.message, stack: error.stack });
  }
});

// GET payment history for an application
router.get("/applications/:applicationId/payments", async (req, res) => {
  try {
    const application = await Application.findById(req.params.applicationId).populate("payments");
    if (!application) {
      return res.status(404).json({ message: "Application not found" });
    }
    res.json(application.payments);
  } catch (error) {
    console.error("Error fetching payment history - detailed stack:", error.stack);
    res.status(500).json({ message: "Failed to fetch payment history: " + error.message, stack: error.stack });
  }
});

// POST send payment link via email
router.post("/send-email", async (req, res) => {
  try {
    const { email, paymentUrl } = req.body;

    if (!email || !paymentUrl) {
      return res.status(400).json({ message: "Email and payment link are required" });
    }

    const mailOptions = {
      from: process.env.EMAIL_USER, // Sender address
      to: email, // Recipient (patient's email)
      subject: "Your Payment Link for Health-Direct Invoice",
      text: `Dear User,\n\nPlease use the following link to complete your payment:\n${paymentUrl}\n\nBest regards,\nHealth-Direct Team`,
      html: `<p>Dear User,</p><p>Please use the following link to complete your payment:</p><a href="${paymentUrl}">${paymentUrl}</a><p>Best regards,<br>Health-Direct Team</p>`,
    };

    await transporter.sendMail(mailOptions);
    res.json({ success: true, message: "Payment link sent via email successfully" });
  } catch (error) {
    console.error("Error sending email - detailed stack:", error.stack);
    res.status(500).json({ success: false, message: "Failed to send email: " + error.message, stack: error.stack });
  }
});

// Helper function to generate invoice ID (using the PaymentCounter model from before)
async function generateInvoiceId() {
  const PaymentCounter = require("../models/paymentcounter");
  const now = new Date();
  const currentMonthYear = now.toISOString().substr(5, 7).replace("-", "/"); // e.g., "02/2025"

  const counter = await PaymentCounter.findOneAndUpdate(
    {},
    { $inc: { sequence: 1 } },
    { new: true, upsert: true }
  );

  // Reset monthly sequence if the month/year changes
  if (counter.lastMonth !== currentMonthYear) {
    await PaymentCounter.updateOne(
      {},
      {
        $set: { lastMonth: currentMonthYear, monthlySequence: 1 },
        $inc: { sequence: 1 },
      }
    );
    counter.monthlySequence = 1;
  } else {
    await PaymentCounter.updateOne(
      {},
      { $inc: { monthlySequence: 1 } }
    );
    counter.monthlySequence += 1;
  }

  const monthlySeqStr = String(counter.monthlySequence).padStart(3, "0");
  const overallSeqStr = String(counter.sequence).padStart(4, "0");

  return `HD-INV${monthlySeqStr}-${currentMonthYear}-${overallSeqStr}`;
}

module.exports = router;