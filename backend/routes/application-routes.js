const express = require("express");
const router = express.Router();
const Application = require("../models/Application");
const Patient = require("../models/Patient");
const Doctor = require("../models/Doctor");
const Media = require("../models/Media");
const Comment = require("../models/Comment");
const Counter = require("../models/Counter");
const mongoose = require("mongoose");
const axios = require("axios"); // Import axios for HTTP requests
const Appointment = require("../models/Appointment");
const nodemailer = require("nodemailer") // Import Appointment model (optional, for reference)

const multer = require("multer");
const storage = multer.memoryStorage(); // Store files in memory as Buffers
const upload = multer({ storage: storage });

let io; // Socket.IO instance
router.use((req, res, next) => {
  io = req.app.get("socketio"); // Get Socket.IO instance from app
  next();
});

// Helper functions
const checkTimeOverlap = (start1, end1, start2, end2) => {
  const startDate1 = new Date(`2000-01-01 ${start1}`);
  const endDate1 = new Date(`2000-01-01 ${end1}`);
  const startDate2 = new Date(`2000-01-01 ${start2}`);
  const endDate2 = new Date(`2000-01-01 ${end2}`);
  return startDate1 < endDate2 && endDate1 > startDate2;
};

const isValidTime = (time) => {
  const [hours, minutes] = time.split(":").map(Number);
  return hours >= 0 && hours < 24 && minutes >= 0 && minutes < 60;
};

// Function to convert IST time (9:00 AM) to UTC
const toUTCFromIST = (dateStr) => {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) {
    throw new Error("Invalid date format");
  }
  // Adjust for IST (UTC+5:30) to UTC by subtracting 5 hours 30 minutes
  date.setHours(date.getHours() - 5.5); // Convert 9:00 AM IST to 3:30 AM UTC
  return date;
};

// GET paginated applications with search and filters
router.get("/", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const query = {};

    if (req.query.search) {
      const searchTerm = req.query.search.trim().toLowerCase();
      query.$or = [
        { id: { $regex: escapeRegex(searchTerm), $options: "i" } },
        {
          patient: {
            $in: await Patient.find({
              $or: [
                { firstName: { $regex: escapeRegex(searchTerm), $options: "i" } },
                { middleName: { $regex: escapeRegex(searchTerm), $options: "i" } },
                { lastName: { $regex: escapeRegex(searchTerm), $options: "i" } },
                { phone: { $regex: escapeRegex(searchTerm.replace(/\D/g, '')), $options: "i" } },
                { email: { $regex: escapeRegex(searchTerm), $options: "i" } },
              ],
            }).distinct("_id"),
          },
        },
      ];
    }

    if (req.query.appointmentStatus) {
      query.appointmentStatus = req.query.appointmentStatus;
    }

    if (req.query.paymentStatus) {
      query.paymentStatus = req.query.paymentStatus;
    }

    if (req.query.doctor) {
      query.doctor = req.query.doctor;
    }

    if (req.query.recordDate) {
      query.recordDate = {
        $gte: new Date(req.query.recordDate),
        $lte: new Date(new Date(req.query.recordDate).getTime() + 24 * 60 * 60 * 1000),
      };
    }

    console.log("GET /api/applications query:", req.query); // Log the query for debugging
    const total = await Application.countDocuments(query);
    const applications = await Application.find(query)
      .populate("patient", "firstName middleName lastName")
      .populate("doctor", "firstName middleName lastName")
      .populate("previousComments")
      .populate("documents")
      .skip(skip)
      .limit(limit);

    res.json({
      applications,
      total,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("Error fetching applications - detailed stack:", error.stack);
    res.status(500).json({ message: "Failed to fetch applications: " + error.message, stack: error.stack });
  }
});

// GET application by ID
router.get("/:id", async (req, res) => {
  try {
    console.log("GET /api/applications/:id params:", req.params); // Log the params for debugging
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid ObjectId format" });
    }

    const application = await Application.findById(req.params.id)
      .populate("patient", "firstName middleName lastName")
      .populate("doctor", "firstName middleName lastName")
      .populate("previousComments")
      .populate("documents");
    if (!application) return res.status(404).json({ message: "Application not found" });
    res.json(application);
  } catch (error) {
    console.error("Error fetching application - detailed stack:", error.stack);
    res.status(500).json({ message: error.message, stack: error.stack });
  }
});

