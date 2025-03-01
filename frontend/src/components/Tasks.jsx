import React, { useState, useEffect } from "react";
import ReactDOM from "react-dom";
import dayjs from "dayjs";
import isSameOrAfter from "dayjs/plugin/isSameOrAfter";
import isSameOrBefore from "dayjs/plugin/isSameOrBefore";
import DashboardLayout from "./DashboardLayout";
import "../styles/Tasks.css";
import AddTaskModal from "./AddTaskModal";
import EditTaskModal from "./EditTaskModal";
import { DayPicker } from "react-day-picker";
import "react-day-picker/dist/style.css";
import { io } from "socket.io-client"; // Import socket.io-client
import axios from "axios"; // Import axios for API calls
import { useNavigate } from "react-router-dom"; // Import for navigation

// Extend dayjs with plugins
dayjs.extend(isSameOrAfter);
dayjs.extend(isSameOrBefore);

const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const socket = io("http://localhost:5001"); // Connect to backend WebSocket

const TaskTooltip = ({ item, position, onClose }) => { // Updated to handle both tasks and appointments
  if (!item) return null;

  // Use a unique key for the tooltip based on item type and ID
  const tooltipKey = `${item.id ? "appointment-tooltip-" : "task-tooltip-"}${item._id || item.id}`;

  return ReactDOM.createPortal(
    <div
      key={tooltipKey} // Ensure unique key for the tooltip
      className="task-tooltip"
      style={{
        position: "absolute",
        left: position.x,
        top: position.y,
      }}
      onMouseLeave={onClose}
    >
      <div className="task-tooltip-content">
        <strong>{item.taskTitle || item.id}</strong>
        <p>Description: {item.description || `${item.patientName} - ${item.appointmentMode}` || "N/A"}</p>
        <p>Executor/Doctor: {item.executor || item.doctorName}</p>
        <p>Start: {item.startTime || "09:00"}</p>
        <p>End: {item.endTime || "10:00"}</p>
      </div>
    </div>,
    document.body
  );
};

