const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const { supabaseAdmin } = require("../lib/supabase");
const { requireAuth, requireAdmin } = require("../middleware/auth");

// Configure multer for image uploads (max 5MB)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Hanya file JPG, PNG, dan WebP yang diizinkan."));
    }
  }
});

/**
 * GET /api/hotels
 * Public — List all active hotels. Supports ?location= filter.
 */
router.get("/", async (req, res) => {
  try {
    const { location } = req.query;

    let query = supabaseAdmin
      .from("hotels")
      .select("*")
      .eq("status", "active")
      .order("created_at", { ascending: false });

    if (location && location !== "all") {
      query = query.eq("location", location);
    }

    const { data: hotels, error } = await query;

    if (error) throw error;

    res.json({ hotels });
  } catch (err) {
    console.error("List hotels error:", err.message);
    res.status(500).json({
      error: "Server error",
      message: "Gagal memuat daftar hotel."
    });
  }
});

/**
 * GET /api/hotels/:id
 * Public — Get single hotel details.
 */
router.get("/:id", async (req, res) => {
  try {
    const { data: hotel, error } = await supabaseAdmin
      .from("hotels")
      .select("*")
      .eq("id", req.params.id)
      .single();

    if (error || !hotel) {
      return res.status(404).json({
        error: "Tidak ditemukan",
        message: "Hotel tidak ditemukan."
      });
    }

    res.json({ hotel });
  } catch (err) {
    console.error("Get hotel error:", err.message);
    res.status(500).json({
      error: "Server error",
      message: "Gagal memuat data hotel."
    });
  }
});

/**
 * POST /api/hotels
 * Admin only — Create a new hotel with optional image upload.
 */
router.post("/", requireAuth, requireAdmin, upload.single("image"), async (req, res) => {
  try {
    const { name, location, area, price, description, tags, capacity, stock } = req.body;

    // Validation
    if (!name || !location || !price) {
      return res.status(400).json({
        error: "Data tidak lengkap",
        message: "Nama, lokasi, dan harga harus diisi."
      });
    }

    let imageUrl = null;

    // Upload image to Supabase Storage if provided
    if (req.file) {
      const fileName = `hotels/${Date.now()}-${req.file.originalname.replace(/\s+/g, "-")}`;

      const { data: uploadData, error: uploadError } = await supabaseAdmin
        .storage
        .from("hotel-images")
        .upload(fileName, req.file.buffer, {
          contentType: req.file.mimetype,
          upsert: false
        });

      if (uploadError) {
        console.error("Image upload error:", uploadError);
      } else {
        const { data: urlData } = supabaseAdmin
          .storage
          .from("hotel-images")
          .getPublicUrl(uploadData.path);

        imageUrl = urlData.publicUrl;
      }
    }

    // Parse tags if string
    const parsedTags = typeof tags === "string"
      ? tags.split(",").map(t => t.trim().toLowerCase())
      : (Array.isArray(tags) ? tags : []);

    const { data: hotel, error } = await supabaseAdmin
      .from("hotels")
      .insert({
        name,
        location: location.toLowerCase(),
        area: area || `${location.charAt(0).toUpperCase() + location.slice(1)}`,
        price: parseInt(price),
        description: description || "",
        tags: parsedTags,
        image_url: imageUrl,
        capacity: capacity || "2 tamu",
        stock: parseInt(stock) || 10,
        rating: 5.0,
        review_count: 0,
        status: "active",
        created_by: req.user.id
      })
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({
      message: "Hotel berhasil ditambahkan!",
      hotel
    });
  } catch (err) {
    console.error("Create hotel error:", err.message);
    res.status(500).json({
      error: "Server error",
      message: "Gagal menambahkan hotel."
    });
  }
});

/**
 * PATCH /api/hotels/:id
 * Admin only — Update hotel details.
 */
router.patch("/:id", requireAuth, requireAdmin, upload.single("image"), async (req, res) => {
  try {
    const { name, location, area, price, description, tags, capacity, stock, status } = req.body;

    const updates = {};
    if (name) updates.name = name;
    if (location) updates.location = location.toLowerCase();
    if (area) updates.area = area;
    if (price) updates.price = parseInt(price);
    if (description) updates.description = description;
    if (capacity) updates.capacity = capacity;
    if (stock !== undefined) updates.stock = parseInt(stock);
    if (status) updates.status = status;
    if (tags) {
      updates.tags = typeof tags === "string"
        ? tags.split(",").map(t => t.trim().toLowerCase())
        : tags;
    }

    // Handle image upload if provided
    if (req.file) {
      const fileName = `hotels/${Date.now()}-${req.file.originalname.replace(/\s+/g, "-")}`;

      const { data: uploadData, error: uploadError } = await supabaseAdmin
        .storage
        .from("hotel-images")
        .upload(fileName, req.file.buffer, {
          contentType: req.file.mimetype,
          upsert: false
        });

      if (!uploadError) {
        const { data: urlData } = supabaseAdmin
          .storage
          .from("hotel-images")
          .getPublicUrl(uploadData.path);

        updates.image_url = urlData.publicUrl;
      }
    }

    updates.updated_at = new Date().toISOString();

    const { data: hotel, error } = await supabaseAdmin
      .from("hotels")
      .update(updates)
      .eq("id", req.params.id)
      .select()
      .single();

    if (error) throw error;

    res.json({ message: "Hotel berhasil diperbarui.", hotel });
  } catch (err) {
    console.error("Update hotel error:", err.message);
    res.status(500).json({
      error: "Server error",
      message: "Gagal memperbarui hotel."
    });
  }
});

/**
 * DELETE /api/hotels/:id
 * Admin only — Soft delete (set status to inactive).
 */
router.delete("/:id", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { error } = await supabaseAdmin
      .from("hotels")
      .update({ status: "inactive", updated_at: new Date().toISOString() })
      .eq("id", req.params.id);

    if (error) throw error;

    res.json({ message: "Hotel berhasil dihapus." });
  } catch (err) {
    console.error("Delete hotel error:", err.message);
    res.status(500).json({
      error: "Server error",
      message: "Gagal menghapus hotel."
    });
  }
});

module.exports = router;
