const { Server } = require("socket.io");

function initializeSocket(server) {
  const io = new Server(server, {
    cors: {
      origin: "http://localhost:3000", // Update with your frontend URL
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", (socket) => {
    console.log("New client connected:", socket.id);

    // Emit existing applications and tasks on connection
    socket.emit("initialApplications", []);
    socket.emit("initialTasks", []);

    // Handle new application creation
    socket.on("newApplication", (application) => {
      io.emit("newApplication", application);
    });

    // Handle application updates (e.g., edits)
    socket.on("updateApplication", (application) => {
      io.emit("updateApplication", application);
    });

    // Handle task updates (e.g., new, updated, or deleted tasks)
    socket.on("newTask", (task) => {
      io.emit("newTask", task);
    });

    socket.on("updateTask", (task) => {
      io.emit("updateTask", task);
    });

    socket.on("deleteTask", (taskId) => {
      io.emit("deleteTask", taskId);
    });

    socket.on("disconnect", () => {
      console.log("Client disconnected:", socket.id);
    });
  });

  return io;
}

module.exports = initializeSocket;