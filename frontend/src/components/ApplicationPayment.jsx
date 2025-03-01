import React, { useState, useEffect } from "react";
import { loadStripe } from "@stripe/stripe-js";
import axios from "axios";
import "../styles/ApplicationPayment.css"; // Assume a CSS file for styling

// Initialize Stripe with your publishable key
const stripePromise = loadStripe("your_stripe_publishable_key_here");

function ApplicationPayment({ application, onClose, onSuccess }) {
  const [paymentMethod, setPaymentMethod] = useState("Stripe");
  const [services, setServices] = useState([]);
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [paymentUrl, setPaymentUrl] = useState(""); // Store the generated payment URL
  const [successMessage, setSuccessMessage] = useState(""); // Show success message
  const [paymentHistory, setPaymentHistory] = useState([]); // Store payment history
  const [patientEmail, setPatientEmail] = useState(""); // Store patient's email

  // Fetch doctor's fees, payment history, and patient's email when the component mounts
  useEffect(() => {
    const fetchDoctorFeesAndHistory = async () => {
      try {
        // Fetch doctor's fees
        const doctorId = application.doctor?._id?.toString() || application.doctor;
        if (!doctorId || typeof doctorId !== "string") {
          throw new Error("Invalid doctor ID");
        }

        const doctorResponse = await axios.get(`http://localhost:5001/api/doctors/${doctorId}`);
        const doctor = doctorResponse.data;
        const feeAmount = doctor.fees?.amount || 0; // Default to 0 if no fees
        const currency = doctor.fees?.currency || "INR"; // Default to INR if no currency specified
        setServices([{ name: "Doctor Fees", price: feeAmount, quantity: 1, currency }]); // Include currency for clarity

        // Fetch payment history for the application
        const historyResponse = await axios.get(`http://localhost:5001/api/payments/applications/${application._id?.toString()}/payments`);
        setPaymentHistory(historyResponse.data || []);

        // Fetch patient's email using patient ID from application
        const patientId = application.patient?._id?.toString() || application.patient;
        if (!patientId || typeof patientId !== "string") {
          throw new Error("Invalid patient ID");
        }

        const patientResponse = await axios.get(`http://localhost:5001/api/patients/${patientId}`);
        const patient = patientResponse.data;
        setPatientEmail(patient.email || "default@example.com"); // Use patient's email or fallback
      } catch (err) {
        setError("Failed to fetch data: " + err.message);
      }
    };
    fetchDoctorFeesAndHistory();
  }, [application.doctor, application._id, application.patient]);

  const addService = () => {
    setServices([...services, { name: "", price: 0, quantity: 1, currency: "INR" }]); // Default to INR
  };

  const removeService = (index) => {
    setServices(services.filter((_, i) => i !== index));
  };

  const updateService = (index, field, value) => {
    const updatedServices = [...services];
    if (field === "price") {
      // Allow free editing, but ensure it's a positive number on blur or submit
      value = value.replace(/[^0-9.]/g, ""); // Allow only numbers and decimals
      updatedServices[index][field] = value ? parseFloat(value) || 0 : 0;
    } else if (field === "quantity") {
      // Allow free editing, but ensure it's at least 1 on blur or submit
      value = value.replace(/[^0-9]/g, ""); // Allow only numbers
      updatedServices[index][field] = value ? parseInt(value) || 1 : 1;
    } else {
      updatedServices[index][field] = value;
    }
    setServices(updatedServices);
  };

  const generatePaymentLink = async () => {
    setLoading(true);
    setError("");
    setSuccessMessage(""); // Clear any previous success message

    // Validate inputs before generating payment link
    for (const service of services) {
      if (service.price <= 0) {
        setError("Price must be greater than 0 for all services.");
        setLoading(false);
        return;
      }
      if (service.quantity < 1) {
        setError("Quantity must be at least 1 for all services.");
        setLoading(false);
        return;
      }
    }

    try {
      const totalAmount = services.reduce((sum, service) => sum + (service.price * service.quantity), 0);
      const email = patientEmail; // Use dynamically fetched patient email
      const course = services.map(s => `${s.name} x${s.quantity} = ${s.price * s.quantity} ${s.currency || "INR"}`).join(", ");

      const response = await axios.post("http://localhost:5001/api/payments/stripe/create-payment-link", {
        amount: totalAmount,
        email,
        course,
      });

      if (response.data.success) {
        const paymentUrl = response.data.paymentUrl;
        const stripeInvoiceId = response.data.orderId; // Use Stripe's orderId as stripeInvoiceId

        // Save invoice details to payment, application, and patient (assuming backend endpoints exist)
        const applicationId = application._id?.toString(); // Ensure application._id is a string
        if (!applicationId || typeof applicationId !== "string") {
          throw new Error("Invalid application ID");
        }

        await axios.post(`http://localhost:5001/api/payments/applications/${applicationId}/invoice`, {
          stripeInvoiceId, // Pass Stripe's orderId as stripeInvoiceId
          services: services.map(service => ({
            name: service.name,
            price: service.price,
            quantity: service.quantity,
            currency: service.currency || "INR",
            totalAmount: service.price * service.quantity, // Ensure totalAmount is included
          })),
          totalAmount,
          comment,
          paymentUrl,
          status: "Pending", // This will be overridden to "New" in the backend
        });

        setPaymentUrl(paymentUrl); // Store the payment URL for email/WhatsApp actions
        setSuccessMessage("Payment link generated successfully!");
        // Do not call onSuccess() here to keep the popup open
      } else {
        setError("Failed to generate payment link.");
      }
    } catch (err) {
      setError("Error generating payment link: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const sendLinkEmail = async () => {
    if (!paymentUrl) {
      setError("Link not created, you can’t send email.");
      return;
    }

    try {
      const email = patientEmail; // Use dynamically fetched patient email
      await axios.post("http://localhost:5001/api/payments/send-email", {
        email,
        paymentUrl,
      });
      alert("Payment link sent via email successfully!");
    } catch (err) {
      setError("Failed to send email: " + err.message);
    }
  };

  const sendLinkWhatsApp = () => {
    if (!paymentUrl) {
      setError("Link not created, you can’t send WhatsApp.");
      return;
    }

    navigator.clipboard.writeText(paymentUrl).then(() => {
      alert("Payment link copied to clipboard for WhatsApp!");
    }).catch((err) => {
      setError("Failed to copy link to clipboard: " + err.message);
    });
  };

  return (
    <div className="payment-popup" onClick={onClose}>
      <div className="payment-content" onClick={(e) => e.stopPropagation()}>
        <div className="payment-header">
          <h2 className="payment-heading">New Invoice</h2>
          <button
            className="close-btn"
            onClick={onClose}
            aria-label="Close invoice popup"
          >
            ×
          </button>
        </div>
        <div className="payment-box">
          <div className="payment-section">
            <label>Payment Method</label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="payment-select"
              disabled
              aria-label="Payment method"
            >
              <option value="Stripe">Stripe</option>
            </select>
          </div>

          <div className="payment-section">
            <label>Services</label>
            <div className="service-header">
              <span className="service-label">Name of Service</span>
              <span className="service-label">Price ({services[0]?.currency || "INR"})</span>
              <span className="service-label">Quantity</span>
              <span className="service-label">Total Amount ({services[0]?.currency || "INR"})</span>
              <span></span> {/* For the remove button alignment */}
            </div>
            {services.map((service, index) => (
              <div key={index} className="service-row">
                <input
                  type="text"
                  value={service.name}
                  onChange={(e) => updateService(index, "name", e.target.value)}
                  placeholder="Name of service"
                  className="service-input"
                  aria-label={`Service name ${index + 1}`}
                />
                <input
                  type="number"
                  value={service.price || ""}
                  onChange={(e) => updateService(index, "price", e.target.value)}
                  placeholder="Price"
                  className="service-input"
                  min="0.01"
                  step="0.01"
                  aria-label={`Price ${index + 1}`}
                />
                <input
                  type="number"
                  value={service.quantity || ""}
                  onChange={(e) => updateService(index, "quantity", e.target.value)}
                  placeholder="Quantity"
                  className="service-input"
                  min="1"
                  aria-label={`Quantity ${index + 1}`}
                />
                <span className="total-amount">
                  {(service.price * service.quantity).toFixed(2)} {service.currency || "₽"}
                </span>
                <button
                  className="remove-service-btn"
                  onClick={() => removeService(index)}
                  aria-label={`Remove service ${index + 1}`}
                >
                  ×
                </button>
              </div>
            ))}
            <button
              className="add-service-btn"
              onClick={addService}
              aria-label="Add new service"
            >
              +
            </button>
          </div>

          <div className="payment-section">
            <label>Comment</label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Add a comment..."
              className="comment-input"
              aria-label="Comment"
            />
          </div>

          {error && <div className="error-message" role="alert">{error}</div>}
          {successMessage && <div className="success-message" role="alert">{successMessage}</div>}

          <button
            className="generate-link-btn"
            onClick={generatePaymentLink}
            disabled={loading}
            aria-label="Generate payment link"
          >
            {loading ? "Generating..." : "Generate Payment Link"}
          </button>

          <div className="payment-actions">
            <button
              className="send-link-btn"
              onClick={sendLinkEmail}
              disabled={loading}
              aria-label="Send payment link via email"
            >
              Send Link (Email)
            </button>
            <button
              className="send-link-btn"
              onClick={sendLinkWhatsApp}
              disabled={loading}
              aria-label="Send payment link via WhatsApp"
            >
              Send Link (WhatsApp)
            </button>
          </div>

          <div className="payment-history-box">
            <h3 className="payment-history-heading">Payment History</h3>
            {paymentHistory.length > 0 ? (
              <div className="payment-history-list">
                {paymentHistory.map((payment, index) => (
                  <div key={index} className="payment-history-item">
                    <p><strong>Invoice #:</strong> {payment.invoiceNumber}</p>
                    <p><strong>Status:</strong> {payment.paymentStatus}</p>
                    <p><strong>Total Amount:</strong> {payment.totalAmount} {payment.currency}</p>
                    <p><strong>Date:</strong> {new Date(payment.createdAt).toLocaleDateString()}</p>
                    {payment.paymentUrl && <p><strong>Payment Link:</strong> <a href={payment.paymentUrl} target="_blank" rel="noopener noreferrer">View Link</a></p>}
                  </div>
                ))}
              </div>
            ) : (
              <p className="no-payments">No payment history available.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ApplicationPayment;