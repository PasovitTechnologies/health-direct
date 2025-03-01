// src/config.js
const BASE_URL =
  process.env.NODE_ENV === "production"
    ? "https://your-production-api.com" // Replace with your production URL
    : "http://localhost:5001"; // Default for development

export default BASE_URL;