// POST create application with auto-generated ID
router.post("/", async (req, res) => {
  const { patient, serviceType, doctor, specialty, appointmentMode, appointmentStatus, meetingLink, recordDate, paymentStatus, comments, previousComments = [] } = req.body;

  try {
    // Validate required fields
    if (!patient || !doctor || !recordDate) {
      return res.status(400).json({ message: "Patient, Doctor, and Record Date are required fields." });
    }

    // Parse and adjust recordDate to IST 9:00 AM, then convert to UTC
    let date = new Date(recordDate);
    if (isNaN(date.getTime())) {
      return res.status(400).json({ message: "Invalid date format for Record Date." });
    }
    const istOffset = 5.5 * 60 * 60 * 1000; // Offset for IST
    const utcRecordDate = new Date(date.getTime() + istOffset); // Convert UTC to IST 

    const monthYear = utcRecordDate.toLocaleString("en-US", { month: "2-digit", year: "numeric" }).replace("/", "");
    const monthYearStr = `${utcRecordDate.toLocaleString("en-US", { month: "2-digit" })}/${utcRecordDate.getFullYear()}`;

    let counter = await Counter.findOne({ monthYear });
    if (!counter) {
      counter = new Counter({ monthYear, monthlyCount: 0, overallCount: 0 });
    }

    counter.monthlyCount = (counter.monthlyCount + 1) % 1000;
    if (counter.monthlyCount === 0) counter.monthlyCount = 1;
    counter.overallCount += 1;

    const monthlyPart = String(counter.monthlyCount).padStart(3, "0");
    const overallPart = String(counter.overallCount).padStart(4, "0");

    const id = `HD-R${monthlyPart}-${monthYearStr}-${overallPart}`;

    // Check for duplicate ID (edge case)
    const existingApplication = await Application.findOne({ id });
    if (existingApplication) {
      return res.status(409).json({ message: "An application with this ID already exists." });
    }

    const commentDocs = await Promise.all(previousComments.map(async (comment) => {
      if (comment && comment._id && mongoose.Types.ObjectId.isValid(comment._id)) {
        return await Comment.findById(comment._id);
      }
      return new Comment({
        text: comment?.text || "",
        date: comment?.date ? new Date(comment.date) : new Date(),
        application: null,
      });
    })).then(comments => comments.filter(comment => comment && comment.text.trim() !== ""));

    const newApplication = new Application({
      id,
      patient,
      serviceType,
      doctor,
      specialty,
      appointmentMode,
      appointmentStatus,
      meetingLink: meetingLink || null,
      recordDate: utcRecordDate, // Use UTC time adjusted for IST 9:00 AM
      paymentStatus,
      comments: comments || "",
      previousComments: [],
      documents: [],
    });

    const savedApplication = await newApplication.save();
    await counter.save();

    if (commentDocs.length > 0) {
      const savedComments = await Comment.insertMany(commentDocs.map(doc => ({
        ...doc.toObject(),
        text: doc.text || "",
        date: doc.date || new Date(),
        application: savedApplication._id,
      })));
      savedApplication.previousComments = savedComments.map(comment => comment._id);
      await savedApplication.save();
    }

    // Sync to Appointment using new endpoint in appointment-routes.js, including patientName and doctorName
    try {
      const patientDoc = await Patient.findById(patient);
      const doctorDoc = await Doctor.findById(doctor);
      const patientName = `${patientDoc?.firstName || ""} ${patientDoc?.middleName || ""} ${patientDoc?.lastName || ""}`.trim() || "Unknown Patient";
      const doctorName = `${doctorDoc?.firstName || ""} ${doctorDoc?.middleName || ""} ${doctorDoc?.lastName || ""}`.trim() || "Unknown Doctor";

      await axios.post("http://localhost:5001/api/appointments/sync", {
        applicationId: savedApplication._id,
        patientName,
        doctorName,
        specialty: specialty || "Unknown Specialty",
        appointmentMode: appointmentMode || "Online",
        startTime: "09:00", // Set to 9:00 AM explicitly for IST (3:30 AM UTC)
        endTime: "10:00", // Set to 10:00 AM explicitly for IST (4:30 AM UTC)
        date: utcRecordDate.toISOString().split("T")[0], // YYYY-MM-DD (UTC)
        appointmentStatus: appointmentStatus || "New",
      });
    } catch (axiosError) {
      console.error("Error syncing application to appointment - axios error:", axiosError.stack);
      // Optionally, continue with the response but log the error (non-critical for application creation)
    }

    if (io) {
      io.emit("newApplication", await Application.findById(savedApplication._id)
        .populate("patient", "firstName middleName lastName")
        .populate("doctor", "firstName middleName lastName")
        .populate("previousComments")
        .populate("documents"));
    }

    res.status(201).json(await Application.findById(savedApplication._id)
      .populate("patient", "firstName middleName lastName")
      .populate("doctor", "firstName middleName lastName")
      .populate("previousComments")
      .populate("documents"));
  } catch (error) {
    console.error("Error creating application - detailed stack:", error.stack);
    res.status(400).json({ message: error.message || "Internal Server Error", stack: error.stack });
  }
});

