const mongoose = require("mongoose");

const TaskSchema = new mongoose.Schema({
  taskTitle: { type: String, required: true },
  description: { type: String },
  executor: { type: String, required: true },
  startTime: { type: String, required: true },
  endTime: { type: String, required: true },
  date: { type: String, required: true } // NEW: Store the selected date
});

module.exports = mongoose.model("Task", TaskSchema);
