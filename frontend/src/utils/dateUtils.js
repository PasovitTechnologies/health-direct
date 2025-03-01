// src/utils/dateUtils.js

/**
 * Formats an ISO date string from MongoDB to the format required for datetime-local input (YYYY-MM-DDTHH:MM),
 * adding back 5 hours and 30 minutes (IST offset, UTC+5:30) to match the original time.
 * @param {string|Date} isoDate - ISO date string or Date object from MongoDB (e.g., "2025-02-27T22:00:00.000Z")
 * @returns {string} Formatted date string for datetime-local input (e.g., "2025-02-27T22:00")
 */
export const formatForDatetimeLocal = (isoDate) => {
    if (!isoDate) return "";
    const date = new Date(isoDate);
    // Ensure the date is valid
    if (isNaN(date.getTime())) {
      console.error("Invalid date provided:", isoDate);
      return "";
    }
    // Add 5 hours and 30 minutes (5.5 hours in milliseconds: 5.5 * 60 * 60 * 1000 = 19800000)
    const offsetMs = 5.5 * 60 * 60 * 1000; // 5 hours 30 minutes in milliseconds
    const adjustedDate = new Date(date.getTime() + offsetMs);
    // Format to YYYY-MM-DDTHH:MM (removing seconds and timezone)
    return adjustedDate.toISOString().slice(0, 16);
  };
  
  /**
   * Converts a datetime-local input value (YYYY-MM-DDTHH:MM) to an ISO string for MongoDB,
   * subtracting 5 hours and 30 minutes (IST offset, UTC+5:30) to store in UTC.
   * @param {string} datetimeLocal - DateTime string from datetime-local input (e.g., "2025-02-27T22:00")
   * @returns {string} ISO string for MongoDB (e.g., "2025-02-27T16:30:00.000Z")
   */
  export const formatForMongoDB = (datetimeLocal) => {
    if (!datetimeLocal) return new Date().toISOString();
    const date = new Date(datetimeLocal);
    // Ensure the date is valid
    if (isNaN(date.getTime())) {
      console.error("Invalid datetime-local value provided:", datetimeLocal);
      return new Date().toISOString();
    }
    // Subtract 5 hours and 30 minutes (5.5 hours in milliseconds: 5.5 * 60 * 60 * 1000 = 19800000)
    const offsetMs = 5.5 * 60 * 60 * 1000; // 5 hours 30 minutes in milliseconds
    const adjustedDate = new Date(date.getTime() - offsetMs);
    return adjustedDate.toISOString();
  };
  
  /**
   * Validates if a date string is in a valid format.
   * @param {string} dateStr - Date string to validate
   * @returns {boolean} True if valid, false otherwise
   */
  export const isValidDate = (dateStr) => {
    if (!dateStr) return false;
    const date = new Date(dateStr);
    return !isNaN(date.getTime());
  };