const express = require("express");
const router = express.Router();
const Appointment = require("../models/Appointment"); // Import Appointment model
const Application = require("../models/Application"); // For syncing with applications
const Patient = require("../models/Patient"); // For patient name
const Doctor = require("../models/Doctor"); // For doctor name
const { Server } = require("socket.io"); // For WebSocket

let io;
router.use((req, res, next) => {
  io = req.app.get("socketio"); // Get Socket.IO instance from app
  next();
});

// Helper functions (matching task-routes.js)
const checkTimeOverlap = (task1Start, task1End, task2Start, task2End) => {
  const start1 = new Date(`2000-01-01 ${task1Start}`);
  const end1 = new Date(`2000-01-01 ${task1End}`);
  const start2 = new Date(`2000-01-01 ${task2Start}`);
  const end2 = new Date(`2000-01-01 ${task2End}`);
  return start1 < end2 && end1 > start2;
};

const isValidTime = (time) => {
  const [hours, minutes] = time.split(":").map(Number);
  return hours >= 0 && hours < 24 && minutes >= 0 && minutes < 60;
};

const isValidTimeRange = (startTime, endTime) => {
  const start = new Date(`2000-01-01 ${startTime}`);
  const end = new Date(`2000-01-01 ${endTime}`);
  return end > start;
};

// Helper to validate date format (YYYY-MM-DD)
const isValidDateFormat = (dateStr) => {
  return /^\d{4}-\d{2}-\d{2}$/.test(dateStr);
};

// POST: Sync a new application to create or update an appointment
router.post("/sync", async (req, res) => {
  try {
    console.log("POST /api/appointments/sync body received:", req.body); // Debugging log
    const { applicationId, patientName, doctorName, specialty, appointmentMode, startTime, endTime, date, appointmentStatus } = req.body;
    const application = await Application.findById(applicationId)
      .populate("patient", "firstName middleName lastName")
      .populate("doctor", "firstName middleName lastName");

    if (!application) {
      return res.status(404).json({ error: "Application not found" });
    }

    const recordDate = new Date(application.recordDate);
    if (isNaN(recordDate.getTime())) {
      return res.status(400).json({ error: "Invalid record date format" });
    }

    const parsedDate = date ? new Date(date) : recordDate;
    if (isNaN(parsedDate.getTime())) {
      return res.status(400).json({ error: "Invalid date format" });
    }

    const parsedStartTime = startTime || recordDate.toTimeString().split(" ")[0].slice(0, 5); // HH:MM (UTC)
    if (!isValidTime(parsedStartTime)) {
      return res.status(400).json({ error: "Invalid start time format" });
    }

    const parsedEndTime = endTime || new Date(recordDate.getTime() + 60 * 60 * 1000).toTimeString().split(" ")[0].slice(0, 5); // +1 hour
    if (!isValidTime(parsedEndTime)) {
      return res.status(400).json({ error: "Invalid end time format" });
    }

    if (!isValidTimeRange(parsedStartTime, parsedEndTime)) {
      return res.status(400).json({ error: "End time must be after start time!" });
    }

    const effectivePatientName = patientName || `${application.patient.firstName || ""} ${application.patient.middleName || ""} ${application.patient.lastName || ""}`.trim() || "Unknown Patient";
    const effectiveDoctorName = doctorName || `${application.doctor.firstName || ""} ${application.doctor.middleName || ""} ${application.doctor.lastName || ""}`.trim() || "Unknown Doctor";

    const existingAppointment = await Appointment.findOne({ id: application.id.toString() }); // Explicitly treat id as string
    if (existingAppointment) {
      // Update existing appointment
      const updatedAppointment = await Appointment.findOneAndUpdate(
        { id: application.id.toString() }, // Explicitly treat id as string
        {
          patientName: effectivePatientName,
          doctorName: effectiveDoctorName,
          specialty: specialty || application.specialty || "Unknown Specialty",
          appointmentMode: appointmentMode || application.appointmentMode || "Online",
          startTime: parsedStartTime,
          endTime: parsedEndTime,
          date: parsedDate.toISOString().split("T")[0], // YYYY-MM-DD (UTC)
          appointmentStatus: appointmentStatus || application.appointmentStatus || "New",
        },
        { new: true, runValidators: true }
      );

      if (io) {
        io.emit("updateAppointment", updatedAppointment); // Emit update to Tasks.jsx
      }

      return res.status(200).json({ message: "Appointment updated successfully", appointment: updatedAppointment });
    }

    // Create new appointment if it doesn’t exist
    const newAppointment = new Appointment({
      id: application.id.toString(), // Explicitly treat id as string
      patientName: effectivePatientName,
      doctorName: effectiveDoctorName,
      specialty: specialty || application.specialty || "Unknown Specialty",
      appointmentMode: appointmentMode || application.appointmentMode || "Online",
      startTime: parsedStartTime,
      endTime: parsedEndTime,
      date: parsedDate.toISOString().split("T")[0], // YYYY-MM-DD (UTC)
      appointmentStatus: appointmentStatus || application.appointmentStatus || "New",
    });

    await newAppointment.save();

    if (io) {
      io.emit("newAppointment", newAppointment); // Emit to Tasks.jsx
    }

    res.status(201).json({ message: "Appointment synced successfully", appointment: newAppointment });
  } catch (error) {
    console.error("Error syncing application to appointment - detailed stack:", error.stack);
    res.status(500).json({ error: error.message || "Internal Server Error", stack: error.stack });
  }
});

