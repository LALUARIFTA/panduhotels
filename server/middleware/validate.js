/**
 * Input Validation & Sanitization Middleware
 * Protects against XSS by stripping HTML tags from string inputs.
 */

function sanitizeString(value) {
  if (typeof value !== "string") return value;
  return value
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .trim();
}

function sanitizeObject(obj) {
  if (typeof obj !== "object" || obj === null) return obj;
  const cleaned = {};
  for (const [key, value] of Object.entries(obj)) {
    if (Array.isArray(value)) {
      cleaned[key] = value.map(v =>
        typeof v === "object" && v !== null ? sanitizeObject(v) : sanitizeString(v)
      );
    } else if (typeof value === "object" && value !== null) {
      cleaned[key] = sanitizeObject(value);
    } else {
      cleaned[key] = sanitizeString(value);
    }
  }
  return cleaned;
}

/**
 * Express middleware that sanitizes req.body
 */
function sanitizeBody(req, res, next) {
  if (req.body && typeof req.body === "object" && !(req.body instanceof Buffer)) {
    // Skip sanitization for multipart/form-data (handled by multer)
    const contentType = req.headers["content-type"] || "";
    if (!contentType.includes("multipart/form-data")) {
      req.body = sanitizeObject(req.body);
    }
  }
  next();
}

/**
 * Validate email format
 */
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Validate phone format (Indonesian)
 */
function isValidPhone(phone) {
  return /^(\+62|62|0)8[1-9][0-9]{6,10}$/.test(phone.replace(/[\s-]/g, ""));
}

/**
 * Validate date string (YYYY-MM-DD)
 */
function isValidDate(dateStr) {
  const d = new Date(dateStr);
  return d instanceof Date && !isNaN(d) && dateStr.match(/^\d{4}-\d{2}-\d{2}$/);
}

/**
 * Validate positive integer
 */
function isPositiveInt(val) {
  const n = parseInt(val);
  return Number.isInteger(n) && n > 0;
}

module.exports = { sanitizeBody, sanitizeString, sanitizeObject, isValidEmail, isValidPhone, isValidDate, isPositiveInt };
