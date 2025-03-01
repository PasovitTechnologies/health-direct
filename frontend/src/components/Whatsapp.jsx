import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import "../styles/Whatsapp.css";
import {
  FiSend,
  FiSearch,
  FiPaperclip,
  FiArrowDownCircle,
  FiFileText,
  FiImage,
  FiVideo,
} from "react-icons/fi";
import MessagesContainer from "./MessagesContainer";
import { motion, AnimatePresence } from "framer-motion";
import DashboardLayout from "./DashboardLayout"; // Import DashboardLayout

const WhatsAppContent = () => {
  const [chats, setChats] = useState([]);
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState("");
  const [selectedChat, setSelectedChat] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [base64File, setBase64File] = useState("");
  const [fileType, setFileType] = useState(null);

  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);

  // Fetch Chats (With Search)
  const fetchChats = async (filter = "") => {
    try {
      const response = await axios.get(
        "${BASE_URL}/api/whatsapp/chats/filter",
        { params: { client_name: filter } }
      );
      setChats(response.data.dialogs || []);
    } catch (error) {
      console.error("Error fetching chats:", error.message);
    }
  };

  // Fetch All Messages for Selected Chat
  const fetchMessages = async (chatId) => {
    setLoading(true);
    try {
      const response = await axios.get(
        "${BASE_URL}/api/whatsapp/chat/messages",
        { params: { chat_id: chatId } }
      );
      setMessages(response.data.reverse() || []);
      setTimeout(scrollToBottom, 100);
    } catch (error) {
      console.error("Error fetching messages:", error.message);
      alert("Failed to load messages!");
    } finally {
      setLoading(false);
    }
  };

  // Send Message
  const sendMessage = async () => {
    if (!selectedChat || !message.trim()) {
      alert("Select a chat and enter a message!");
      return;
    }
    try {
      await axios.post("${BASE_URL}/api/whatsapp/send", {
        to: selectedChat.id,
        message,
      });
      setMessages((prev) => [
        ...prev,
        { body: message, fromMe: true, type: "chat" },
      ]);
      setMessage("");
      scrollToBottom();
      fetchMessages(selectedChat.id);
    } catch (error) {
      console.error("Error sending message:", error.message);
      alert("Failed to send message!");
    }
  };

  // Handle Chat Selection
  const handleChatSelect = (chat) => {
    if (selectedChat?.id === chat.id) return;
    setSelectedChat(chat);
    setMessages([]);
    fetchMessages(chat.id);
  };

  // Search Filter
  const handleSearch = (e) => {
    const searchValue = e.target.value;
    setSearchTerm(searchValue);
    fetchChats(searchValue);
  };

  // Scroll to Bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Load Older Messages on Scroll Up
  const handleScroll = () => {
    if (!messagesContainerRef.current || loading) return;
    const { scrollTop } = messagesContainerRef.current;
    if (scrollTop < 50) {
      console.log("Load older messages...");
    }
  };

  // Initial Load
  useEffect(() => {
    fetchChats();
  }, []);

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (container) {
      container.addEventListener("scroll", handleScroll);
      return () => container.removeEventListener("scroll", handleScroll);
    }
  }, [messages]);

  const handleFileUpload = (e, type) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      setFileType(type);
      const reader = new FileReader();
      reader.onload = () => {
        const base64String = reader.result.split(",")[1]?.trim() || "";
        setBase64File(base64String);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSendFile = async () => {
    if (!base64File || !selectedFile || !selectedChat) return;
    try {
      const payload = {
        to: selectedChat.id,
        file_name: selectedFile.name,
        file_data: base64File,
        file_type: fileType,
      };
      await axios.post("${BASE_URL}/api/whatsapp/document/send", payload, {
        headers: { "Content-Type": "application/json", Accept: "application/json" },
      });
      setSelectedFile(null);
      setBase64File("");
      setFileType(null);
      setShowUpload(false);
      fetchMessages(selectedChat.id);
    } catch (error) {
      console.error("Error sending file:", error.response?.data || error.message);
      alert("Failed to send file!");
    }
  };

  return (
    <div className="whatsapp-container">
      {/* Chat List */}
      <div className="chat-list-column">
        <h2>WhatsApp</h2>
        <div className="search-bar-container">
          <div className="search-bar-chat">
            <FiSearch className="search-icon-whatsapp" />
            <input
              type="text"
              placeholder="Search chats..."
              value={searchTerm}
              onChange={handleSearch}
            />
          </div>
        </div>
        <div className="chats-list">
          {chats.map((chat) => (
            <div
              key={chat.id}
              className={`chat-item ${selectedChat?.id === chat.id ? "active" : ""}`}
              onClick={() => handleChatSelect(chat)}
            >
              <div className="chat-item-content">
                <img
                  src={
                    chat.thumbnail ||
                    "https://static.wixstatic.com/media/df6cc5_dc3fb9dd45a9412fb831f0b222387da1~mv2.jpg"
                  }
                  alt={chat.name}
                  className="chat-thumbnail"
                />
                <div className="chat-text">
                  <strong className="chat-name">{chat.name}</strong>
                  <p className="chat-message">{chat.last_message_data || "No messages..."}</p>
                </div>
                {chat.unread_count > 0 && (
                  <span className="unread-count">
                    {chat.unread_count > 99 ? "99+" : chat.unread_count}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Chat Window */}
      <div className="chat-window-column">
        {selectedChat ? (
          <div className="chat-window">
            <div className="chat-header">
              <img
                src={
                  selectedChat.thumbnail ||
                  "https://static.wixstatic.com/media/df6cc5_dc3fb9dd45a9412fb831f0b222387da1~mv2.jpg"
                }
                alt="Profile"
                className="profile-photo"
              />
              <div className="chat-header-info">
                <h3>{selectedChat.name || selectedChat.phone_number}</h3>
              </div>
            </div>
            <MessagesContainer messages={messages} loading={loading} />
            <div className="message-input-container">
              <div className="pin-icon-wrapper">
                <button className="pin-button" onClick={() => setShowUpload((prev) => !prev)}>
                  <FiPaperclip size={20} />
                </button>
                <AnimatePresence>
                  {showUpload && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="upload-tooltip"
                    >
                      <div className="upload-options">
                        <label className="upload-option">
                          <FiFileText size={20} />
                          <span>Document</span>
                          <input
                            type="file"
                            accept=".pdf,.doc,.docx,.txt"
                            className="hidden-file-input"
                            onChange={(e) => handleFileUpload(e, "document")}
                          />
                        </label>
                        <label className="upload-option">
                          <FiImage size={20} />
                          <span>Image</span>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden-file-input"
                            onChange={(e) => handleFileUpload(e, "image")}
                          />
                        </label>
                        <label className="upload-option">
                          <FiVideo size={20} />
                          <span>Video</span>
                          <input
                            type="file"
                            accept="video/*"
                            className="hidden-file-input"
                            onChange={(e) => handleFileUpload(e, "video")}
                          />
                        </label>
                      </div>
                      <div className="upload-field">
                        <input
                          type="text"
                          value={selectedFile ? selectedFile.name : ""}
                          placeholder="No file selected"
                          readOnly
                          className="file-name-input"
                        />
                        <button
                          className="upload-send-button"
                          onClick={handleSendFile}
                          disabled={!selectedFile}
                        >
                          Send
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Type a message..."
                className="message-input"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
              />
              <button onClick={sendMessage} className="send-button">
                <FiSend size={20} />
              </button>
            </div>
          </div>
        ) : (
          <div className="no-chat-selected">Select a chat to start messaging</div>
        )}
      </div>
    </div>
  );
};

// Wrap WhatsAppContent with DashboardLayout
const WhatsApp = () => {
  return (
    <DashboardLayout initialActiveTab="WhatsApp">
      <WhatsAppContent />
    </DashboardLayout>
  );
};

export default WhatsApp;