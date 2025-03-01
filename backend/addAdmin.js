const bcrypt = require("bcrypt");
const mongoose = require("mongoose");
const Admin = require("./models/admin");
require("dotenv").config(); // Load environment variables

const addAdmin = async () => {
  try {
    // Use the MONGO_URI from the .env file
    await mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    const hashedPassword = await bcrypt.hash("123", 10); // Replace with your admin password
    const admin = new Admin({ email: "admin@example.com", password: hashedPassword });
    await admin.save();
    console.log("Admin user added successfully!");
  } catch (error) {
    console.error("Error adding admin user:", error);
  } finally {
    mongoose.connection.close();
  }
};

addAdmin();
