const express = require("express");
const router = express.Router();
const Task = require("../models/Task"); // Import Task model
const Doctor = require("../models/Doctor"); // Import Doctor model (added to fix ReferenceError)
const { Server } = require("socket.io"); // For WebSocket

let io;
router.use((req, res, next) => {
  io = req.app.get("socketio"); // Get Socket.IO instance from app
  next();
});

// Helper functions
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

// GET: Fetch doctors for executor filter
router.get("/doctors", async (req, res) => {
  try {
    console.log("GET /api/tasks/doctors query received:", req.query); // Debugging log
    const doctors = await Doctor.find().select("firstName middleName lastName");
    const doctorNames = doctors.map((doctor) =>
      `${doctor.firstName || ""} ${doctor.middleName || ""} ${doctor.lastName || ""}`.trim()
    ).filter(Boolean);
    res.status(200).json(doctorNames);
  } catch (error) {
    console.error("Error fetching doctors - detailed stack:", error.stack);
    res.status(500).json({ error: "Failed to fetch doctors", stack: error.stack });
  }
});

// POST: Create a new task
router.post("/", async (req, res) => {
  try {
    const { taskTitle, description, executor, startTime, endTime, date } = req.body;

    if (!taskTitle || !executor || !date) {
      return res.status(400).json({ error: "Task Title, Executor, and Date are required!" });
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: "Invalid date format. Use YYYY-MM-DD." });
    }

    if (!isValidTime(startTime) || !isValidTime(endTime)) {
      return res.status(400).json({ error: "Invalid time format. Use HH:MM (24-hour)." });
    }

    if (!isValidTimeRange(startTime, endTime)) {
      return res.status(400).json({ error: "End time must be after start time!" });
    }

    const newTask = new Task({ taskTitle, description, executor, startTime, endTime, date });
    await newTask.save();

    if (io) {
      io.emit("newTask", newTask); // Emit to all connected clients
    }

    res.status(201).json({ message: "Task created successfully", task: newTask });
  } catch (error) {
    console.error("Error saving task - detailed stack:", error.stack);
    res.status(500).json({ error: error.message || "Internal Server Error", stack: error.stack });
  }
});

// GET: Fetch tasks with optional date range or specific date filtering
router.get("/", async (req, res) => {
  try {
    console.log("GET /api/tasks query received:", req.query); // Log the query parameters
    const { startDate, endDate, date, executor } = req.query;

    let query = {};

    if (date) {
      query.date = date;
    } else if (startDate && endDate) {
      query.date = {
        $gte: startDate,
        $lte: endDate,
      };
    } else {
      // Default to current month if no parameters, but log a warning
      console.warn("No date or date range provided, fetching all tasks");
      const today = new Date();
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      query.date = {
        $gte: startOfMonth.toISOString().split("T")[0],
        $lte: endOfMonth.toISOString().split("T")[0],
      };
    }

    console.log("Query for Task.find:", query); // Log the query before fetching
    const tasks = await Task.find(query).sort({ startTime: 1 });
    console.log("Tasks fetched:", tasks); // Log the results
    res.status(200).json(tasks);
  } catch (error) {
    console.error("Error fetching tasks - detailed stack:", error.stack);
    res.status(500).json({ message: "Error fetching tasks", error: error.message, stack: error.stack });
  }
});

// PUT: Update an existing task
router.put("/:id", async (req, res) => {
  try {
    const { taskTitle, description, executor, startTime, endTime, date } = req.body;

    if (!taskTitle || !executor || !date) {
      return res.status(400).json({ error: "Task Title, Executor, and Date are required!" });
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: "Invalid date format. Use YYYY-MM-DD." });
    }

    if (!isValidTime(startTime) || !isValidTime(endTime)) {
      return res.status(400).json({ error: "Invalid time format. Use HH:MM (24-hour)." });
    }

    if (!isValidTimeRange(startTime, endTime)) {
      return res.status(400).json({ error: "End time must be after start time!" });
    }

    const currentTask = await Task.findById(req.params.id);
    if (!currentTask) {
      return res.status(404).json({ error: "Task not found" });
    }

    const existingTasks = await Task.find({ date, _id: { $ne: req.params.id } });
    const hasOverlap = existingTasks.some((existingTask) =>
      checkTimeOverlap(startTime, endTime, existingTask.startTime, existingTask.endTime)
    );

    if (hasOverlap) {
      return res.status(409).json({ error: "This time slot conflicts with an existing task. Please choose a different time." });
    }

    const updatedTask = await Task.findByIdAndUpdate(
      req.params.id,
      { taskTitle, description, executor, startTime, endTime, date },
      { new: true, runValidators: true }
    );

    if (io) {
      io.emit("updateTask", updatedTask); // Emit to all connected clients
    }

    res.status(200).json({ message: "Task updated successfully", task: updatedTask });
  } catch (error) {
    console.error("Error updating task - detailed stack:", error.stack);
    res.status(500).json({ error: error.message || "Internal Server Error", stack: error.stack });
  }
});