// PUT: Update an existing appointment when application updates
router.put("/sync/:id", async (req, res) => {
  try {
    console.log("PUT /api/appointments/sync/:id body received:", req.body, "Params:", req.params); // Debugging log
    const { applicationId, patientName, doctorName, specialty, appointmentMode, startTime, endTime, date, appointmentStatus } = req.body;
    const application = await Application.findById(applicationId)
      .populate("patient", "firstName middleName lastName")
      .populate("doctor", "firstName middleName lastName");

    if (!application) {
      return res.status(404).json({ error: "Application not found" });
    }

    // Use the route parameter :id (e.g., "HD-R001-02/2025-0001") as the appointment ID
    const appointmentId = req.params.id.toString(); // Explicitly treat id as string

    const recordDate = date ? new Date(date) : new Date(application.recordDate);
    if (isNaN(recordDate.getTime())) {
      return res.status(400).json({ error: "Invalid record date format" });
    }

    const parsedDate = recordDate.toISOString().split("T")[0]; // YYYY-MM-DD (UTC)
    const parsedStartTime = startTime || recordDate.toTimeString().split(" ")[0].slice(0, 5); // HH:MM (UTC)
    if (!isValidTime(parsedStartTime)) {
      return res.status(400).json({ error: "Invalid start time format" });
    }
    const parsedEndTime = endTime || new Date(recordDate.getTime() + 60 * 60 * 1000).toTimeString().split(" ")[0].slice(0, 5); // +1 hour
    if (!isValidTime(parsedEndTime)) {
      return res.status(400).json({ error: "Invalid end time format" });
    }

    if (!isValidTimeRange(parsedStartTime, parsedEndTime)) {
      return res.status(400).json({ error: "End time must be after start time!" });
    }

    const effectivePatientName = patientName || `${application.patient.firstName || ""} ${application.patient.middleName || ""} ${application.patient.lastName || ""}`.trim() || "Unknown Patient";
    const effectiveDoctorName = doctorName || `${application.doctor.firstName || ""} ${application.doctor.middleName || ""} ${application.doctor.lastName || ""}`.trim() || "Unknown Doctor";

    const updatedAppointment = await Appointment.findOneAndUpdate(
      { id: appointmentId }, // Use string id, not ObjectId
      {
        patientName: effectivePatientName,
        doctorName: effectiveDoctorName,
        specialty: specialty || application.specialty || "Unknown Specialty",
        appointmentMode: appointmentMode || application.appointmentMode || "Online",
        startTime: parsedStartTime,
        endTime: parsedEndTime,
        date: parsedDate,
        appointmentStatus: appointmentStatus || application.appointmentStatus || "New",
      },
      { new: true, runValidators: true, upsert: true } // Use upsert to create if not exists
    );

    if (!updatedAppointment) {
      return res.status(404).json({ error: "Appointment not found and could not be created" });
    }

    if (io) {
      io.emit("updateAppointment", updatedAppointment); // Emit to Tasks.jsx
    }

    res.status(200).json({ message: "Appointment updated successfully", appointment: updatedAppointment });
  } catch (error) {
    console.error("Error updating appointment - detailed stack:", error.stack);
    res.status(500).json({ error: error.message || "Internal Server Error", stack: error.stack });
  }
});