const FilterModal = ({ isOpen, onClose, onApply, executors }) => {
  const [fromDate, setFromDate] = useState(null);
  const [toDate, setToDate] = useState(null);
  const [selectedExecutor, setSelectedExecutor] = useState("");

  const handleApply = () => {
    if (fromDate && toDate && dayjs(fromDate).isAfter(dayjs(toDate))) {
      alert("From date must be before To date.");
      return;
    }
    onApply({ fromDate, toDate, executor: selectedExecutor });
    onClose();
  };

  const handleReset = () => {
    setFromDate(null);
    setToDate(null);
    setSelectedExecutor("");
  };

  if (!isOpen) return null;

  return ReactDOM.createPortal(
    <div className="filter-modal-overlay" onClick={onClose}>
      <div className="filter-modal" onClick={(e) => e.stopPropagation()}>
        <h3 className="filter-modal-title">Filter Tasks & Appointments</h3>
        <div className="filter-modal-content">
          <div className="filter-section">
            <label>From</label>
            <DayPicker
              mode="single"
              selected={fromDate}
              onSelect={(date) => setFromDate(date)}
              captionLayout="dropdown"
              required
              showOutsideDays
              aria-label="Select start date"
            />
          </div>
          <div className="filter-section">
            <label>To</label>
            <DayPicker
              mode="single"
              selected={toDate}
              onSelect={(date) => setToDate(date)}
              captionLayout="dropdown"
              required
              showOutsideDays
              aria-label="Select end date"
            />
          </div>
          <div className="filter-section">
            <label>Executor/Doctor</label>
            <select
              value={selectedExecutor}
              onChange={(e) => setSelectedExecutor(e.target.value)}
              className="executor-select"
              aria-label="Select executor or doctor"
            >
              <option value="">All Executors/Doctors</option>
              {executors.map((executor) => (
                <option key={executor} value={executor}>
                  {executor}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="filter-modal-actions">
          <button onClick={handleReset} className="reset-btn">
            Reset
          </button>
          <button onClick={onClose} className="cancel-btn">
            Cancel
          </button>
          <button onClick={handleApply} className="apply-btn">
            Apply
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

// Helper function to validate and format date as YYYY-MM-DD
const formatDateForAPI = (date) => {
  if (!date) return null;
  const formatted = dayjs(date).format("YYYY-MM-DD");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(formatted)) {
    throw new Error(`Invalid date format for ${date}: expected YYYY-MM-DD, got ${formatted}`);
  }
  return formatted;
};

const Tasks = () => {
  const navigate = useNavigate();
  const [currentMonth, setCurrentMonth] = useState(dayjs());
  const [items, setItems] = useState({}); // Renamed from tasks to handle both tasks and appointments
  const [selectedDate, setSelectedDate] = useState(null);
  const [itemsForDay, setItemsForDay] = useState([]); // Renamed from tasksForDay
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null); // Renamed from selectedTask
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [tooltip, setTooltip] = useState({ show: false, item: null, position: { x: 0, y: 0 } }); // Renamed from task to item
  const [dayPickerOpen, setDayPickerOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [filter, setFilter] = useState({ fromDate: null, toDate: null, executor: "" });
  const [uniqueExecutors, setUniqueExecutors] = useState([]); // List of unique executors/doctors

  useEffect(() => {
    if (currentMonth) {
      fetchMonthItems();
    }
    fetchUniqueExecutors();
    // Socket listeners for real-time updates
    socket.on("newTask", (newTask) => {
      console.log("New task received:", newTask);
      setItems((prev) => {
        const date = newTask.date;
        const currentItems = prev[date] || [];
        return { ...prev, [date]: [...currentItems, newTask].sort((a, b) => a.startTime.localeCompare(b.startTime)) };
      });
      if (selectedDate === newTask.date) {
        setItemsForDay((prev) => [...prev, newTask].sort((a, b) => a.startTime.localeCompare(b.startTime)));
      }
    });
    socket.on("updateTask", (updatedTask) => {
      console.log("Updated task received:", updatedTask);
      setItems((prev) => {
        const date = updatedTask.date;
        const currentItems = prev[date] || [];
        return { ...prev, [date]: currentItems.map((t) => (t._id === updatedTask._id ? updatedTask : t)).sort((a, b) => a.startTime.localeCompare(b.startTime)) };
      });
      if (selectedDate === updatedTask.date) {
        setItemsForDay((prev) => prev.map((t) => (t._id === updatedTask._id ? updatedTask : t)).sort((a, b) => a.startTime.localeCompare(b.startTime)));
      }
    });
    socket.on("deleteTask", (taskId) => {
      console.log("Task deletion received for ID:", taskId);
      setItems((prev) => {
        const updatedItems = {};
        for (const date in prev) {
          updatedItems[date] = prev[date].filter((t) => t._id !== taskId).sort((a, b) => a.startTime.localeCompare(b.startTime));
          if (updatedItems[date].length === 0) delete updatedItems[date];
        }
        return updatedItems;
      });
      if (selectedDate) {
        setItemsForDay((prev) => prev.filter((t) => t._id !== taskId).sort((a, b) => a.startTime.localeCompare(b.startTime)));
      }
    });
    socket.on("newAppointment", (appointment) => {
      console.log("New appointment received:", appointment);
      setItems((prev) => {
        const date = appointment.date;
        const currentItems = prev[date] || [];
        return { ...prev, [date]: [...currentItems, appointment].sort((a, b) => a.startTime.localeCompare(b.startTime)) };
      });
      if (selectedDate === appointment.date) {
        setItemsForDay((prev) => [...prev, appointment].sort((a, b) => a.startTime.localeCompare(b.startTime)));
      }
    });
    socket.on("updateAppointment", (appointment) => {
      console.log("Updated appointment received:", appointment);
      setItems((prev) => {
        const date = appointment.date;
        const currentItems = prev[date] || [];
        return { ...prev, [date]: currentItems.map((t) => (t.id === appointment.id ? appointment : t)).sort((a, b) => a.startTime.localeCompare(b.startTime)) };
      });
      if (selectedDate === appointment.date) {
        setItemsForDay((prev) => prev.map((t) => (t.id === appointment.id ? appointment : t)).sort((a, b) => a.startTime.localeCompare(b.startTime)));
      }
    });
    socket.on("deleteApplication", (applicationId) => {
      console.log("Application deletion received for ID:", applicationId);
      setItems((prev) => {
        const updatedItems = {};
        for (const date in prev) {
          updatedItems[date] = prev[date].filter((item) => !(item.id && item.id === applicationId)).sort((a, b) => a.startTime.localeCompare(b.startTime));
          if (updatedItems[date].length === 0) delete updatedItems[date];
        }
        return updatedItems;
      });
      if (selectedDate) {
        setItemsForDay((prev) => prev.filter((item) => !(item.id && item.id === applicationId)).sort((a, b) => a.startTime.localeCompare(b.startTime)));
      }
    });

    return () => {
      socket.off("newTask");
      socket.off("updateTask");
      socket.off("deleteTask");
      socket.off("newAppointment");
      socket.off("updateAppointment");
      socket.off("deleteApplication");
    };
  }, [currentMonth, filter, selectedDate]);

  const generateCalendarDays = () => {
    if (filter.fromDate && filter.toDate) {
      const start = dayjs(filter.fromDate).startOf("day");
      const end = dayjs(filter.toDate).endOf("day");
      let days = [];
      let day = start;

      while (day.isBefore(end, "day") || day.isSame(end, "day")) {
        days.push(day);
        day = day.add(1, "day");
      }

      return days;
    } else {
      const startOfMonth = currentMonth.startOf("month");
      const endOfMonth = currentMonth.endOf("month");
      const startOfWeek = startOfMonth.startOf("week");
      const endOfWeek = endOfMonth.endOf("week");

      let days = [];
      let day = startOfWeek;

      while (day.isBefore(endOfWeek, "day")) {
        days.push(day);
        day = day.add(1, "day");
      }

      return days;
    }
  };

  const fetchUniqueExecutors = async () => {
    try {
      // Fetch unique executors from tasks
      const taskExecutorsResponse = await axios.get("http://localhost:5001/api/tasks/unique-executors");
      const taskExecutors = taskExecutorsResponse.data.filter(Boolean);

      // Fetch unique doctors from appointments
      const doctorNamesResponse = await axios.get("http://localhost:5001/api/appointments/unique-doctors");
      const doctorNames = doctorNamesResponse.data.filter(Boolean);

      // Combine and deduplicate executors and doctors
      setUniqueExecutors([...new Set([...taskExecutors, ...doctorNames])]);
    } catch (error) {
      console.error("Error fetching executors and doctors:", error);
      setUniqueExecutors([]);
    }
  };

  const fetchMonthItems = async () => {
    setLoading(true);
    setError("");
    try {
      let startDate, endDate;
      if (filter.fromDate && filter.toDate) {
        startDate = formatDateForAPI(filter.fromDate);
        endDate = formatDateForAPI(filter.toDate);
      } else if (currentMonth) {
        startDate = formatDateForAPI(currentMonth.startOf("month").startOf("week"));
        endDate = formatDateForAPI(currentMonth.endOf("month").endOf("week"));
      } else {
        throw new Error("No valid date range or current month available");
      }

      console.log(`Fetching items for date range: startDate=${startDate}, endDate=${endDate}`);
      let tasksResponse, appointmentsResponse;

      if (!filter.executor || filter.executor === "") {
        // Fetch all tasks and appointments when no executor/doctor is selected
        tasksResponse = await axios.get(`http://localhost:5001/api/tasks/all-tasks?startDate=${startDate}&endDate=${endDate}`);
        appointmentsResponse = await axios.get(`http://localhost:5001/api/appointments/all-appointments?startDate=${startDate}&endDate=${endDate}`);
      } else {
        // Fetch filtered tasks and appointments when an executor/doctor is selected
        tasksResponse = await axios.get(
          `http://localhost:5001/api/tasks/filter-by-executor?startDate=${startDate}&endDate=${endDate}&executor=${encodeURIComponent(filter.executor)}`
        );
        appointmentsResponse = await axios.get(
          `http://localhost:5001/api/appointments/filter-by-doctor?startDate=${startDate}&endDate=${endDate}&doctorName=${encodeURIComponent(filter.executor)}`
        ).catch(error => {
          console.error("Error fetching appointments:", error.response?.data || error.message);
          return { data: [] }; // Fallback to empty array if API fails
        });
      }

      const tasks = tasksResponse.data || [];
      const appointments = appointmentsResponse.data || [];
      const combinedItems = [...tasks, ...appointments]
        .filter(item => {
          if (!filter.executor || filter.executor === "") return true; // Show all if no executor filter
          return item.executor === filter.executor || (item.doctorName && item.doctorName === filter.executor);
        })
        .sort((a, b) => a.startTime.localeCompare(b.startTime));

      const itemsByDate = combinedItems.reduce((acc, item) => {
        const date = item.date; // Ensure date is a string in YYYY-MM-DD format
        if (!acc[date]) acc[date] = [];
        acc[date].push(item);
        return acc;
      }, {});

      setItems(itemsByDate);
    } catch (err) {
      setError(err.message || "Error fetching items");
      setItems({});
      console.error("Fetch month items error:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchDayItems = async (date) => {
    setLoading(true);
    setError("");
    try {
      if (!date) throw new Error("No date provided for day items");
      const formattedDate = formatDateForAPI(date); // Use validated YYYY-MM-DD format
      console.log(`Fetching items for date: http://localhost:5001/api/tasks?date=${formattedDate}`);
      console.log(`Fetching items for date: http://localhost:5001/api/appointments?date=${formattedDate}`);
      let tasksResponse, appointmentsResponse;

      if (!filter.executor || filter.executor === "") {
        // Fetch all tasks and appointments for the specific date when no executor/doctor is selected
        tasksResponse = await axios.get(`http://localhost:5001/api/tasks/all-tasks?date=${formattedDate}`);
        appointmentsResponse = await axios.get(`http://localhost:5001/api/appointments/all-appointments?date=${formattedDate}`);
      } else {
        // Fetch filtered tasks and appointments for the specific date when an executor/doctor is selected
        tasksResponse = await axios.get(
          `http://localhost:5001/api/tasks/filter-by-executor?date=${formattedDate}&executor=${encodeURIComponent(filter.executor)}`
        );
        appointmentsResponse = await axios.get(
          `http://localhost:5001/api/appointments/filter-by-doctor?date=${formattedDate}&doctorName=${encodeURIComponent(filter.executor)}`
        ).catch(error => {
          console.error("Error fetching appointments for day:", error.response?.data || error.message);
          return { data: [] }; // Fallback to empty array if API fails
        });
      }

      const tasks = tasksResponse.data || [];
      const appointments = appointmentsResponse.data || [];
      const combinedItems = [...tasks, ...appointments]
        .filter(item => {
          if (!filter.executor || filter.executor === "") return true; // Show all if no executor filter
          return item.executor === filter.executor || (item.doctorName && item.doctorName === filter.executor);
        })
        .sort((a, b) => a.startTime.localeCompare(b.startTime));

      setItemsForDay(combinedItems);
    } catch (err) {
      setError(err.message || "Error fetching items for day");
      setItemsForDay([]);
      console.error("Fetch day items error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleDayClick = (date) => {
    const formattedDate = formatDateForAPI(date);
    setSelectedDate(formattedDate);
    fetchDayItems(formattedDate);
  };

  const goBackToMonthView = () => {
    setSelectedDate(null);
    setItemsForDay([]);
  };

  const openAddTaskModal = () => {
    setSelectedItem(null);
    setAddModalOpen(true);
  };

  const openEditTaskModal = (item = null) => {
    if (item && item.taskTitle && !item.id) { // Task
      setSelectedItem(item);
    } else if (item && item.id) { // Appointment
      // Redirect to edit application instead of opening edit modal
      navigate(`/applications/edit/${item.id}`);
      return;
    }
    setEditModalOpen(true);
  };

  const handleTaskAddedOrUpdated = (newOrUpdatedTask) => {
    socket.emit(newOrUpdatedTask._id ? "updateTask" : "newTask", newOrUpdatedTask);
    setAddModalOpen(false);
    setEditModalOpen(false);
  };

  const handleTaskDeleted = (taskId, taskDate) => {
    socket.emit("deleteTask", taskId);
    setEditModalOpen(false);
  };

  const goToToday = () => {
    const today = dayjs();
    const formattedToday = formatDateForAPI(today);
    setCurrentMonth(today);
    setSelectedDate(formattedToday);
    setFilter({ fromDate: null, toDate: null, executor: "" });
    fetchDayItems(formattedToday);
  };

  const handleTooltip = (item, event) => {
    const bubbleRect = event.currentTarget.getBoundingClientRect();
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;

    let x = bubbleRect.right + scrollX + 10;
    let y = bubbleRect.top + scrollY;

    const tooltipWidth = 220;
    if (x + tooltipWidth > window.innerWidth) {
      x = bubbleRect.left + scrollX - tooltipWidth - 10;
    }

    setTooltip({ show: true, item, position: { x, y } });
  };

  const closeTooltip = () => {
    setTooltip({ show: false, item: null, position: { x: 0, y: 0 } });
  };

  const openDayPicker = () => {
    setDayPickerOpen(true);
  };

  const handleDayPickerSelect = (date) => {
    if (date) {
      const newDate = dayjs(date);
      const formattedDate = formatDateForAPI(newDate);
      setCurrentMonth(newDate);
      setSelectedDate(formattedDate);
      setFilter({ fromDate: null, toDate: null, executor: "" });
      fetchDayItems(formattedDate);
      setDayPickerOpen(false);
    }
  };

  const handleFilterApply = (newFilter) => {
    setFilter({
      fromDate: newFilter.fromDate ? dayjs(newFilter.fromDate).startOf("day").toDate() : null,
      toDate: newFilter.toDate ? dayjs(newFilter.toDate).endOf("day").toDate() : null,
      executor: newFilter.executor,
    });
  };

  const getItemPositionAndHeight = (item) => {
    // Use backend times directly for placement, assuming they are in IST (HH:MM format)
    const start = dayjs(`${item.date} ${item.startTime || "09:00"}`);
    const end = dayjs(`${item.date} ${item.endTime || "10:00"}`);
    const durationMinutes = end.diff(start, "minute");
    const startHour = start.hour();
    const startMinute = start.minute();
    const totalMinutesInDay = 24 * 60;

    const minutesPerPixel = 60 / 60; // 1 pixel per minute (60px per hour)
    const topPosition = (startHour * 60 + startMinute) * minutesPerPixel;
    const height = durationMinutes * minutesPerPixel;

    const maxHeight = totalMinutesInDay * minutesPerPixel;
    return {
      top: `${topPosition}px`,
      height: `${Math.max(20, Math.min(height, maxHeight))}px`,
    };
  };

  const splitOverlappingItems = (items) => {
    if (!items.length) return [];

    const sortedItems = items.sort((a, b) => a.startTime.localeCompare(b.startTime) || a.endTime.localeCompare(b.endTime));
    const result = [];
    const timeSlots = [];

    sortedItems.forEach((item) => {
      const { top, height } = getItemPositionAndHeight(item);
      const start = parseInt(top);
      const end = start + parseInt(height);

      let overlaps = timeSlots.filter(slot => {
        const slotStart = parseInt(slot.top);
        const slotEnd = slotStart + parseInt(slot.height);
        return start < slotEnd && end > slotStart;
      });

      if (overlaps.length === 0) {
        timeSlots.push({ top, height, item });
        result.push({ ...item, style: { ...getItemPositionAndHeight(item), left: "0%", width: "100%" } });
      } else {
        const numSlots = overlaps.length + 1;
        const slotWidth = `${100 / (numSlots)}%`;

        overlaps.forEach((overlap, index) => {
          result.push({
            ...overlap.item,
            style: { ...overlap, left: `${(index) * parseInt(slotWidth)}`, width: slotWidth },
          });
        });

        timeSlots.push({ top, height, item });
        result.push({
          ...item,
          style: { top, height, left: `${(numSlots - 1) * parseInt(slotWidth)}%`, width: slotWidth },
        });
      }
    });

    return result;
  };

  const handleItemBubbleClick = (item) => {
    if (item.id) { // Appointment
      navigate("/applications");
      const applicationTab = document.querySelector('a[href="/applications"]');
      if (applicationTab) {
        applicationTab.style.backgroundColor = "#37b8c0";
        applicationTab.style.boxShadow = "0 0 10px #37b8c0";
        setTimeout(() => {
          applicationTab.style.backgroundColor = "";
          applicationTab.style.boxShadow = "";
        }, 500); // Highlight for 0.5 seconds
      }
    } else if (item.taskTitle) { // Task
      openEditTaskModal(item);
    }
  };

  return (
    <DashboardLayout initialActiveTab="Tasks">
      <div className="tasks-container">
        <div className="tasks-title">Tasks & Appointments</div>
        <div className="view-title">
          {selectedDate ? "Day View" : "Monthly View"}
        </div>

        {!selectedDate && (
          <>
            <div className="tasks-nav">
              <button
                onClick={() => setCurrentMonth(currentMonth.subtract(1, "month"))}
                className="nav-btn"
                aria-label="Previous month"
              >
                ◀
              </button>
              <div className="month-nav">
                <h2 
                  className="month-title" 
                  onClick={openDayPicker} 
                  role="button" 
                  tabIndex={0} 
                  onKeyPress={(e) => e.key === "Enter" && openDayPicker()}
                  aria-label={`Select month range, current: ${filter.fromDate && filter.toDate ? `${dayjs(filter.fromDate).format("MMMM D, YYYY")} – ${dayjs(filter.toDate).format("MMMM D, YYYY")}` : currentMonth.format("MMMM YYYY")}`}
                >
                  {filter.fromDate && filter.toDate
                    ? `${dayjs(filter.fromDate).format("MMMM D, YYYY")} – ${dayjs(filter.toDate).format("MMMM D, YYYY")}`
                    : currentMonth.format("MMMM YYYY")}
                </h2>
                <button onClick={goToToday} className="today-btn">
                  Today
                </button>
              </div>
              <button
                onClick={() => setCurrentMonth(currentMonth.add(1, "month"))}
                className="nav-btn"
                aria-label="Next month"
              >
                ▶
              </button>
            </div>
            <div className="filter-row">
              <button
                onClick={() => setFilterOpen(true)}
                className="filter-btn"
                aria-label="Open filter"
              >
                <span className="filter-icon">≡ Filter</span>
              </button>
            </div>

            <div className="weekdays">
              {weekdays.map((day, index) => (
                <div key={index} className="weekday-label">
                  {day.substring(0, 2)}
                </div>
              ))}
            </div>

            <div className="calendar-grid month-view-scrollable">
              {generateCalendarDays().map((day) => {
                const isToday = day.isSame(dayjs(), "day");
                const isSelected = selectedDate === day.format("YYYY-MM-DD");
                const dayKey = day.format("YYYY-MM-DD");
                const filteredItems = (items[dayKey] || []).filter((item) =>
                  (!filter.executor || item.executor === filter.executor || (item.doctorName && item.doctorName === filter.executor)) &&
                  (!filter.fromDate || dayjs(item.date).isSameOrAfter(dayjs(filter.fromDate), "day")) &&
                  (!filter.toDate || dayjs(item.date).isSameOrBefore(dayjs(filter.toDate), "day"))
                );
                console.log(`Items for ${dayKey}:`, filteredItems);
                return (
                  <div
                    key={dayKey}
                    className={`day-cell ${!filter.fromDate && !filter.toDate && day.month() !== currentMonth.month() ? "faded" : ""} ${
                      isToday ? "today" : ""
                    } ${isSelected ? "selected" : ""}`}
                    onClick={() => handleDayClick(day)}
                    role="button"
                    tabIndex={0}
                    onKeyPress={(e) => e.key === "Enter" && handleDayClick(day)}
                    aria-label={`Day ${day.format("D MMMM YYYY")}, ${
                      filteredItems.length || 0
                    } items`}
                  >
                    <span className="day-number">{day.format("D")}</span>
                    <div className="task-list">
                      {filteredItems
                        .slice(0, 1) // Show only the first appointment
                        .filter(item => item.id) // Filter for appointments only
                        .map((item) => (
                          <div
                            key={`appointment-${item.id}`} // Unique key for appointments
                            className="appointment-bubble"
                            onMouseEnter={(e) => handleTooltip(item, e)}
                            onMouseLeave={closeTooltip}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleItemBubbleClick(item);
                            }}
                            role="button"
                            tabIndex={0}
                            onKeyPress={(e) => e.key === "Enter" && handleItemBubbleClick(item)}
                            aria-label={`${item.startTime || "09:00"} - ${item.endTime || "10:00"} - ${item.id}`}
                          >
                            {item.startTime || "09:00"} - {item.endTime || "10:00"}
                            <span className="item-type"> (Appointment)</span>
                          </div>
                        ))}
                      {filteredItems
                        .slice(0, 1) // Show only the first task
                        .filter(item => !item.id) // Filter for tasks only (no appointments)
                        .map((item) => (
                          <div
                            key={`task-${item._id || item.id}`} // Unique key for tasks
                            className="month-task-bubble"
                            onMouseEnter={(e) => handleTooltip(item, e)}
                            onMouseLeave={closeTooltip}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleItemBubbleClick(item);
                            }}
                            role="button"
                            tabIndex={0}
                            onKeyPress={(e) => e.key === "Enter" && handleItemBubbleClick(item)}
                            aria-label={`${item.startTime || "09:00"} - ${item.endTime || "10:00"} - ${item.taskTitle}`}
                          >
                            {item.startTime || "09:00"} - {item.endTime || "10:00"}
                            <span className="item-type"> (Task)</span>
                          </div>
                        ))}
                      {(filteredItems.length > 2) && ( // Show "+n more" if more than 2 items (1 appointment + 1 task)
                        <div className="more-tasks">
                          +{filteredItems.length - 2} more
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {loading ? (
          <div className="loading-spinner">Loading items...</div>
        ) : error ? (
          <div className="error-message" role="alert">
            {error}
          </div>
        ) : (
          selectedDate && (
            <div className="day-view">
              <div className="day-header">
                <button
                  onClick={goBackToMonthView}
                  className="back-btn"
                  aria-label="Back to month view"
                >
                  ⬅
                </button>
                <h2 className="day-title">{dayjs(selectedDate).format("dddd, MMMM D, YYYY")}</h2>
              </div>

              <div className="time-scroller-wrapper" role="region" aria-label="Daily items timeline">
                <div className="time-scroller">
                  <div className="time-slots">
                    {Array.from({ length: 24 }).map((_, hour) => (
                      <div key={hour} className="time-slot" aria-label={`Hour ${dayjs().hour(hour).format("h A")}`}>
                        <span className="time-label">{dayjs().hour(hour).format("h A")}</span>
                      </div>
                    ))}
                  </div>
                  <div className="task-timeline">
                    {splitOverlappingItems(itemsForDay).map((item, index) => {
                      const { top, height, left, width } = item.style;
                      console.log(`Rendering item: ${item.taskTitle || item.id} at position {top: ${top}, height: ${height}, left: ${left}, width: ${width}}`);
                      return (
                        <div
                          key={`${item.id ? "appointment-" : "task-"}${item._id || item.id}`} // Unique key combining type and ID
                          className={`task-bubble ${item.id ? "appointment-bubble" : ""}`}
                          style={{
                            position: "absolute",
                            top,
                            height,
                            left,
                            width,
                            zIndex: 10,
                          }}
                          onMouseEnter={(e) => handleTooltip(item, e)}
                          onMouseLeave={closeTooltip}
                          onClick={() => handleItemBubbleClick(item)}
                          role="button"
                          tabIndex={0}
                          onKeyPress={(e) => e.key === "Enter" && handleItemBubbleClick(item)}
                          title={`${item.startTime || "09:00"} - ${item.endTime || "10:00"} - ${item.taskTitle || item.id} (Executor/Doctor: ${item.executor || item.doctorName})`}
                          aria-label={`${item.startTime || "09:00"} - ${item.endTime || "10:00"} - ${item.taskTitle || item.id}, Executor/Doctor: ${item.executor || item.doctorName}`}
                        >
                          {item.startTime || "09:00"} - {item.endTime || "10:00"} - {item.taskTitle || item.id}
                          <span className="item-type">{item.id ? " (Appointment)" : " (Task)"}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <button
                className="add-task-button"
                onClick={openAddTaskModal}
                aria-label="Add new task"
              >
                ＋
              </button>
            </div>
          )
        )}

        {tooltip.show && (
          <TaskTooltip item={tooltip.item} position={tooltip.position} onClose={closeTooltip} />
        )}

        {addModalOpen && (
          <AddTaskModal
            isOpen={addModalOpen}
            onClose={() => setAddModalOpen(false)}
            onTaskAdded={handleTaskAddedOrUpdated}
            selectedDate={selectedDate}
            refreshTasks={() => {
              if (selectedDate) fetchDayItems(selectedDate);
              else fetchMonthItems();
            }}
          />
        )}

        {editModalOpen && (
          <EditTaskModal
            isOpen={editModalOpen}
            onClose={() => setEditModalOpen(false)}
            onTaskUpdated={handleTaskAddedOrUpdated}
            onTaskDeleted={handleTaskDeleted}
            task={selectedItem}
            selectedDate={selectedDate}
            refreshTasks={() => {
              if (selectedDate) fetchDayItems(selectedDate);
              else fetchMonthItems();
            }}
          />
        )}

        {dayPickerOpen && (
          <div className="day-picker-overlay" onClick={() => setDayPickerOpen(false)}>
            <div className="day-picker-content" onClick={(e) => e.stopPropagation()}>
              <DayPicker
                mode="single"
                selected={currentMonth.toDate()}
                onSelect={(date) => handleDayPickerSelect(date)}
                captionLayout="dropdown"
                required
                showOutsideDays
                aria-label="Select a date to navigate"
                className="day-picker"
                modifiers={{
                  currentMonth: currentMonth.toDate(),
                }}
                modifiersStyles={{
                  currentMonth: {
                    backgroundColor: "#e6f9fa",
                    borderRadius: "8px",
                  },
                }}
              />
            </div>
          </div>
        )}

        <FilterModal
          isOpen={filterOpen}
          onClose={() => setFilterOpen(false)}
          onApply={handleFilterApply}
          executors={uniqueExecutors}
        />
      </div>
    </DashboardLayout>
  );
};

export default Tasks;