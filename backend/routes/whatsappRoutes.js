const express = require("express");
const axios = require("axios");

const router = express.Router();

// Load environment variables
const WAPPI_BASE_URL = "https://wappi.pro";
const API_TOKEN = "8a9229e0c00f8ffee755cf964a67db117c6ff6ca";
const PROFILE_ID = "e762e884-e3f3";

// 🟢 Log API_TOKEN and PROFILE_ID at the top level to ensure they’re loaded
console.log("🔑 API_TOKEN:", API_TOKEN);
console.log("🆔 PROFILE_ID:", PROFILE_ID);

const { Server } = require("socket.io"); // For WebSocket

let io;
router.use((req, res, next) => {
  io = req.app.get("socketio"); // Get Socket.IO instance from app
  next();
});

// 🟢 Fetch All WhatsApp Chats (No Limits)
router.get("/chats", async (req, res) => {
  try {
    console.log("📩 Fetching all WhatsApp chats...");
    console.log("Request Headers:", { Authorization: API_TOKEN });
    console.log("Request Params:", { profile_id: PROFILE_ID, show_all: true });

    const response = await axios.get(`${WAPPI_BASE_URL}/api/sync/chats/get`, {
      headers: { Authorization: API_TOKEN },
      params: {
        profile_id: PROFILE_ID,
        show_all: true,
      },
    });

    res.json(response.data);
  } catch (error) {
    console.error("Error fetching chats:", error.message);
    res
      .status(error.response?.status || 500)
      .json(error.response?.data || { error: "Server error" });
  }
});

// 🟢 Fetch WhatsApp Chats with Optional Filter
router.get("/chats/filter", async (req, res) => {
  const { client_name } = req.query;

  try {
    console.log("📩 Fetching filtered chats with client_name:", client_name);
    console.log("Request Headers:", { Authorization: API_TOKEN });
    console.log("Request Params:", { profile_id: PROFILE_ID, client_name });

    const response = await axios.get(
      `${WAPPI_BASE_URL}/api/sync/chats/filter`,
      {
        headers: { Authorization: API_TOKEN },
        params: {
          profile_id: PROFILE_ID,
          client_name,
        },
      }
    );

    res.json(response.data);
  } catch (error) {
    console.error("Error filtering chats:", error.message);
    res
      .status(error.response?.status || 500)
      .json(error.response?.data || { error: "Server error" });
  }
});

// 🟢 Send WhatsApp Message
router.post("/send", async (req, res) => {
  const { to, message } = req.body;

  if (!to || !message) {
    return res.status(400).json({ error: "'to' and 'message' are required" });
  }

  try {
    console.log("📤 Sending message to:", to);
    console.log("Message content:", message);
    console.log("Request Headers:", { Authorization: API_TOKEN });
    console.log("Request Params:", { profile_id: PROFILE_ID });
    console.log("Request Payload:", { body: message, recipient: to });

    const response = await axios.post(
      `${WAPPI_BASE_URL}/api/async/message/send`,
      {
        body: message,
        recipient: to,
      },
      {
        headers: { Authorization: API_TOKEN },
        params: { profile_id: PROFILE_ID },
      }
    );

    res.json(response.data);
  } catch (error) {
    console.error("Error sending message:", error.message);
    res
      .status(error.response?.status || 500)
      .json(error.response?.data || { error: "Server error" });
  }
});

// 🟢 Fetch All Messages of a Chat
router.get("/chat/messages", async (req, res) => {
  const { chat_id } = req.query;

  if (!chat_id) {
    return res.status(400).json({ error: "chat_id is required" });
  }

  try {
    console.log("📩 Fetching messages for chat_id:", chat_id);
    console.log("Request Headers:", { Authorization: API_TOKEN });
    console.log("Request Params:", { profile_id: PROFILE_ID, chat_id });

    const response = await axios.get(
      `${WAPPI_BASE_URL}/api/sync/messages/get`,
      {
        headers: { Authorization: API_TOKEN },
        params: {
          profile_id: PROFILE_ID,
          chat_id,
        },
      }
    );

    const messages = response.data?.messages || [];
    const uniqueMessages = Array.from(
      new Map(messages.map((msg) => [msg.id, msg])).values()
    );

    res.json(uniqueMessages);
  } catch (error) {
    console.error("Error fetching messages:", error.message);
    res.status(error.response?.status || 500).json({
      error: "Server error while fetching messages.",
      details: error.response?.data || error.message,
    });
  }
});

