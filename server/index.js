require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });

const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const path = require("path");
const { sanitizeBody } = require("./middleware/validate");
const { requestLogger } = require("./middleware/logger");
const { errorHandler } = require("./middleware/errorHandler");

const app = express();
const PORT = process.env.PORT || 3000;

// ══════════════════════════════════════════
// SECURITY MIDDLEWARE
// ══════════════════════════════════════════

// HTTP security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https://images.unsplash.com", "https://*.supabase.co"],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'", process.env.SUPABASE_URL || "https://*.supabase.co"]
    }
  },
  crossOriginEmbedderPolicy: false
}));

// CORS configuration
app.use(cors({
  origin: process.env.CORS_ORIGIN || "http://localhost:3000",
  methods: ["GET", "POST", "PATCH", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true
}));

// Global rate limiter: 200 requests per 15 minutes per IP
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "RATE_LIMIT",
    message: "Anda telah melebihi batas permintaan. Coba lagi dalam 15 menit."
  }
});

// Strict rate limiter for auth routes: 15 attempts per 15 minutes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "AUTH_RATE_LIMIT",
    message: "Akun dikunci sementara. Coba lagi dalam 15 menit."
  }
});

app.use(globalLimiter);

// ══════════════════════════════════════════
// BODY PARSING, SANITIZATION & LOGGING
// ══════════════════════════════════════════

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(sanitizeBody);
app.use(requestLogger);

// ══════════════════════════════════════════
// STATIC FILES (Frontend)
// ══════════════════════════════════════════

const publicDir = path.join(__dirname, "..");
app.use(express.static(publicDir, {
  maxAge: process.env.NODE_ENV === "production" ? "1d" : 0,
  etag: true,
  index: "index.html"
}));

// Serve uploads directory
app.use("/uploads", express.static(path.join(publicDir, "uploads")));

// ══════════════════════════════════════════
// API ROUTES
// ══════════════════════════════════════════

app.use("/api/auth", authLimiter, require("./routes/auth"));
app.use("/api/hotels", require("./routes/hotels"));
app.use("/api/bookings", require("./routes/bookings"));
app.use("/api/cms", require("./routes/cms"));

// Health check endpoint
app.get("/api/health", (req, res) => {
  const memUsage = process.memoryUsage();
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: Math.round(process.uptime()),
    memory: {
      rss: `${Math.round(memUsage.rss / 1024 / 1024)}MB`,
      heap: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`
    },
    env: process.env.NODE_ENV || "development"
  });
});

// ══════════════════════════════════════════
// SPA FALLBACK — serve index.html for non-API routes
// ══════════════════════════════════════════

app.get("*", (req, res) => {
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({ error: "NOT_FOUND", message: "Endpoint tidak ditemukan." });
  }
  res.sendFile(path.join(publicDir, "index.html"));
});

// ══════════════════════════════════════════
// CENTRALIZED ERROR HANDLER (must be last)
// ══════════════════════════════════════════

app.use(errorHandler);

// ══════════════════════════════════════════
// GRACEFUL SHUTDOWN
// ══════════════════════════════════════════

let server;

function gracefulShutdown(signal) {
  console.log(`\n⚠️  ${signal} received. Shutting down gracefully...`);
  if (server) {
    server.close(() => {
      console.log("✅ Server closed.");
      process.exit(0);
    });
    // Force close after 10 seconds
    setTimeout(() => {
      console.error("❌ Could not close in time, forcefully shutting down.");
      process.exit(1);
    }, 10000);
  } else {
    process.exit(0);
  }
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

// Handle uncaught exceptions and rejections
process.on("uncaughtException", (err) => {
  console.error("❌ Uncaught Exception:", err.message);
  console.error(err.stack);
  gracefulShutdown("uncaughtException");
});

process.on("unhandledRejection", (reason) => {
  console.error("❌ Unhandled Rejection:", reason);
});

// ══════════════════════════════════════════
// START SERVER
// ══════════════════════════════════════════

server = app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════╗
║        🏨 PANDU HOTEL SERVER             ║
╠══════════════════════════════════════════╣
║  Status  : Running                       ║
║  Port    : ${String(PORT).padEnd(29)}║
║  Mode    : ${String(process.env.NODE_ENV || "development").padEnd(29)}║
║  URL     : http://localhost:${String(PORT).padEnd(13)}║
║  PID     : ${String(process.pid).padEnd(29)}║
╚══════════════════════════════════════════╝
  `);
});

module.exports = app;
