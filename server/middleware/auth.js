const { supabaseAdmin } = require("../lib/supabase");

/**
 * In-memory role cache to avoid hitting the database on every request.
 * Entries expire after 5 minutes.
 */
const roleCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getCachedRole(userId) {
  const entry = roleCache.get(userId);
  if (entry && Date.now() - entry.timestamp < CACHE_TTL) {
    return entry.role;
  }
  roleCache.delete(userId);
  return null;
}

function setCachedRole(userId, role) {
  roleCache.set(userId, { role, timestamp: Date.now() });
}

/**
 * Clear role cache for a specific user (call after role updates).
 */
function invalidateRoleCache(userId) {
  roleCache.delete(userId);
}

/**
 * Authentication Middleware
 * Verifies the JWT from the Authorization header using Supabase.
 * Attaches the authenticated user to req.user.
 */
async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      error: "Akses ditolak",
      message: "Token autentikasi tidak ditemukan. Silakan login terlebih dahulu."
    });
  }

  const token = authHeader.split(" ")[1];

  try {
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({
        error: "Token tidak valid",
        message: "Sesi Anda telah berakhir. Silakan login kembali."
      });
    }

    // Attach user and token to request
    req.user = user;
    req.accessToken = token;
    next();
  } catch (err) {
    console.error("Auth middleware error:", err.message);
    return res.status(500).json({
      error: "Server error",
      message: "Terjadi kesalahan saat memverifikasi autentikasi."
    });
  }
}

/**
 * Fetch role from DB (with cache).
 */
async function fetchRole(userId) {
  // Check cache first
  const cached = getCachedRole(userId);
  if (cached) return cached;

  const { data: profile, error } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();

  if (error || !profile) return null;

  setCachedRole(userId, profile.role);
  return profile.role;
}

/**
 * Admin Authorization Middleware
 * Must be used AFTER requireAuth.
 * Checks if the user has role 'admin' in the profiles table.
 */
async function requireAdmin(req, res, next) {
  try {
    const role = await fetchRole(req.user.id);

    if (role !== "admin") {
      return res.status(403).json({
        error: "Akses ditolak",
        message: "Anda tidak memiliki hak akses admin."
      });
    }

    req.userRole = "admin";
    next();
  } catch (err) {
    console.error("Admin check error:", err.message);
    return res.status(500).json({
      error: "Server error",
      message: "Gagal memverifikasi hak akses."
    });
  }
}

/**
 * Staff Authorization Middleware
 * Checks if user has role 'staff' or 'admin'.
 */
async function requireStaff(req, res, next) {
  try {
    const role = await fetchRole(req.user.id);

    if (!["admin", "staff"].includes(role)) {
      return res.status(403).json({
        error: "Akses ditolak",
        message: "Anda tidak memiliki hak akses staff."
      });
    }

    req.userRole = role;
    next();
  } catch (err) {
    console.error("Staff check error:", err.message);
    return res.status(500).json({
      error: "Server error",
      message: "Gagal memverifikasi hak akses."
    });
  }
}

module.exports = { requireAuth, requireAdmin, requireStaff, invalidateRoleCache };