// PUT update application (ID remains unchanged, handle previousComments references)
router.put("/:id", async (req, res) => {
  try {
    console.log("PUT /api/applications/:id params:", req.params); // Log the params for debugging
    const { previousComments = [] } = req.body;

    const application = await Application.findById(req.params.id);
    if (!application) return res.status(404).json({ message: "Application not found" });

    // Validate required fields
    if (!req.body.patient || !req.body.doctor || !req.body.recordDate) {
      return res.status(400).json({ message: "Patient, Doctor, and Record Date are required fields." });
    }

    // Parse and adjust recordDate to IST 9:00 AM, then convert to UTC
    let date = new Date(req.body.recordDate);
    if (isNaN(date.getTime())) {
      return res.status(400).json({ message: "Invalid date format for Record Date." });
    }
    const istOffset = 5.5 * 60 * 60 * 1000; // Offset for IST
    const utcRecordDate = new Date(date.getTime() + istOffset); // Convert UTC to IST


    const validCommentIds = [];
    for (const comment of previousComments) {
      let commentId;
      if (typeof comment === "string" && mongoose.Types.ObjectId.isValid(comment)) {
        commentId = comment;
      } else if (comment && typeof comment === "object" && comment._id && mongoose.Types.ObjectId.isValid(comment._id)) {
        commentId = comment._id;
      } else {
        throw new Error(`Invalid ObjectId format: ${JSON.stringify(comment)}`);
      }

      const existingComment = await Comment.findById(commentId);
      if (!existingComment) {
        throw new Error(`Invalid comment ID: ${commentId}`);
      }
      validCommentIds.push(existingComment._id);
    }

    application.previousComments = validCommentIds;
    Object.assign(application, req.body, { previousComments: validCommentIds, recordDate: utcRecordDate });

    // Check for time conflicts, excluding the current application
    const recordDateForConflict = new Date(utcRecordDate); // Use UTC date for conflict check
    recordDateForConflict.setUTCHours(9, 0, 0, 0); // Set to 9:00 AM IST (3:30 AM UTC) for consistency
    const startTime = recordDateForConflict.toTimeString().split(" ")[0].slice(0, 5); // HH:MM (UTC, 3:30)
    if (!isValidTime(startTime)) {
      return res.status(400).json({ message: "Invalid start time format derived from Record Date." });
    }
    const endTime = new Date(recordDateForConflict.getTime() + 60 * 60 * 1000).toTimeString().split(" ")[0].slice(0, 5); // +1 hour (4:30 AM UTC)
    if (!isValidTime(endTime)) {
      return res.status(400).json({ message: "Invalid end time format derived from Record Date." });
    }
    const conflictQuery = {
      doctor: application.doctor,
      recordDate: { $gte: new Date(recordDateForConflict.setUTCHours(0, 0, 0, 0)), $lte: new Date(recordDateForConflict.setUTCHours(23, 59, 59, 999)) },
      _id: { $ne: application._id }, // Exclude current application
    };

    const conflictingApps = await Application.find(conflictQuery);
    const hasConflict = conflictingApps.some((app) => {
      const appDate = new Date(app.recordDate);
      const appStart = appDate.toTimeString().split(" ")[0].slice(0, 5);
      const appEnd = new Date(appDate.getTime() + 60 * 60 * 1000).toTimeString().split(" ")[0].slice(0, 5);
      return checkTimeOverlap(startTime, endTime, appStart, appEnd);
    });

    if (hasConflict) {
      return res.status(409).json({ message: "This time slot conflicts with an existing appointment for the selected doctor. Please choose a different time or doctor." });
    }

    const updatedApplication = await application.save();

    // Sync updated application to Appointment using new endpoint in appointment-routes.js, including patientName and doctorName, with URL-encoded ID
    try {
      const recordDateUpdated = new Date(updatedApplication.recordDate);
      if (isNaN(recordDateUpdated.getTime())) {
        throw new Error("Invalid record date format");
      }

      const date = recordDateUpdated.toISOString().split("T")[0]; // YYYY-MM-DD (UTC)
      const time = recordDateUpdated.toTimeString().split(" ")[0].slice(0, 5); // HH:MM (UTC)
      if (!isValidTime(time)) {
        throw new Error("Invalid time format for record date");
      }
      const startTimeUpdated = "09:00"; // Explicitly set to 9:00 AM IST (3:30 AM UTC)
      const endTimeUpdated = "10:00"; // Explicitly set to 10:00 AM IST (4:30 AM UTC)

      // Ensure patient and doctor names are properly populated
      const patientDoc = await Patient.findById(updatedApplication.patient);
      const doctorDoc = await Doctor.findById(updatedApplication.doctor);
      const patientName = `${patientDoc?.firstName || ""} ${patientDoc?.middleName || ""} ${patientDoc?.lastName || ""}`.trim() || "Unknown Patient";
      const doctorName = `${doctorDoc?.firstName || ""} ${doctorDoc?.middleName || ""} ${doctorDoc?.lastName || ""}`.trim() || "Unknown Doctor";

      // URL-encode the ID to handle slashes
      const encodedId = encodeURIComponent(updatedApplication.id);

      await axios.put(`http://localhost:5001/api/appointments/sync/${encodedId}`, {
        applicationId: updatedApplication._id,
        patientName,
        doctorName,
        specialty: updatedApplication.specialty || "Unknown Specialty",
        appointmentMode: updatedApplication.appointmentMode || "Online",
        startTime: startTimeUpdated,
        endTime: endTimeUpdated,
        date,
        appointmentStatus: updatedApplication.appointmentStatus || "New",
      });
    } catch (axiosError) {
      console.error("Error syncing updated application to appointment via axios - axios error:", axiosError.stack);
      // Optionally, fall back to direct MongoDB update if axios fails
      try {
        await Appointment.findOneAndUpdate(
          { id: updatedApplication.id },
          {
            patientName,
            doctorName,
            specialty: updatedApplication.specialty || "Unknown Specialty",
            appointmentMode: updatedApplication.appointmentMode || "Online",
            startTime: startTimeUpdated,
            endTime: endTimeUpdated,
            date,
            appointmentStatus: updatedApplication.appointmentStatus || "New",
          },
          { upsert: true, new: true, runValidators: true }
        );
      } catch (mongoError) {
        console.error("Error updating appointment in MongoDB - detailed stack:", mongoError.stack);
        // Log the error but continue with the response (non-critical for application update)
      }
    }

    if (io) {
      io.emit("updateApplication", await Application.findById(updatedApplication._id)
        .populate("patient", "firstName middleName lastName")
        .populate("doctor", "firstName middleName lastName")
        .populate("previousComments")
        .populate("documents"));
    }

    // Emit WebSocket event for appointment update
    if (io) {
      const updatedAppointment = await Appointment.findOne({ id: updatedApplication.id });
      if (updatedAppointment) {
        io.emit("updateAppointment", updatedAppointment);
      }
    }

    res.json(await Application.findById(updatedApplication._id)
      .populate("patient", "firstName middleName lastName")
      .populate("doctor", "firstName middleName lastName")
      .populate("previousComments"));
  } catch (error) {
    console.error("Error updating application - detailed stack:", error.stack);
    res.status(400).json({ message: error.message || "Internal Server Error", stack: error.stack });
  }
});