// 🟢 Fetch Media Data by Media ID
router.get("/media", async (req, res) => {
  const { message_id } = req.query;

  if (!message_id) {
    return res.status(400).json({ error: "message_id is required" });
  }

  try {
    console.log("📩 Fetching media for message_id:", message_id);
    console.log("Request Headers:", { Authorization: API_TOKEN, Accept: "application/json" });
    console.log("Request Params:", { profile_id: PROFILE_ID, message_id });

    const metaResponse = await axios.get(
      `${WAPPI_BASE_URL}/api/sync/message/media/download`,
      {
        headers: { Authorization: API_TOKEN, Accept: "application/json" },
        params: {
          profile_id: PROFILE_ID,
          message_id,
        },
      }
    );

    if (metaResponse.status !== 200 || !metaResponse.data.file_link) {
      return res
        .status(404)
        .json({ error: "Media not found or no download link provided." });
    }

    const { file_link, file_name, mime_type } = metaResponse.data;

    res.json({
      status: "success",
      file_name,
      mime_type,
      file_link,
    });
  } catch (error) {
    console.error("Error fetching media data:", error.message);
    res.status(error.response?.status || 500).json({
      error: "Server error while fetching media data.",
      details: error.response?.data || error.message,
    });
  }
});

// 🟢 Send Document/Image/Video
router.post("/document/send", async (req, res) => {
  const { to, file_name, file_data, file_type } = req.body;

  console.log("🟡 Initial Payload Received:", req.body);

  // ✅ Validate Input
  if (!to || !file_name || !file_data || !file_type) {
    console.error("❌ Validation Failed: Missing required fields");
    return res.status(400).json({
      error: "'to', 'file_name', 'file_data', and 'file_type' are required",
    });
  }

  // ✅ Format the Recipient Phone Number
  const formattedRecipient = to.replace("@c.us", "");
  console.log("📨 Formatted 'to' Field:", formattedRecipient);

  // ✅ Prepare Payload
  let apiUrl;
  const payload = {
    recipient: formattedRecipient,
    file_name: file_name,
    b64_file: file_data,
  };

  console.log(
    "📄 Base64 File Size (KB):",
    (Buffer.byteLength(payload.b64_file, "base64") / 1024).toFixed(2)
  );

  // ✅ Determine the Correct API Endpoint
  switch (file_type) {
    case "document":
      apiUrl = `${WAPPI_BASE_URL}/api/sync/message/document/send`;
      break;
    case "image":
      apiUrl = `${WAPPI_BASE_URL}/api/sync/message/img/send`;
      break;
    case "video":
      apiUrl = `${WAPPI_BASE_URL}/api/sync/message/video/send`;
      break;
    default:
      console.error("❌ Unsupported File Type:", file_type);
      return res.status(400).json({ error: "Unsupported file type" });
  }

  console.log(`📦 Sending ${file_type.toUpperCase()} to Wappi API:`, payload);
  console.log("Request Headers:", { Authorization: API_TOKEN });
  console.log("Request Params:", { profile_id: PROFILE_ID });

  try {
    // ✅ Send POST Request to Wappi API
    const response = await axios.post(apiUrl, payload, {
      headers: { Authorization: API_TOKEN },
      params: { profile_id: PROFILE_ID },
    });

    console.log("✅ File Sent Successfully:", response.data);
    return res.json(response.data);
  } catch (error) {
    console.error("❌ Error Sending File:", error.message);
    if (error.response) {
      console.warn("⚠️ Response Data:", error.response.data);
      return res.status(error.response.status).json(error.response.data);
    } else if (error.request) {
      console.warn("⚠️ No Response Received:", error.request);
      return res
        .status(502)
        .json({ error: "Bad Gateway: No response from Wappi API" });
    } else {
      console.warn("⚠️ Request Setup Error:", error.message);
      return res
        .status(500)
        .json({ error: "Server error: Request setup failed" });
    }
  }
});

module.exports = router;