import React, { useRef, useEffect, useState, useCallback } from "react";
import axios from "axios";
import {
    FiArrowDownCircle,
    
  } from "react-icons/fi";
const MessagesContainer = ({ messages, loading }) => {
  const messagesContainerRef = useRef(null);
  const messagesEndRef = useRef(null);
  const [mediaUrls, setMediaUrls] = useState({});
  const [loadingMedia, setLoadingMedia] = useState({});
  const [showScrollButton, setShowScrollButton] = useState(false);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);


  useEffect(() => {
    return () => {
      Object.values(mediaUrls).forEach((url) => URL.revokeObjectURL(url));
    };
  }, [mediaUrls]);


  useEffect(() => {
    messages.forEach((msg) => {
      if (typeof msg.body === "object" && msg.body.mimetype && msg.body.URL) {
        handleMediaLoad(msg);
      }
    });
  }, [messages]);
  

  const fetchMedia = async (messageId) => {
    try {
      const response = await axios.get(
        `${BASE_URL}/api/whatsapp/media`,
        {
          params: {
            profile_id: "981ee345-1804",
            message_id: messageId,
          },
          headers: {
            Authorization: "cba20e8f2244852b32605b288b0ec7d59b16c972",
            accept: "application/json",
          },
        }
      );

      if (
        response.status === 200 &&
        response.data?.status === "success" &&
        response.data?.file_link
      ) {
        const mediaUrl = response.data.file_link;
        return mediaUrl;
      }
    } catch (error) {
      console.error("❌ Error fetching media:", error.message);
    }
    return null;
  };

  const handleMediaLoad = useCallback(async (msg) => {
    if (!mediaUrls[msg.id] && !loadingMedia[msg.id]) {
      setLoadingMedia((prev) => ({ ...prev, [msg.id]: true }));
      const mediaUrl = await fetchMedia(msg.id);
      if (mediaUrl) {
        setMediaUrls((prev) => ({ ...prev, [msg.id]: mediaUrl }));
      }
      setLoadingMedia((prev) => ({ ...prev, [msg.id]: false }));
    }
  }, [mediaUrls, loadingMedia]);
  

  const getDeliveryStatusIcon = (status) => {
    switch (status) {
      case "sent":
        return "📤";
      case "delivered":
        return "✅";
      case "read":
        return "👁️";
      default:
        return "⏳";
    }
  };

  const handleScroll = useCallback(() => {
    if (messagesContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } =
        messagesContainerRef.current;

      // 📏 Update scroll button visibility with a larger threshold
      const isNearBottom = scrollHeight - scrollTop <= clientHeight + 300;

      setShowScrollButton(!isNearBottom);
    }
  }, []);

  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
      setShowScrollButton(false); // ⬇️ Hide the button when scrolled to bottom
    }
  };

  const getDateLabel = (timestamp) => {
    const messageDate = new Date(timestamp * 1000);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    if (messageDate.toDateString() === today.toDateString()) {
      return "Today";
    } else if (messageDate.toDateString() === yesterday.toDateString()) {
      return "Yesterday";
    } else {
      return messageDate.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    }
  };

  const groupedMessages = messages.reduce((acc, msg) => {
    const dateLabel = getDateLabel(msg.time);
    if (!acc[dateLabel]) {
      acc[dateLabel] = [];
    }
    acc[dateLabel].push(msg);
    return acc;
  }, {});

  return (
    <div
      className="messages-container"
      ref={messagesContainerRef}
      onScroll={handleScroll}
    >
      {loading && <div className="loading">Loading...</div>}

      {Object.entries(groupedMessages).map(([dateLabel, msgs]) => (
        <div key={dateLabel} className="date-group">
          <div className="date-label">{dateLabel}</div>
          {msgs.map((msg, index) => (
  <div
    key={index}
    className={`message-bubble ${msg.fromMe ? "sent" : "received"}`}
  >
   {typeof msg.body === "object" ? (
  <>
    {/* ⏳ Show Loading Indicator While Media Loads */}
    {!mediaUrls[msg.id] && loadingMedia[msg.id] && (
      <span className="loading-indicator">⏳ Loading...</span>
    )}

    {/* ✅ Media Content When URL is Available */}
    {mediaUrls[msg.id] && (
      <>
        {/* 🖼️ Render Images (Including SVG) */}
        {msg.body.mimetype?.startsWith("image/") && (
          <img
            src={mediaUrls[msg.id]}
            alt={msg.body.file_name || "Image"}
            className="media-image"
            loading="lazy"
            onError={(e) => {
              e.target.onerror = null;
              e.target.src = "/placeholder.png"; // Fallback image
            }}
          />
        )}

        {/* 🎵 Render Audio Files (e.g., Voice Messages) */}
        {msg.body.mimetype?.startsWith("audio/") && (
          <audio controls className="media-audio" style={{ width: "200px" }}>
            <source src={mediaUrls[msg.id]} type={msg.body.mimetype} />
            Your browser does not support the audio element.
          </audio>
        )}

        {/* 🎬 Render Video Files */}
        {msg.body.mimetype?.startsWith("video/") && (
          <video
            controls
            className="media-video"
            style={{ maxWidth: "100%", height: "auto" }}
          >
            <source src={mediaUrls[msg.id]} type={msg.body.mimetype} />
            Your browser does not support the video tag.
          </video>
        )}

        {/* 📎 Download Link for PDFs, DOCX, and Other Documents */}
        {["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/msword"].includes(msg.body.mimetype) && (
          <a
            href={mediaUrls[msg.id]}
            download={msg.body.file_name || "Download File"}
            className="media-file"
            target="_blank"
            rel="noopener noreferrer"
          >
            📎 {msg.body.file_name || "Download File"}
          </a>
        )}

        {/* 📎 Fallback Download for Other File Types */}
        {msg.body.mimetype &&
          !["image/", "video/", "audio/", "application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/msword"].some((type) =>
            msg.body.mimetype.startsWith(type)
          ) && (
            <a
              href={mediaUrls[msg.id]}
              download={msg.body.file_name || "Download File"}
              className="media-file"
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => {
                if (!mediaUrls[msg.id]) {
                  e.preventDefault();
                  alert("File not available for download!");
                }
              }}
            >
              📎 {msg.body.file_name || "Download File"}
            </a>
          )}

        {/* ❌ Unsupported File Format Message */}
        {!["image/", "video/", "audio/", "application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/msword"].some((type) =>
          msg.body.mimetype?.startsWith(type)
        ) && !mediaUrls[msg.id] && (
          <div className="unsupported-format">
            ❌ Unsupported file format: {msg.body.mimetype || "Unknown Type"}
          </div>
        )}
      </>
    )}
  </>
) : (
  <p>
    {/* 🌐 Render Links and Plain Text */}
    {msg.body.split(/(https?:\/\/[^\s]+)/g).map((part, i) =>
      /^https?:\/\//.test(part) ? (
        <a
          key={i}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="chat-link"
        >
          {part}
        </a>
      ) : (
        <span key={i}>{part}</span>
      )
    )}
  </p>
)}




    
    <div className="message-meta">
      <span className="chat-timestamp">
        {new Date(msg.time * 1000).toLocaleTimeString("en-IN", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true,
        })}
      </span>
      <span className="delivery-status">
        {getDeliveryStatusIcon(msg.delivery_status)}
      </span>
    </div>
  </div>
))}

        </div>
      ))}

      <div ref={messagesEndRef} />
      {showScrollButton && (
        <button >
         <FiArrowDownCircle size={35} onClick={scrollToBottom} className="scroll-to-bottom-button" />
        </button>
      )}
    </div>
  );
};

export default MessagesContainer;