// POST upload documents (files or URLs) for application
router.post("/:id/documents", upload.array("documents"), async (req, res) => {
  try {
    const application = await Application.findById(req.params.id);
    if (!application) return res.status(404).json({ message: "Application not found" });

    let mediaDocuments = [];

    if (req.files && req.files.length > 0) {
      mediaDocuments = req.files.map(file => ({
        filename: file.originalname,
        data: file.buffer,
        mimetype: file.mimetype,
        size: file.size,
        application: application._id,
      }));
    }

    if (req.body.url) {
      let urls;
      try {
        urls = JSON.parse(req.body.url);
      } catch (e) {
        urls = Array.isArray(req.body.url) ? req.body.url : [req.body.url];
      }
      const validUrls = urls.filter(url => url.trim() && url.match(/^https?:\/\//i));
      mediaDocuments = mediaDocuments.concat(validUrls.map(url => ({
        filename: url.split("/").pop() || `document_${Date.now()}`,
        url: url.trim(),
        application: application._id,
      })));
    }

    if (mediaDocuments.length === 0) {
      return res.status(400).json({ message: "No valid files or URLs provided" });
    }

    const savedMedia = await Media.insertMany(mediaDocuments);
    application.documents.push(...savedMedia.map(doc => doc._id));
    await application.save();

    res.status(201).json({ message: "Documents uploaded successfully", documents: savedMedia });
  } catch (error) {
    console.error("Error uploading documents - detailed stack:", error.stack);
    res.status(500).json({ message: "Failed to upload documents: " + error.message, stack: error.stack });
  }
});

// GET route to retrieve a document by ID (for preview)
router.get("/media/:docId", async (req, res) => {
  try {
    const media = await Media.findById(req.params.docId);
    if (!media) return res.status(404).json({ message: "Document not found" });

    if (media.url) {
      return res.redirect(media.url);
    }

    if (!media.data) {
      return res.status(400).json({ message: "No file data available" });
    }

    res.set("Content-Type", media.mimetype);
    res.send(media.data);
  } catch (error) {
    console.error("Error retrieving document - detailed stack:", error.stack);
    res.status(500).json({ message: "Failed to retrieve document: " + error.message, stack: error.stack });
  }
});

// DELETE a document (exclusive to EditApplication.jsx)
router.delete("/media/:docId", async (req, res) => {
  try {
    const media = await Media.findById(req.params.docId);
    if (!media) return res.status(404).json({ message: "Document not found" });

    const application = await Application.findById(media.application);
    if (!application) return res.status(404).json({ message: "Application not found" });

    application.documents = application.documents.filter(id => id.toString() !== media._id.toString());
    await application.save();
    await media.deleteOne();

    res.json({ message: "Document deleted successfully" });
  } catch (error) {
    console.error("Error deleting document - detailed stack:", error.stack);
    res.status(500).json({ message: "Failed to delete document: " + error.message, stack: error.stack });
  }
});

// POST add a new comment to an application
router.post("/:id/comments", async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ message: "Comment text is required and cannot be empty." });
    }

    const application = await Application.findById(req.params.id);
    if (!application) return res.status(404).json({ message: "Application not found" });

    const newComment = new Comment({
      text: text.trim(),
      date: new Date(),
      application: application._id,
    });

    const savedComment = await newComment.save();
    application.previousComments.push(savedComment._id);
    await application.save();

    res.status(201).json(await Comment.findById(savedComment._id));
  } catch (error) {
    console.error("Error adding comment - detailed stack:", error.stack);
    res.status(400).json({ message: error.message, stack: error.stack });
  }
});

