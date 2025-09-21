const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const morgan = require("morgan");
const mongoose = require("mongoose");
const { createServer } = require("http");
const { Server } = require("socket.io");
const SocketService = require("./services/socketService");
const NotificationService = require("./services/notificationService");
const { generalRateLimit } = require("./middleware/rateLimitMiddleware");
const {
  sanitizeInput,
  securityHeaders,
  securityLogger,
  secureErrorHandler,
} = require("./middleware/validationMiddleware");
require("dotenv").config();

const app = express();
const server = createServer(app);

// Socket.IO setup with Redis adapter configuration (commented for development)
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true,
  },
  transports: ["websocket", "polling"],
  pingTimeout: 60000,
  pingInterval: 25000,
});

// Redis adapter setup (commented for development)
// Uncomment when scaling to multiple instances
/*
const { createAdapter } = require("@socket.io/redis-adapter");
const { createClient } = require("redis");

const pubClient = createClient({ 
  url: process.env.REDIS_URL || "redis://localhost:6379" 
});
const subClient = pubClient.duplicate();

Promise.all([pubClient.connect(), subClient.connect()]).then(() => {
  io.adapter(createAdapter(pubClient, subClient));
  console.log("Redis adapter connected for Socket.IO scaling");
});
*/

// Initialize Socket.IO service and notification service
let socketService;
let notificationService;

const initializeServices = () => {
  socketService = new SocketService(io);
  notificationService = new NotificationService(socketService);

  // Set up bidirectional reference
  socketService.setNotificationService(notificationService);

  return { socketService, notificationService };
};

// Security middleware
app.use(helmet());
app.use(securityHeaders);
app.use(compression());

// CORS configuration
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
  })
);

// Body parsing middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Logging middleware
if (process.env.NODE_ENV !== "test") {
  app.use(morgan("combined"));
}

// Apply general rate limiting to all routes
app.use(generalRateLimit);

// Security logging and input sanitization
app.use(securityLogger);
app.use(sanitizeInput);

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "OK",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
  });
});

// Import routes
const authRoutes = require("./routes/auth");
const mediaRoutes = require("./routes/media");
const postsRoutes = require("./routes/posts");
const storiesRoutes = require("./routes/stories");
const topicsRoutes = require("./routes/topics");
const usersRoutes = require("./routes/users");
const chatRoutes = require("./routes/chat");
const notificationRoutes = require("./routes/notifications");
const adminRoutes = require("./routes/admin");

// API routes
app.use("/auth", authRoutes);
app.use("/media", mediaRoutes);
app.use("/posts", postsRoutes);
app.use("/stories", storiesRoutes);
app.use("/topics", topicsRoutes);
app.use("/users", usersRoutes);
app.use("/chat", chatRoutes);
app.use("/notifications", notificationRoutes);
app.use("/admin", adminRoutes);

app.get("/", (req, res) => {
  res.json({
    message: "College Social Media API",
    version: "1.0.0",
    status: "running",
  });
});

// Error handling middleware
app.use(secureErrorHandler);

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({
    error: {
      code: "NOT_FOUND",
      message: "Route not found",
    },
  });
});

// Database connection
const connectDB = async () => {
  try {
    const mongoUri =
      process.env.MONGODB_URI ||
      "mongodb://localhost:27017/college-social-media";
    await mongoose.connect(mongoUri);
    console.log("MongoDB connected successfully");
  } catch (error) {
    console.error("MongoDB connection error:", error);
    process.exit(1);
  }
};

// Initialize Socket.IO service after database connection
let socketServiceInstance;
let notificationServiceInstance;

// Start server
const PORT = process.env.PORT || 3000;

const startServer = async () => {
  await connectDB();

  // Initialize Socket.IO and notification services after database connection
  const services = initializeServices();
  socketServiceInstance = services.socketService;
  notificationServiceInstance = services.notificationService;
  console.log("Socket.IO and notification services initialized");

  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
    console.log("Socket.IO server ready for connections");
  });
};

// Handle graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM received, shutting down gracefully");
  server.close(() => {
    mongoose.connection.close();
    process.exit(0);
  });
});

if (require.main === module) {
  startServer();
}

module.exports = {
  app,
  server,
  io,
  getSocketService: () => socketServiceInstance,
  getNotificationService: () => notificationServiceInstance,
};
