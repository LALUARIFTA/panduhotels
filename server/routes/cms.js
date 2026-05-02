const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { supabaseAdmin } = require("../lib/supabase");
const { requireAuth, requireAdmin } = require("../middleware/auth");

// Configure Multer for Logo Upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Save to 'uploads' directory in the project root
    const uploadDir = path.join(__dirname, "../../uploads");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `logo-${Date.now()}${ext}`);
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Hanya file gambar yang diperbolehkan!"));
  }
});

const SETTINGS_FILE = path.join(__dirname, "../../data/settings.json");

// Helper to get local settings
function getLocalSettings() {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      return JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf-8"));
    }
  } catch (err) {
    console.error("Failed to read local settings:", err);
  }
  return {};
}

// Helper to save local settings
function saveLocalSettings(settings) {
  try {
    const dir = path.dirname(SETTINGS_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
  } catch (err) {
    console.error("Failed to save local settings:", err);
  }
}

/**
 * GET /api/cms/settings
 * Get all site settings from Supabase (fallback to local JSON).
 */
router.get("/settings", async (req, res) => {
  try {
    // Try Supabase first
    const { data, error } = await supabaseAdmin
      .from("site_settings")
      .select("*");

    if (error) {
      console.warn("Supabase settings not available, using local fallback.");
      return res.json({ settings: getLocalSettings() });
    }

    const settings = data.reduce((acc, item) => {
      acc[item.key] = item.value;
      return acc;
    }, {});

    // Sync local file with DB data
    saveLocalSettings(settings);

    res.json({ settings });
  } catch (err) {
    console.warn("CMS Get Settings error, using local fallback:", err.message);
    res.json({ settings: getLocalSettings() });
  }
});

/**
 * POST /api/cms/settings
 * Save/Update site settings (Upsert to DB and Local).
 */
router.post("/settings", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { settings } = req.body;
    
    if (!settings || typeof settings !== 'object') {
      return res.status(400).json({ error: "Format data tidak valid." });
    }

    // Always save locally first
    saveLocalSettings(settings);

    // Try to save to Supabase
    const rows = Object.entries(settings).map(([key, value]) => ({
      key,
      value,
      updated_at: new Date().toISOString()
    }));

    const { error } = await supabaseAdmin
      .from("site_settings")
      .upsert(rows, { onConflict: 'key' });

    if (error) {
      console.warn("Could not save to Supabase site_settings table:", error.message);
      return res.json({ 
        message: "Pengaturan disimpan secara lokal (Database belum siap).",
        localOnly: true 
      });
    }

    res.json({ message: "Pengaturan berhasil dipublikasikan!" });
  } catch (err) {
    console.error("CMS Save Settings Error:", err.message);
    // Fallback success if local save worked
    res.json({ message: "Pengaturan disimpan secara lokal.", localOnly: true });
  }
});

/**
 * POST /api/cms/upload-logo
 * Upload logo file and return its local URL.
 */
router.post("/upload-logo", requireAuth, requireAdmin, upload.single("logo"), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "File tidak ditemukan." });
    }
    
    // Return the relative URL (served via express.static)
    const logoUrl = `/uploads/${req.file.filename}`;
    res.json({ logoUrl });
  } catch (err) {
    res.status(500).json({ error: "Upload failed", message: err.message });
  }
});

module.exports = router;