// DELETE: Delete an appointment when application is deleted
router.delete("/:id", async (req, res) => {
  try {
    console.log("DELETE /api/appointments/:id params:", req.params); // Log the params for debugging
    const appointment = await Appointment.findOne({ id: req.params.id.toString() }); // Explicitly treat id as string
    if (!appointment) return res.status(404).json({ message: "Appointment not found" });

    await appointment.deleteOne();

    if (io) {
      io.emit("deleteApplication", req.params.id); // Notify Tasks.jsx with the appointment ID (matches application.id)
    }

    res.json({ message: "Appointment deleted successfully" });
  } catch (error) {
    console.error("Error deleting appointment - detailed stack:", error.stack);
    res.status(500).json({ message: error.message, stack: error.stack });
  }
});

// GET: Fetch appointments with optional date range or specific date filtering (bypassing ObjectId completely)
router.get("/", async (req, res) => {
  try {
    console.log("GET /api/appointments query received:", req.query); // Log the query parameters
    const { date, startDate, endDate, executor } = req.query;

    let query = {};

    // Removed ObjectID validations – simply pass the date parameters as provided.
    if (date) {
      query.date = date;
    } else if (startDate && endDate) {
      query.date = {
        $gte: startDate,
        $lte: endDate,
      };
    } else {
      // Default to current month if no parameters, but log a warning
      console.warn("No date or date range provided, fetching all appointments for the current month");
      const today = new Date();
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      query.date = {
        $gte: startOfMonth.toISOString().split("T")[0],
        $lte: endOfMonth.toISOString().split("T")[0],
      };
    }

    // Filter by executor (doctor name for appointments)
    if (executor) {
      query.doctorName = executor;
    }

    // Validate startTime and endTime if present, using task-routes.js logic
    const appointments = await Appointment.find(query).sort({ startTime: 1 });
    const validAppointments = appointments.filter(appointment => {
      if (appointment.startTime && appointment.endTime) {
        if (!isValidTime(appointment.startTime) || !isValidTime(appointment.endTime)) {
          console.warn(`Invalid time format for appointment ${appointment.id}: startTime=${appointment.startTime}, endTime=${appointment.endTime}`);
          return false;
        }
        if (!isValidTimeRange(appointment.startTime, appointment.endTime)) {
          console.warn(`Invalid time range for appointment ${appointment.id}: startTime=${appointment.startTime}, endTime=${appointment.endTime}`);
          return false;
        }
      }
      return true;
    });

    console.log("Query for Appointment.find:", query); // Log the query before fetching
    console.log("Appointments fetched:", validAppointments); // Log the results
    res.status(200).json(validAppointments);
  } catch (error) {
    console.error("Error fetching appointments - detailed stack:", error.stack);
    res.status(500).json({ message: "Error fetching appointments", error: error.message, stack: error.stack });
  }
});

// New route: Fetch unique doctors from appointments (via doctorName)
router.get("/unique-doctors", async (req, res) => {
    try {
      const doctors = await Appointment.distinct("doctorName");
      const filteredDoctors = doctors.filter(Boolean); // Remove null/undefined values
      res.json(filteredDoctors);
    } catch (error) {
      console.error("Error fetching unique doctors:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
  
  // New route: Filter appointments by doctorName
router.get("/filter-by-doctor", async (req, res) => {
    try {
      const { doctorName, startDate, endDate } = req.query;
      let query = { doctorName };
  
      if (startDate && endDate) {
        query.date = {
          $gte: startDate,
          $lte: endDate,
        };
      }
  
      const appointments = await Appointment.find(query).sort({ startTime: 1 });
      res.json(appointments);
    } catch (error) {
      console.error("Error filtering appointments by doctor:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

router.get("/all-appointments", async (req, res) => {
    try {
      const { startDate, endDate, date } = req.query;
      let query = {};
  
      if (date) {
        query.date = date;
      } else if (startDate && endDate) {
        query.date = {
          $gte: startDate,
          $lte: endDate,
        };
      }
  
      const appointments = await Appointment.find(query).sort({ startTime: 1 });
      res.json(appointments);
    } catch (error) {
      console.error("Error fetching all appointments:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
  
module.exports = router;
