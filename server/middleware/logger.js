/**
 * Request Logger Middleware
 * Logs all API requests with timing, status code, and method.
 * Useful for debugging, monitoring, and audit trails.
 */

const LOG_COLORS = {
  GET: "\x1b[32m",     // Green
  POST: "\x1b[33m",    // Yellow
  PATCH: "\x1b[36m",   // Cyan
  DELETE: "\x1b[31m",  // Red
  RESET: "\x1b[0m"
};

function requestLogger(req, res, next) {
  // Skip static file requests
  if (!req.path.startsWith("/api/")) return next();

  const start = Date.now();
  const method = req.method;
  const color = LOG_COLORS[method] || LOG_COLORS.RESET;

  // Capture response finish
  res.on("finish", () => {
    const duration = Date.now() - start;
    const status = res.statusCode;
    const statusColor = status >= 400 ? "\x1b[31m" : "\x1b[32m";

    console.log(
      `${color}${method}${LOG_COLORS.RESET} ${req.path} ` +
      `${statusColor}${status}${LOG_COLORS.RESET} ` +
      `${duration}ms` +
      (duration > 1000 ? " ⚠️ SLOW" : "")
    );
  });

  next();
}

module.exports = { requestLogger };
