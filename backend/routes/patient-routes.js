const express = require("express");
const Patient = require("../models/Patient");
const Medical = require("../models/Medical"); // Import updated Medical model
const Media = require("../models/Media"); // Import new Media model
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const mongoose = require("mongoose"); // Import mongoose

const router = express.Router();

// Configure multer for in-memory storage (store in Buffer, not filesystem)
const storage = multer.memoryStorage(); // Use memory storage instead of disk storage
const upload = multer({ storage: storage }); // No limits or file filter for now, adjust as needed

// POST: Create a new patient
router.post("/", async (req, res) => {
  let session = null; // Declare session outside try block
  try {
    const { firstName, middleName, lastName, gender, dateOfBirth, telephone, additionalPhone, email, comments } = req.body;

    if (!firstName || !lastName || !gender || !dateOfBirth || !telephone || !email) {
      return res.status(400).json({ error: "First Name, Last Name, Gender, Date of Birth, Telephone, and Email are required!" });
    }

    session = await mongoose.startSession();
    session.startTransaction();

    const newPatient = new Patient({ firstName, middleName, lastName, gender, dateOfBirth, telephone, additionalPhone, email, comments: comments || "" });
    await newPatient.save({ session });

    // Create default medical record for the patient as an array (required for session with Mongoose create)
    await Medical.create(
      [{ patientId: newPatient._id, medicalHistory: "", medicalComments: "", media: [] }],
      { session }
    );

    await session.commitTransaction();

    res.status(201).json({ message: "Patient created successfully", patient: newPatient });
  } catch (error) {
    console.error("Error saving patient:", error);
    if (session) {
      await session.abortTransaction();
    }
    res.status(500).json({ error: error.message || "Internal Server Error" });
  } finally {
    if (session) {
      session.endSession(); // Ensure session is always closed
    }
  }
});

// GET: Fetch all patients with optional search or filters (e.g., by name or gender)
router.get("/", async (req, res) => {
  try {
    const { search, gender } = req.query; // Query params: ?search=query&gender=Male

    let query = {};

    if (search) {
      const searchRegex = new RegExp(search, "i"); // Case-insensitive search
      query.$or = [
        { firstName: searchRegex },
        { middleName: searchRegex },
        { lastName: searchRegex },
      ];
    }

    if (gender) {
      query.gender = gender;
    }

    const patients = await Patient.find(query).sort({ lastName: 1, firstName: 1 }); // Sort by last name, then first name
    res.status(200).json(patients);
  } catch (error) {
    console.error("Error fetching patients:", error);
    res.status(500).json({ message: "Error fetching patients", error: error.message });
  }
});

// GET: Fetch a single patient by _id
router.get("/:id", async (req, res) => {
  try {
    const patient = await Patient.findById(req.params.id);
    if (!patient) {
      return res.status(404).json({ error: "Patient not found" });
    }
    res.status(200).json(patient);
  } catch (error) {
    console.error("Error fetching patient:", error);
    res.status(500).json({ error: error.message || "Internal Server Error" });
  }
});

// GET: Fetch medical information for a patient with populated media
router.get("/:id/medical", async (req, res) => {
  try {
    const medical = await Medical.findOne({ patientId: req.params.id }).populate("media");
    if (!medical) {
      // Create default medical record if not found
      const newMedical = await Medical.create({
        patientId: req.params.id,
        medicalHistory: "",
        medicalComments: "",
        media: [],
      });
      return res.status(200).json(newMedical);
    }
    res.status(200).json(medical);
  } catch (error) {
    console.error("Error fetching medical information:", error);
    res.status(500).json({ error: error.message || "Internal Server Error" });
  }
});

// PUT: Update an existing patient
router.put("/:id", async (req, res) => {
  try {
    const { firstName, middleName, lastName, gender, dateOfBirth, telephone, additionalPhone, email, comments } = req.body;

    if (!firstName || !lastName || !gender || !dateOfBirth || !telephone || !email) {
      return res.status(400).json({ error: "First Name, Last Name, Gender, Date of Birth, Telephone, and Email are required!" });
    }

    const updatedPatient = await Patient.findByIdAndUpdate(
      req.params.id,
      { firstName, middleName, lastName, gender, dateOfBirth, telephone, additionalPhone, email, comments: comments || "" },
      { new: true, runValidators: true }
    );

    if (!updatedPatient) {
      return res.status(404).json({ error: "Patient not found" });
    }

    res.status(200).json({ message: "Patient updated successfully", patient: updatedPatient });
  } catch (error) {
    console.error("Error updating patient:", error);
    res.status(500).json({ error: error.message || "Internal Server Error" });
  }
});