// PUT update an existing comment
router.put("/comments/:commentId", async (req, res) => {
  console.log("PUT request received for /api/comments/:commentId", req.params.commentId);
  try {
    const { text } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ message: "Comment text is required and cannot be empty." });
    }

    const comment = await Comment.findById(req.params.commentId);
    if (!comment) return res.status(404).json({ message: "Comment not found" });

    comment.text = text.trim();
    comment.date = new Date();
    const updatedComment = await comment.save();

    res.json(updatedComment);
  } catch (error) {
    console.error("Error updating comment - detailed stack:", error.stack);
    res.status(400).json({ message: error.message, stack: error.stack });
  }
});

// DELETE a comment
router.delete("/comments/:commentId", async (req, res) => {
  console.log("DELETE request received for /api/comments/:commentId", req.params.commentId);
  try {
    const comment = await Comment.findById(req.params.commentId);
    if (!comment) return res.status(404).json({ message: "Comment not found" });

    const application = await Application.findById(comment.application);
    if (!application) return res.status(404).json({ message: "Application not found" });

    application.previousComments = application.previousComments.filter(id => id.toString() !== comment._id.toString());
    await application.save();
    await comment.deleteOne();

    res.json({ message: "Comment deleted successfully" });
  } catch (error) {
    console.error("Error deleting comment - detailed stack:", error.stack);
    res.status(400).json({ message: error.message, stack: error.stack });
  }
});

