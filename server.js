require("dotenv").config();
const express = require("express");
const http = require("http"); // Required for Socket.io
const { Server } = require("socket.io");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");

// Import Auth Routes
const authRoutes = require("./routes/authRoutes");
const userRoutes = require("./routes/userRoutes");
const bloodRoutes = require("./routes/bloodRoutes");
const feedRoutes = require("./routes/feedRoutes");
const chatRoutes = require("./routes/chatRoutes");
const adminRoutes = require("./routes/adminRoutes");

const notificationRoutes = require('./routes/notificationRoutes');
const uploadRoutes = require('./routes/uploadRoutes'); // <--- Import
const sendNotification = require('./services/notificationService');
// Import Database (just to ensure connection starts)
const db = require("./config/db");
const path = require("path");

// Initialize App
const app = express();
const server = http.createServer(app);

// Middleware
app.use(cors()); // Allow requests from React/React Native
app.use(helmet()); // Security headers
app.use(morgan("dev")); // Log requests to console
app.use(express.json()); // Parse JSON data from frontend


// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// -- ROUTES (We will add these in the next step) --
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/blood-requests", bloodRoutes);
app.use("/api/feed", feedRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/notifications", notificationRoutes);

// NEW: Register Upload Route
app.use('/api/upload', uploadRoutes); // <--- Add this

// -- REAL-TIME CHAT SETUP (Socket.io) --
const io = new Server(server, {
  cors: {
    origin: "*", // Allow all connections for now
    methods: ["GET", "POST"],
  },
});

io.on("connection", (socket) => {
  console.log(`⚡ User Connected: ${socket.id}`);

  // Join Room (Group Chat or Private Chat)
  socket.on("join_room", (room) => {
    socket.join(room);
    console.log(`User ${socket.id} joined room: ${room}`);
  });

  // UPDATED: Save message to DB then broadcast
  socket.on("send_message", async (data) => {
    // data = { conversation_id, sender_id, content, type }
    const { conversation_id, sender_id, content, type } = data;

    try {
      // 1. Save to MySQL
      await db.execute(
        "INSERT INTO messages (conversation_id, sender_id, content, message_type) VALUES (?, ?, ?, ?)",
        [conversation_id, sender_id, content, type || "text"]
      );

      // 2. Broadcast to room
      io.to(conversation_id).emit("receive_message", data);

       // 3. Send Push Notification to other user here
       const [recipients] = await db.execute(
           'SELECT user_id FROM conversation_participants WHERE conversation_id = ? AND user_id != ?',
           [conversation_id, sender_id]
       );

       recipients.forEach(async (participant) => {
           await sendNotification(
               participant.user_id,
               `Message from ${data.sender_name || 'Someone'}`, // Assuming sender_name is in data
               content.substring(0, 30), // Preview text
               "message",
               conversation_id,
               "/chat"
           );
       });
    } catch (err) {
      console.error("Message save failed:", err);
    }
  });

  // 1. Listen for Typing Start
  socket.on("typing", (room) => {
    // Broadcast to everyone in the room EXCEPT the sender
    socket.to(room).emit("display_typing");
  });

  // 2. Listen for Typing Stop
  socket.on("stop_typing", (room) => {
    socket.to(room).emit("hide_typing");
  });

  socket.on("disconnect", () => {
    console.log("User Disconnected", socket.id);
  });
});

// -- START SERVER --
const PORT = process.env.PORT || 3048;
server.listen(PORT, () => {
  console.log(`http://localhost:${PORT}`);
  console.log(`🚀 Server running on port ${PORT}`);
});
