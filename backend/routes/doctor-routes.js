const express = require("express");
const router = express.Router();
const Doctor = require("../models/Doctor");

// POST /api/doctors - Add a new doctor
router.post("/", async (req, res) => {
  try {
    const { firstName, middleName, lastName, specialty, serviceType, email, phone, fees } = req.body;

    if (!firstName || !lastName || !specialty || serviceType.length === 0 || !fees) {
      return res.status(400).json({ message: "Missing required fields, including fees." });
    }

    // Validate fees structure
    if (!fees.currency) {
      return res.status(400).json({ message: "Fees must include currency." });
    }

    // Ensure currency is one of RUB, INR, EUR (handled by schema enum, but validate here for clarity)
    if (!["RUB", "INR", "EUR"].includes(fees.currency)) {
      return res.status(400).json({ message: "Currency must be RUB, INR, or EUR." });
    }

    const newDoctor = new Doctor({
      firstName,
      middleName,
      lastName,
      specialty,
      serviceType,
      email,
      phone,
      fees: {
        amount: fees.amount === "" || fees.amount === null ? null : Number(fees.amount) || null, // Allow null/empty or number
        currency: fees.currency, // Use the provided currency (validated by schema enum)
      },
    });

    const savedDoctor = await newDoctor.save();
    res.status(201).json(savedDoctor);
  } catch (error) {
    console.error("Error adding doctor:", error);
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/", async (req, res) => {
  try {
    const doctors = await Doctor.find();
    res.json(doctors);
  } catch (error) {
    console.error("Error fetching doctors:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// GET /api/doctors/by-name
router.get("/by-name", async (req, res) => {
  try {
    const { firstName, middleName, lastName } = req.query;

    // Adjust the query logic as you prefer
    const query = {
      firstName,
      lastName,
    };
    // If middleName is provided (non-empty), also match it
    if (middleName) {
      query.middleName = middleName;
    }

    const doctor = await Doctor.findOne(query);

    if (!doctor) {
      return res.status(404).json({ message: "Doctor not found." });
    }
    res.json(doctor);
  } catch (error) {
    console.error("Error fetching doctor by name:", error);
    res.status(500).json({ message: "Server error" });
  }
});

// Update route
router.put("/:id", async (req, res) => {
  try {
    const { fees, ...otherFields } = req.body; // Separate fees for validation

    // Validate fees if provided
    if (fees) {
      if (!fees.currency) {
        return res.status(400).json({ message: "Fees must include currency." });
      }
      // Ensure currency is one of RUB, INR, EUR (handled by schema enum, but validate here for clarity)
      if (!["RUB", "INR", "EUR"].includes(fees.currency)) {
        return res.status(400).json({ message: "Currency must be RUB, INR, or EUR." });
      }
      fees.amount = fees.amount === "" || fees.amount === null ? null : Number(fees.amount) || null; // Handle empty or invalid amounts as null
    }

    const updated = await Doctor.findByIdAndUpdate(
      req.params.id,
      { ...otherFields, fees: fees || undefined }, // Only update fees if provided
      { new: true, runValidators: true }
    );
    if (!updated) return res.status(404).json({ message: "Doctor not found" });
    res.json(updated);
  } catch (error) {
    console.error("Error updating doctor:", error);
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const doctor = await Doctor.findById(req.params.id);
    if (!doctor) return res.status(404).json({ message: "Doctor not found" });
    res.json(doctor);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;