// DELETE application
router.delete("/:id", async (req, res) => {
  try {
    console.log("DELETE /api/applications/:id params:", req.params); // Log the params for debugging
    const application = await Application.findById(req.params.id);
    if (!application) return res.status(404).json({ message: "Application not found" });

    await Comment.deleteMany({ application: req.params.id });

    // Delete the corresponding appointment using new endpoint in appointment-routes.js, with URL-encoded ID
    try {
      const encodedId = encodeURIComponent(application.id);
      await axios.delete(`http://localhost:5001/api/appointments/${encodedId}`);
    } catch (axiosError) {
      console.error("Error deleting appointment via axios - axios error:", axiosError.stack);
      // Optionally, fall back to direct MongoDB delete if axios fails
      try {
        await Appointment.deleteOne({ id: application.id });
      } catch (mongoError) {
        console.error("Error deleting appointment in MongoDB - detailed stack:", mongoError.stack);
        // Log the error but continue with the response (non-critical for application deletion)
      }
    }

    await application.deleteOne();

    if (io) {
      io.emit("deleteApplication", application.id); // Notify Tasks.jsx with the application ID
    }

    res.json({ message: "Application deleted successfully" });
  } catch (error) {
    console.error("Error deleting application - detailed stack:", error.stack);
    res.status(500).json({ message: error.message, stack: error.stack });
  }
});

// Admin endpoint to reset counters (for testing)
router.post("/reset-counters", async (req, res) => {
  try {
    await Counter.deleteMany();
    await Comment.deleteMany();
    res.json({ message: "Counters and comments reset successfully." });
  } catch (error) {
    console.error("Error resetting counters - detailed stack:", error.stack);
    res.status(500).json({ message: "Error resetting counters: " + error.message, stack: error.stack });
  }
});

function escapeRegex(text) {
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
}

router.post("/emails/send", async (req, res) => {
  try {
    const { to, subject, body } = req.body;

    if (!to || !subject.trim() || !body.trim()) {
      return res.status(400).json({ error: "Recipient, subject, and body are required" });
    }

    const transporter = nodemailer.createTransport({
      service: "gmail", // Use your email service (e.g., Gmail, Outlook)
      auth: {
        user: process.env.EMAIL_USER, // Your email address (e.g., from .env)
        pass: process.env.EMAIL_PASSWORD, // Your email password or app-specific password
      },
    });

    const mailOptions = {
      from: process.env.EMAIL_USER, // Sender address
      to, // Recipient (patient's or doctor's email)
      subject,
      text: body,
      html: `<p>${body.replace(/\n/g, "<br>")}</p>`, // Convert newlines to <br> for HTML
    };

    await transporter.sendMail(mailOptions);
    res.json({ success: true, message: "Email sent successfully" });
  } catch (error) {
    console.error("Error sending email - detailed stack:", error.stack);
    res.status(500).json({ error: "Failed to send email: " + error.message, stack: error.stack });
  }
});

// GET /api/applications/patient/:patientId/history - Fetch application history for a patient
router.get("/patient/:patientId/history", async (req, res) => {
  try {
    const { patientId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(patientId)) {
      return res.status(400).json({ error: "Invalid patient ID format" });
    }

    const applications = await Application.find({ patient: patientId })
      .populate("patient", "firstName middleName lastName email")
      .populate("doctor", "firstName middleName lastName email")
      .populate("documents", "filename url mimetype") // Populate only necessary fields from Media
      .populate("payments", "invoiceNumber paymentStatus totalAmount currency createdAt paymentUrl") // Populate only necessary fields from Payment
      .sort({ recordDate: -1 }) // Sort by recordDate in descending order (newest first)
      .exec();

    if (!applications || applications.length === 0) {
      return res.status(404).json({ error: "No application history found for this patient" });
    }

    res.status(200).json({ applications });
  } catch (error) {
    console.error("Error fetching application history - detailed stack:", error.stack);
    res.status(500).json({ error: "Failed to fetch application history: " + error.message, stack: error.stack });
  }
});

module.exports = router;