// PUT: Update medical information for a patient (with media references)
router.put("/:id/medical", upload.array("media"), async (req, res) => {
  let session = null; // Declare session outside try block
  try {
    const { medicalHistory, medicalComments, existingMedia } = req.body; // Parse existing media IDs from form data

    session = await mongoose.startSession();
    session.startTransaction();

    const currentMedical = await Medical.findOne({ patientId: req.params.id }) || { media: [] };
    const existingMediaIds = Array.isArray(currentMedical.media) ? currentMedical.media : []; // Ensure media is an array of ObjectIds

    // Parse existingMedia (array of media IDs)
    let existingMediaArray = [];
    if (existingMedia) {
      try {
        existingMediaArray = typeof existingMedia === "string" ? JSON.parse(existingMedia) || [] : existingMedia || [];
        // Convert existingMediaArray to array of ObjectIds if they are strings or numbers
        existingMediaArray = existingMediaArray.map(id => mongoose.Types.ObjectId(id));
      } catch (e) {
        console.error("Error parsing existing media:", e);
        existingMediaArray = []; // Default to empty array if parsing fails
      }
    }

    // Handle new uploaded files (create Media documents)
    const newMedia = [];
    for (const file of req.files) {
      const mediaDoc = new Media({
        data: file.buffer, // Store binary data (Buffer)
        contentType: file.mimetype, // Store MIME type (e.g., "image/png", "video/mp4")
      });
      await mediaDoc.save({ session });
      newMedia.push(mediaDoc._id);
    }

    // Combine existing media IDs with new media IDs
    const combinedMedia = [...existingMediaIds, ...newMedia];

    const updatedMedical = await Medical.findOneAndUpdate(
      { patientId: req.params.id },
      { medicalHistory, medicalComments, media: combinedMedia },
      { new: true, upsert: true, runValidators: true, session }
    );

    await session.commitTransaction();

    res.status(200).json({ message: "Medical information updated successfully", medical: updatedMedical });
  } catch (error) {
    console.error("Error updating medical information:", error);
    if (session) {
      await session.abortTransaction();
    }
    res.status(500).json({ error: error.message || "Internal Server Error" });
  } finally {
    if (session) {
      session.endSession(); // Ensure session is always closed
    }
  }
});

// GET: Serve media file from MongoDB
router.get("/:id/medical/media/:mediaId", async (req, res) => {
  try {
    const media = await Media.findById(req.params.mediaId);
    if (!media) {
      return res.status(404).json({ error: "Media not found" });
    }

    res.set('Content-Type', media.contentType);
    res.send(media.data); // Send binary data
  } catch (error) {
    console.error("Error fetching media:", error);
    res.status(500).json({ error: error.message || "Internal Server Error" });
  }
});

// DELETE: Delete a patient (and associated medical data, including media)
router.delete("/:id", async (req, res) => {
  let session = null; // Declare session outside try block
  try {
    session = await mongoose.startSession();
    session.startTransaction();

    // Find and delete associated medical data
    const medical = await Medical.findOne({ patientId: req.params.id });
    if (medical && medical.media.length > 0) {
      await Media.deleteMany({ _id: { $in: medical.media } }, { session }); // Delete all associated media
    }

    // Delete patient
    const deletedPatient = await Patient.findByIdAndDelete(req.params.id, { session });
    if (!deletedPatient) {
      await session.abortTransaction();
      return res.status(404).json({ error: "Patient not found" });
    }

    // Delete associated medical data
    await Medical.deleteOne({ patientId: req.params.id }, { session });

    await session.commitTransaction();

    res.status(200).json({ message: "Patient and associated medical data deleted successfully" });
  } catch (error) {
    console.error("Error deleting patient:", error);
    if (session) {
      await session.abortTransaction();
    }
    res.status(500).json({ error: error.message || "Internal Server Error" });
  } finally {
    if (session) {
      session.endSession(); // Ensure session is always closed
    }
  }
});

module.exports = router;