// DELETE: Delete a task
router.delete("/:id", async (req, res) => {
  try {
    const deletedTask = await Task.findByIdAndDelete(req.params.id);

    if (!deletedTask) {
      return res.status(404).json({ error: "Task not found" });
    }

    if (io) {
      io.emit("deleteTask", deletedTask._id); // Emit to all connected clients
    }

    res.status(200).json({ message: "Task deleted successfully" });
  } catch (error) {
    console.error("Error deleting task - detailed stack:", error.stack);
    res.status(500).json({ error: error.message || "Internal Server Error", stack: error.stack });
  }
});

// PATCH: Reschedule a task (update startTime and endTime)
router.patch("/:id", async (req, res) => {
  try {
    const { startTime, endTime } = req.body;

    if (!startTime || !endTime) {
      return res.status(400).json({ error: "startTime and endTime are required!" });
    }

    if (!isValidTime(startTime) || !isValidTime(endTime)) {
      return res.status(400).json({ error: "Invalid time format. Use HH:MM (24-hour)." });
    }

    if (!isValidTimeRange(startTime, endTime)) {
      return res.status(400).json({ error: "End time must be after start time!" });
    }

    const currentTask = await Task.findById(req.params.id);
    if (!currentTask) {
      return res.status(404).json({ error: "Task not found" });
    }

    const existingTasks = await Task.find({ date: currentTask.date, _id: { $ne: req.params.id } });
    const hasOverlap = existingTasks.some((existingTask) =>
      checkTimeOverlap(startTime, endTime, existingTask.startTime, existingTask.endTime)
    );

    if (hasOverlap) {
      return res.status(409).json({ error: "This time slot conflicts with an existing task. Please choose a different time." });
    }

    const updatedTask = await Task.findByIdAndUpdate(
      req.params.id,
      { startTime, endTime },
      { new: true, runValidators: true }
    );

    if (io) {
      io.emit("updateTask", updatedTask); // Emit to all connected clients
    }

    res.status(200).json({ message: "Task rescheduled successfully", task: updatedTask });
  } catch (error) {
    console.error("Error rescheduling task - detailed stack:", error.stack);
    res.status(500).json({ error: error.message || "Internal Server Error", stack: error.stack });
  }
});

// GET: Fetch tasks (removed appointments logic, now handled by appointment-routes.js)
router.get("/", async (req, res) => {
  try {
    console.log("GET /api/tasks query received:", req.query); // Log the query parameters
    const { startDate, endDate, date, executor } = req.query;

    let query = {};

    if (date) {
      query.date = date;
    } else if (startDate && endDate) {
      query.date = {
        $gte: startDate,
        $lte: endDate,
      };
    } else {
      // Default to current month if no parameters, but log a warning
      console.warn("No date or date range provided, fetching all tasks");
      const today = new Date();
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
      const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      query.date = {
        $gte: startOfMonth.toISOString().split("T")[0],
        $lte: endOfMonth.toISOString().split("T")[0],
      };
    }

    console.log("Query for Task.find:", query); // Log the query before fetching
    const tasks = await Task.find(query).sort({ startTime: 1 });
    console.log("Tasks fetched:", tasks); // Log the results
    res.status(200).json(tasks);
  } catch (error) {
    console.error("Error fetching tasks - detailed stack:", error.stack);
    res.status(500).json({ message: "Error fetching tasks", error: error.message, stack: error.stack });
  }
});

// New route: Fetch unique executors from tasks
router.get("/unique-executors", async (req, res) => {
  try {
    const executors = await Task.distinct("executor");
    const filteredExecutors = executors.filter(Boolean); // Remove null/undefined values
    res.json(filteredExecutors);
  } catch (error) {
    console.error("Error fetching unique executors:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// New route: Filter tasks by executor (optional, for consistency with appointments)
router.get("/filter-by-executor", async (req, res) => {
  try {
    const { executor, startDate, endDate } = req.query;
    let query = { executor };

    if (startDate && endDate) {
      query.date = {
        $gte: startDate,
        $lte: endDate,
      };
    }

    const tasks = await Task.find(query).sort({ startTime: 1 });
    res.json(tasks);
  } catch (error) {
    console.error("Error filtering tasks by executor:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/all-tasks", async (req, res) => {
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

    const tasks = await Task.find(query).sort({ startTime: 1 });
    res.json(tasks);
  } catch (error) {
    console.error("Error fetching all tasks:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});


module.exports = router;