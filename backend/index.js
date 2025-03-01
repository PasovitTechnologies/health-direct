const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const helmet = require("helmet");
const cors = require("cors");
const jwt = require("jsonwebtoken");

const authRoutes = require("./routes/auth-routes");
const doctorRoutes = require("./routes/doctor-routes");
const taskRoutes = require("./routes/task-routes");
const patientRoutes = require("./routes/patient-routes");
const applicationRoutes = require("./routes/application-routes");
const paymentRoutes = require("./routes/payment-routes");
const commentRoutes = require("./routes/application-routes");
const appointmentRoutes = require("./routes/appointment-routes");
const initializeSocket = require("./socket/socket");
const whatsappRoutes = require("./routes/whatsappRoutes");

dotenv.config();
const app = express();
const server = require("http").createServer(app);
const io = initializeSocket(server);

// Middleware
app.use(express.json());
app.use(helmet());
app.use(cors({
  origin: "http://localhost:3000",
  credentials: true,
}));

// Make Socket.IO instance available to routes
app.set("socketio", io);

// Routes
app.use("/api/admin", authRoutes);
app.use("/api/doctors", doctorRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/patients", patientRoutes);
app.use("/api/applications", applicationRoutes);
app.use("/api/payments", paymentRoutes); // Payment routes already included

// **Move appointmentRoutes above the generic "/api" route**
app.use("/api/appointments", appointmentRoutes);

// This generic "/api" route (commentRoutes) should come after specific ones
app.use("/api", commentRoutes);

app.use("/api/whatsapp", whatsappRoutes);

// Connect to MongoDB Atlas
mongoose
  .connect(process.env.MONGO_URI, { 
    useNewUrlParser: true, 
    useUnifiedTopology: true 
  })
  .then(() => {
    console.log("Connected to MongoDB Atlas");
    server.listen(process.env.PORT || 5001, () => {
      console.log(`Server running on port ${process.env.PORT || 5001} with Socket.IO`);
    });
  })
  .catch((err) => console.error("MongoDB connection failed:", err));