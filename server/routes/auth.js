const express = require("express");
const router = express.Router();
const { supabaseAdmin, supabasePublic } = require("../lib/supabase");
const { isValidEmail } = require("../middleware/validate");
const { requireAuth, requireAdmin, invalidateRoleCache } = require("../middleware/auth");

/**
 * GET /api/auth/admin/users
 * Admin only — List all registered users and their profiles.
 */
router.get("/admin/users", requireAuth, requireAdmin, async (req, res) => {
  try {
    // Fetch profiles
    const { data: profiles, error: pError } = await supabaseAdmin
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });

    if (pError) throw pError;

    // Fetch all bookings to calculate counts (efficient enough for admin panel)
    const { data: bookings, error: bError } = await supabaseAdmin
      .from("bookings")
      .select("user_id");

    if (bError) {
      console.warn("Could not fetch bookings for counts:", bError.message);
    }

    // Map counts to users
    const bookingCounts = (bookings || []).reduce((acc, b) => {
      acc[b.user_id] = (acc[b.user_id] || 0) + 1;
      return acc;
    }, {});

    const users = profiles.map(p => ({
      ...p,
      booking_count: bookingCounts[p.id] || 0
    }));

    res.json({ users });
  } catch (err) {
    console.error("Admin list users error:", err.message);
    res.status(500).json({
      error: "Server error",
      message: "Gagal memuat daftar pengguna."
    });
  }
});

/**
 * PATCH /api/auth/admin/users/:id
 * Admin only — Update user profile and role.
 */
router.patch("/admin/users/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { name, phone, role } = req.body;
    
    const { data: profile, error } = await supabaseAdmin
      .from("profiles")
      .update({ name, phone, role, updated_at: new Date().toISOString() })
      .eq("id", req.params.id)
      .select()
      .single();

    if (error) throw error;

    // Invalidate cached role so new permissions take effect immediately
    invalidateRoleCache(req.params.id);

    res.json({ message: "Akun berhasil diperbarui.", user: profile });
  } catch (err) {
    console.error("Admin update user error:", err.message);
    res.status(500).json({
      error: "Server error",
      message: "Gagal memperbarui akun."
    });
  }
});

/**
 * DELETE /api/auth/admin/users/:id
 * Admin only — Delete user account and profile.
 */
router.delete("/admin/users/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    // Delete from Supabase Auth (cascades to profile)
    const { error } = await supabaseAdmin.auth.admin.deleteUser(req.params.id);

    if (error) throw error;

    invalidateRoleCache(req.params.id);
    res.json({ message: "Akun berhasil dihapus." });
  } catch (err) {
    console.error("Admin delete user error:", err.message);
    res.status(500).json({
      error: "Server error",
      message: "Gagal menghapus akun."
    });
  }
});

/**
 * POST /api/auth/admin/users
 * Admin only — Create a new user account and profile.
 */
router.post("/admin/users", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { email, password, name, phone, role } = req.body;

    if (!email || !password || !name || !role) {
      return res.status(400).json({
        error: "Data tidak lengkap",
        message: "Email, password, nama, dan role harus diisi."
      });
    }

    // 1. Create user in Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name, phone }
    });

    if (authError) throw authError;

    // 2. Create profile
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .insert({
        id: authData.user.id,
        email,
        name,
        phone: phone || null,
        role: role || "user"
      });

    if (profileError) throw profileError;

    res.status(201).json({
      message: "Akun berhasil dibuat!",
      user: { id: authData.user.id, email, name, role }
    });
  } catch (err) {
    console.error("Admin create user error:", err.message);
    res.status(500).json({
      error: "Server error",
      message: err.message || "Gagal membuat akun."
    });
  }
});

/**
 * POST /api/auth/signup
 * Register a new user via Supabase Auth, then create a profile record.
 */
router.post("/signup", async (req, res) => {
  try {
    const { email, password, name, phone } = req.body;

    // Validation
    if (!email || !password || !name) {
      return res.status(400).json({
        error: "Data tidak lengkap",
        message: "Email, password, dan nama harus diisi."
      });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({
        error: "Format email salah",
        message: "Masukkan alamat email yang valid."
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        error: "Password terlalu pendek",
        message: "Password minimal 6 karakter."
      });
    }

    // Create user in Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm for now
      user_metadata: { name, phone }
    });

    if (authError) {
      // Handle duplicate email
      if (authError.message.includes("already")) {
        return res.status(409).json({
          error: "Email sudah terdaftar",
          message: "Gunakan email lain atau login ke akun Anda."
        });
      }
      throw authError;
    }

    // Create profile record
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .insert({
        id: authData.user.id,
        email,
        name,
        phone: phone || null,
        role: "user",
        reward_points: 0
      });

    if (profileError) {
      console.error("Profile insert error:", profileError);
      // Don't fail signup, profile can be created later
    }

    res.status(201).json({
      message: "Akun berhasil dibuat! Silakan login.",
      user: {
        id: authData.user.id,
        email: authData.user.email,
        name
      }
    });
  } catch (err) {
    console.error("Signup error:", err.message);
    res.status(500).json({
      error: "Server error",
      message: "Gagal membuat akun. Coba lagi nanti."
    });
  }
});

/**
 * POST /api/auth/login
 * Authenticate user and return JWT tokens.
 */
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        error: "Data tidak lengkap",
        message: "Email dan password harus diisi."
      });
    }

    // Sign in with Supabase Public Client (anon key)
    const { data, error } = await supabasePublic.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      return res.status(401).json({
        error: "Login gagal",
        message: "Email atau password salah."
      });
    }

    // Fetch profile data
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("*")
      .eq("id", data.user.id)
      .single();

    res.json({
      message: "Login berhasil!",
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_at: data.session.expires_at
      },
      user: {
        id: data.user.id,
        email: data.user.email,
        name: profile?.name || data.user.user_metadata?.name || "",
        phone: profile?.phone || "",
        role: profile?.role || "user",
        reward_points: profile?.reward_points || 0
      }
    });
  } catch (err) {
    console.error("Login error:", err.message);
    res.status(500).json({
      error: "Server error",
      message: "Gagal login. Coba lagi nanti."
    });
  }
});

/**
 * POST /api/auth/logout
 * Revoke the current session.
 */
router.post("/logout", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1];
      await supabaseAdmin.auth.admin.signOut(token);
    }

    res.json({ message: "Logout berhasil." });
  } catch (err) {
    // Even if logout fails server-side, tell client to clear tokens
    res.json({ message: "Logout berhasil." });
  }
});

/**
 * POST /api/auth/refresh
 * Refresh an expired access token using a refresh token.
 */
router.post("/refresh", async (req, res) => {
  try {
    const { refresh_token } = req.body;

    if (!refresh_token) {
      return res.status(400).json({
        error: "Token tidak ada",
        message: "Refresh token diperlukan."
      });
    }

    const { data, error } = await supabasePublic.auth.refreshSession({
      refresh_token
    });

    if (error) {
      return res.status(401).json({
        error: "Refresh gagal",
        message: "Sesi tidak valid. Silakan login kembali."
      });
    }

    res.json({
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_at: data.session.expires_at
      }
    });
  } catch (err) {
    console.error("Refresh error:", err.message);
    res.status(500).json({
      error: "Server error",
      message: "Gagal memperbarui sesi."
    });
  }
});

module.exports = router;
