import React, { useState, useEffect } from "react";
import dayjs from "dayjs"; // Import dayjs
import isSameOrAfter from "dayjs/plugin/isSameOrAfter"; // Import the isSameOrAfter plugin
import isSameOrBefore from "dayjs/plugin/isSameOrBefore"; // Import isSameOrBefore for symmetry
import "../styles/AddTaskModal.css"; // Ensure styles are imported

// Extend dayjs with the plugins
dayjs.extend(isSameOrAfter);
dayjs.extend(isSameOrBefore);

const AddTaskModal = ({ isOpen, onClose, refreshTasks, selectedDate, task }) => {
  const [taskTitle, setTaskTitle] = useState(task?.taskTitle || "");
  const [description, setDescription] = useState(task?.description || "");
  const [executor, setExecutor] = useState(task?.executor || "");
  const [startTime, setStartTime] = useState(task?.startTime || "09:00");
  const [endTime, setEndTime] = useState(task?.endTime || "10:00");
  const [date, setDate] = useState(selectedDate || task?.date || ""); // Store selected date or task date
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null); // Notification message state
  const [existingTasks, setExistingTasks] = useState([]); // Store existing tasks for the date

  // Update date and task fields when modal opens or task changes
  useEffect(() => {
    if (isOpen) {
      setDate(selectedDate || task?.date || "");
      setTaskTitle(task?.taskTitle || "");
      setDescription(task?.description || "");
      setExecutor(task?.executor || "");
      setStartTime(task?.startTime || "09:00");
      setEndTime(task?.endTime || "10:00");
      fetchExistingTasks(); // Fetch existing tasks when modal opens
    }
  }, [isOpen, selectedDate, task]);

  // Fetch existing tasks for the selected date
  const fetchExistingTasks = async () => {
    if (!date) return;
    try {
      const response = await fetch(`${BASE_URL}/api/tasks?date=${date}`);
      if (!response.ok) throw new Error("Failed to fetch existing tasks");
      const tasks = await response.json();
      setExistingTasks(tasks.sort((a, b) => a.startTime.localeCompare(b.startTime)));
    } catch (error) {
      console.error("Error fetching existing tasks:", error);
      setMessage({ type: "error", text: "Failed to check existing tasks. Please try again!" });
    }
  };

  // Function to check if a time slot overlaps with existing tasks
  const checkTimeOverlap = (newStart, newEnd) => {
    const start = dayjs(`2000-01-01 ${newStart}`);
    const end = dayjs(`2000-01-01 ${newEnd}`);

    return existingTasks.some((existingTask) => {
      const existingStart = dayjs(`2000-01-01 ${existingTask.startTime}`);
      const existingEnd = dayjs(`2000-01-01 ${existingTask.endTime}`);

      // Exclude the current task being edited (if any) to avoid self-conflict
      if (task && task._id === existingTask._id) return false;

      // Check for overlap: (start1 < end2) AND (end1 > start2)
      return start.isBefore(existingEnd) && end.isAfter(existingStart);
    });
  };

  // Function to adjust time
  const adjustTime = (type, field, amount) => {
    const [hours, minutes] = (field === "start" ? startTime : endTime).split(":").map(Number);
    let newHours = hours, newMinutes = minutes;

    if (type === "minute") {
      newMinutes += amount;
      if (newMinutes >= 60) {
        newMinutes = 0;
        newHours += 1;
      } else if (newMinutes < 0) {
        newMinutes = 55; // Adjust to nearest 5-minute interval
        newHours -= 1;
      }
    } else {
      newHours += amount;
      if (newHours >= 24) newHours = 0;
      else if (newHours < 0) newHours = 23;
    }

    // Ensure times stay within valid range (00:00–23:59)
    newHours = Math.max(0, Math.min(23, newHours));
    newMinutes = Math.max(0, Math.min(55, newMinutes)); // Snap to 5-minute intervals (0, 5, 10, ..., 55)

    const formattedTime = `${String(newHours).padStart(2, "0")}:${String(newMinutes).padStart(2, "0")}`;

    if (field === "start") {
      if (formattedTime >= endTime) return; // Prevent start time exceeding end time
      setStartTime(formattedTime);
    } else {
      if (formattedTime <= startTime) return; // Prevent end time before start time
      setEndTime(formattedTime);
    }
  };

  // Handle manual time input changes
  const handleTimeChange = (field, value) => {
    const [hours, minutes] = value.split(":").map(Number);
    if (hours >= 0 && hours < 24 && minutes >= 0 && minutes < 60) {
      const formattedTime = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
      if (field === "start") {
        if (formattedTime >= endTime) return;
        setStartTime(formattedTime);
      } else {
        if (formattedTime <= startTime) return;
        setEndTime(formattedTime);
      }
    }
  };

  // Function to validate task inputs
  const validateTask = () => {
    if (!taskTitle || !executor) {
      setMessage({ type: "error", text: "Task Title & Executor are required!" });
      return false;
    }

    if (!date) {
      setMessage({ type: "error", text: "Task date is missing. Please select a date!" });
      return false;
    }

    const start = dayjs(`2000-01-01 ${startTime}`);
    const end = dayjs(`2000-01-01 ${endTime}`);

    if (!start.isValid() || !end.isValid()) {
      setMessage({ type: "error", text: "Invalid time format. Please enter valid times (HH:MM)." });
      return false;
    }

    if (end.isBefore(start)) {
      setMessage({ type: "error", text: "End time must be after start time!" });
      return false;
    }

    if (checkTimeOverlap(startTime, endTime)) {
      setMessage({ type: "error", text: "This time slot conflicts with an existing task. Please choose a different time." });
      return false;
    }

    return true;
  };

  // Function to save or update task
  const handleSave = async () => {
    if (!validateTask()) return;

    setLoading(true);
    setMessage(null); // Clear previous messages

    try {
      const method = task ? "PUT" : "POST"; // Use PUT for editing, POST for adding
      const url = task ? `${BASE_URL}/api/tasks/${task._id}` : "${BASE_URL}/api/tasks";
      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        }, // Ensure no JWT token is included
        body: JSON.stringify({ 
          taskTitle, 
          description, 
          executor, 
          startTime, 
          endTime, 
          date // Use updated date state
        }),
      });

      const result = await response.json(); // Parse response JSON

      if (!response.ok) {
        throw new Error(result.error || result.message || `HTTP error! status: ${response.status}`);
      }

      setMessage({ type: "success", text: `Task ${task ? "updated" : "added"} successfully!` });

      // Reset form fields if adding a new task
      if (!task) {
        setTaskTitle("");
        setDescription("");
        setExecutor("");
        setStartTime("09:00");
        setEndTime("10:00");
      }

      // Refresh tasks and close modal after a short delay
      setTimeout(() => {
        setMessage(null);
        onClose();
        refreshTasks(); // Use the refresh function passed from Tasks.jsx
      }, 1000); // 1-second delay for user feedback
    } catch (error) {
      console.error("Error saving task:", error);
      setMessage({ 
        type: "error", 
        text: error.message || "Failed to save task. Please try again!"
      });
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" role="dialog" aria-labelledby="modal-title">
      <div className="modal-content">
        {/* Close Button */}
        <button 
          className="close-btn" 
          onClick={onClose} 
          aria-label="Close modal"
          tabIndex={0}
          onKeyPress={(e) => e.key === "Enter" && onClose()}
        >
          ✕
        </button>

        <h2 id="modal-title" className="modal-title">Add New Task</h2>

        {/* Notification Message */}
        {message && (
          <div 
            className={`alert ${message.type === "success" ? "alert-success" : "alert-error"}`}
            role="alert"
          >
            {message.text}
          </div>
        )}

        <div className="form-group">
          <label htmlFor="task-title">Task Title</label>
          <input 
            type="text" 
            id="task-title"
            value={taskTitle} 
            onChange={(e) => setTaskTitle(e.target.value)} 
            placeholder="Enter task title"
            aria-label="Task title"
          />
        </div>

        <div className="form-group">
          <label htmlFor="description">Description</label>
          <textarea 
            id="description"
            value={description} 
            onChange={(e) => setDescription(e.target.value)} 
            placeholder="Enter task description"
            aria-label="Task description"
          />
        </div>

        <div className="form-group">
          <label htmlFor="executor">Executor</label>
          <input 
            type="text" 
            id="executor"
            value={executor} 
            onChange={(e) => setExecutor(e.target.value)} 
            placeholder="Enter executor name"
            aria-label="Executor name"
          />
        </div>

        <div className="form-group">
          <label htmlFor="date">Selected Date</label>
          <input 
            type="date" 
            id="date"
            value={date} 
            onChange={(e) => {
              setDate(e.target.value);
              fetchExistingTasks(); // Fetch new tasks when date changes
            }} 
            aria-label="Task date"
          />
        </div>

        <div className="time-selection">
          <label htmlFor="start-time">Start Time</label>
          <div className="time-controls">
            <button 
              onClick={() => adjustTime("hour", "start", -1)} 
              aria-label="Decrease start hour"
            >
              «
            </button>
            <button 
              onClick={() => adjustTime("minute", "start", -5)} 
              aria-label="Decrease start minute"
            >
              ‹
            </button>
            <input
              type="time"
              id="start-time"
              className="time-input"
              value={startTime}
              onChange={(e) => handleTimeChange("start", e.target.value)}
              step="300" // 5-minute intervals
              aria-label="Start time"
            />
            <button 
              onClick={() => adjustTime("minute", "start", 5)} 
              aria-label="Increase start minute"
            >
              ›
            </button>
            <button 
              onClick={() => adjustTime("hour", "start", 1)} 
              aria-label="Increase start hour"
            >
              »
            </button>
          </div>
        </div>

        <div className="time-selection">
          <label htmlFor="end-time">End Time</label>
          <div className="time-controls">
            <button 
              onClick={() => adjustTime("hour", "end", -1)} 
              aria-label="Decrease end hour"
            >
              «
            </button>
            <button 
              onClick={() => adjustTime("minute", "end", -5)} 
              aria-label="Decrease end minute"
            >
              ‹
            </button>
            <input
              type="time"
              id="end-time"
              className="time-input"
              value={endTime}
              onChange={(e) => handleTimeChange("end", e.target.value)}
              step="300" // 5-minute intervals
              aria-label="End time"
            />
            <button 
              onClick={() => adjustTime("minute", "end", 5)} 
              aria-label="Increase end minute"
            >
              ›
            </button>
            <button 
              onClick={() => adjustTime("hour", "end", 1)} 
              aria-label="Increase end hour"
            >
              »
            </button>
          </div>
        </div>

        {/* Save Button with Loading Effect */}
        <button 
          className="save-btn" 
          onClick={handleSave} 
          disabled={loading}
          aria-label="Save task"
        >
          {loading ? (
            <span className="loading-spinner">Saving...</span>
          ) : task ? "Update Task" : "Save Task"}
        </button>
      </div>
    </div>
  );
};

export default AddTaskModal;