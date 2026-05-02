/**
 * Centralized Error Handler
 * Catches all unhandled errors and returns consistent JSON responses.
 * Prevents leaking internal details in production.
 */

class AppError extends Error {
  constructor(message, statusCode = 500, code = "SERVER_ERROR") {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
  }
}

function errorHandler(err, req, res, next) {
  // Default values
  let statusCode = err.statusCode || 500;
  let code = err.code || "SERVER_ERROR";
  let message = err.message || "Terjadi kesalahan internal.";

  // Multer file size error
  if (err.code === "LIMIT_FILE_SIZE") {
    statusCode = 413;
    code = "FILE_TOO_LARGE";
    message = "Ukuran file maksimal 5MB.";
  }

  // Multer file type error
  if (err.message && err.message.includes("diizinkan")) {
    statusCode = 400;
    code = "INVALID_FILE_TYPE";
    message = err.message;
  }

  // Supabase specific errors
  if (err.message && err.message.includes("duplicate key")) {
    statusCode = 409;
    code = "DUPLICATE_ENTRY";
    message = "Data sudah ada. Gunakan data yang berbeda.";
  }

  if (err.message && err.message.includes("violates foreign key")) {
    statusCode = 400;
    code = "INVALID_REFERENCE";
    message = "Data referensi tidak valid.";
  }

  // JSON parse errors
  if (err.type === "entity.parse.failed") {
    statusCode = 400;
    code = "INVALID_JSON";
    message = "Format data JSON tidak valid.";
  }

  // Log server errors (not client errors)
  if (statusCode >= 500) {
    console.error(`[ERROR] ${req.method} ${req.path}:`, err.stack || err.message);
  }

  res.status(statusCode).json({
    error: code,
    message: process.env.NODE_ENV === "production" && statusCode >= 500
      ? "Terjadi kesalahan internal. Coba lagi nanti."
      : message,
    ...(process.env.NODE_ENV !== "production" && { stack: err.stack })
  });
}

module.exports = { AppError, errorHandler };
