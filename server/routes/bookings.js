const express = require("express");
const router = express.Router();
const { supabaseAdmin } = require("../lib/supabase");
const { requireAuth, requireAdmin, requireStaff } = require("../middleware/auth");

/**
 * POST /api/bookings
 * Authenticated user — Create a new booking.
 */
router.post("/", requireAuth, async (req, res) => {
  try {
    const {
      hotel_id,
      check_in,
      check_out,
      guest_name,
      guest_email,
      guest_phone,
      guest_note,
      payment_method,
      addons,
      use_points
    } = req.body;

    // Validation
    if (!hotel_id || !check_in || !check_out || !guest_name || !guest_email) {
      return res.status(400).json({
        error: "Data tidak lengkap",
        message: "Hotel, tanggal check-in/out, nama tamu, dan email harus diisi."
      });
    }

    // Validate dates
    const checkInDate = new Date(check_in);
    const checkOutDate = new Date(check_out);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (checkInDate < today) {
      return res.status(400).json({
        error: "Tanggal tidak valid",
        message: "Tanggal check-in tidak boleh di masa lalu."
      });
    }

    if (checkOutDate <= checkInDate) {
      return res.status(400).json({
        error: "Tanggal tidak valid",
        message: "Tanggal check-out harus setelah check-in."
      });
    }

    // Fetch hotel data to calculate price
    const { data: hotel, error: hotelError } = await supabaseAdmin
      .from("hotels")
      .select("*")
      .eq("id", hotel_id)
      .eq("status", "active")
      .single();

    if (hotelError || !hotel) {
      return res.status(404).json({
        error: "Hotel tidak ditemukan",
        message: "Hotel yang dipilih tidak tersedia."
      });
    }

    // Check stock availability
    if (hotel.stock <= 0) {
      return res.status(409).json({
        error: "Kamar habis",
        message: "Maaf, kamar sudah penuh untuk tanggal tersebut."
      });
    }

    // Calculate pricing
    const nights = Math.ceil((checkOutDate - checkInDate) / (1000 * 60 * 60 * 24));
    const basePrice = hotel.price * nights;

    // Calculate addons total
    const addonPrices = { sarapan: 150000, spa: 250000, airport: 350000 };
    let addonTotal = 0;
    const selectedAddons = [];

    if (Array.isArray(addons)) {
      addons.forEach(addon => {
        const price = addonPrices[addon] || 0;
        addonTotal += price;
        selectedAddons.push({ name: addon, price });
      });
    }

    // Points discount
    let pointsDiscount = 0;
    if (use_points) {
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("reward_points")
        .eq("id", req.user.id)
        .single();

      if (profile && profile.reward_points > 0) {
        // 1 point = Rp100
        pointsDiscount = Math.min(profile.reward_points * 100, basePrice * 0.1); // Max 10% discount
      }
    }

    const subtotal = basePrice + addonTotal - pointsDiscount;
    const tax = Math.round(subtotal * 0.11);
    const totalPrice = subtotal + tax;

    // Generate booking code
    const bookingCode = `PH-${Date.now().toString(36).toUpperCase()}`;

    // Create booking
    const { data: booking, error: bookingError } = await supabaseAdmin
      .from("bookings")
      .insert({
        code: bookingCode,
        user_id: req.user.id,
        hotel_id,
        hotel_name: hotel.name,
        check_in,
        check_out,
        nights,
        guest_name,
        guest_email,
        guest_phone: guest_phone || null,
        guest_note: guest_note || null,
        base_price: basePrice,
        addon_total: addonTotal,
        tax,
        points_discount: pointsDiscount,
        total_price: totalPrice,
        payment_method: payment_method || "virtual_account",
        payment_status: "pending",
        booking_status: "confirmed",
        addons: selectedAddons
      })
      .select()
      .single();

    if (bookingError) throw bookingError;

    // Decrease hotel stock atomically
    await supabaseAdmin.rpc("decrement_stock", { target_hotel_id: hotel_id });

    // Deduct points if used
    if (pointsDiscount > 0) {
      const pointsUsed = Math.ceil(pointsDiscount / 100);
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("reward_points")
        .eq("id", req.user.id)
        .single();

      await supabaseAdmin
        .from("profiles")
        .update({ reward_points: Math.max(0, (profile?.reward_points || 0) - pointsUsed) })
        .eq("id", req.user.id);
    }

    // Award new points (1% of total)
    const newPoints = Math.floor(totalPrice / 100);
    await supabaseAdmin.rpc("increment_points", {
      user_id: req.user.id,
      points: newPoints
    });

    res.status(201).json({
      message: `Booking ${bookingCode} berhasil dibuat!`,
      booking: {
        ...booking,
        points_earned: newPoints
      }
    });
  } catch (err) {
    console.error("Create booking error:", err.message);
    res.status(500).json({
      error: "Server error",
      message: "Gagal membuat booking. Coba lagi nanti."
    });
  }
});

/**
 * GET /api/bookings
 * Authenticated user — List own bookings.
 */
router.get("/", requireAuth, async (req, res) => {
  try {
    const { data: bookings, error } = await supabaseAdmin
      .from("bookings")
      .select("*")
      .eq("user_id", req.user.id)
      .order("created_at", { ascending: false });

    if (error) throw error;

    res.json({ bookings });
  } catch (err) {
    console.error("List bookings error:", err.message);
    res.status(500).json({
      error: "Server error",
      message: "Gagal memuat daftar booking."
    });
  }
});

/**
 * GET /api/bookings/:code
 * Authenticated user — Get booking detail by code.
 */
router.get("/:code", requireAuth, async (req, res) => {
  try {
    const { data: booking, error } = await supabaseAdmin
      .from("bookings")
      .select("*")
      .eq("code", req.params.code)
      .single();

    if (error || !booking) {
      return res.status(404).json({
        error: "Tidak ditemukan",
        message: "Booking tidak ditemukan."
      });
    }

    // Ensure user can only see their own booking (unless admin/staff)
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", req.user.id)
      .single();

    if (booking.user_id !== req.user.id && !["admin", "staff"].includes(profile?.role)) {
      return res.status(403).json({
        error: "Akses ditolak",
        message: "Anda tidak memiliki akses ke booking ini."
      });
    }

    res.json({ booking });
  } catch (err) {
    console.error("Get booking error:", err.message);
    res.status(500).json({
      error: "Server error",
      message: "Gagal memuat data booking."
    });
  }
});

/**
 * GET /api/bookings/admin/stats
 * Admin/Staff — Get dashboard statistics.
 */
router.get("/admin/stats", requireAuth, requireStaff, async (req, res) => {
  try {
    // 1. Get total rooms (current stock + active bookings)
    const { data: hotels, error: hotelError } = await supabaseAdmin
      .from("hotels")
      .select("stock");
    
    if (hotelError) throw hotelError;
    
    const currentStock = hotels.reduce((acc, h) => acc + h.stock, 0);

    // 2. Get booking stats
    const { data: bookings, error: bookingError } = await supabaseAdmin
      .from("bookings")
      .select("total_price, payment_status, booking_status, created_at, check_in, payment_method");

    if (bookingError) throw bookingError;

    const totalBookingsCount = bookings.length;
    const pendingBookings = bookings.filter(b => b.payment_status === "pending").length;
    
    // Revenue from paid bookings
    const totalRevenue = bookings
      .filter(b => b.payment_status === "paid")
      .reduce((acc, b) => acc + b.total_price, 0);

    // Active bookings (occupying rooms)
    const activeBookings = bookings.filter(b => ["confirmed", "checked_in"].includes(b.booking_status)).length;
    
    // Total rooms = active bookings + current stock
    const totalCapacity = activeBookings + currentStock;
    const occupancy = totalCapacity > 0 ? Math.round((activeBookings / totalCapacity) * 100) : 0;

    // ADR (Average Daily Rate) = Revenue / Paid Bookings
    const paidBookingsCount = bookings.filter(b => b.payment_status === "paid").length;
    const adr = paidBookingsCount > 0 ? Math.round(totalRevenue / paidBookingsCount) : 0;

    // 3. Operational Stats (Today)
    const startOfDay = new Date();
    startOfDay.setHours(0,0,0,0);
    const endOfDay = new Date();
    endOfDay.setHours(23,59,59,999);

    const checkinsToday = bookings.filter(b => {
      const ci = new Date(b.check_in);
      return ci >= startOfDay && ci <= endOfDay;
    }).length;

    const dailyRevenue = bookings
      .filter(b => {
        const created = new Date(b.created_at); // or payment date if available
        return b.payment_status === "paid" && created >= startOfDay && created <= endOfDay;
      })
      .reduce((acc, b) => acc + b.total_price, 0);

    // 4. Trend Data (Last 6 months)
    const months = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
    const currentMonth = new Date().getMonth();
    const trend = [];
    for (let i = 5; i >= 0; i--) {
      const targetMonth = (currentMonth - i + 12) % 12;
      const count = bookings.filter(b => {
        const d = new Date(b.created_at);
        return d.getMonth() === targetMonth;
      }).length;
      trend.push({ label: months[targetMonth], value: count });
    }

    // 5. Channel Distribution
    const channels = {
      "Direct Website": bookings.filter(b => b.payment_method === "va" || b.payment_method === "qris").length,
      "OTA (Agoda/B.com)": bookings.filter(b => b.payment_method === "cc").length,
      "Others": bookings.filter(b => b.payment_method === "paylater").length
    };
    const totalC = totalBookingsCount || 1;
    const channelDist = Object.entries(channels).map(([name, count]) => ({
      name,
      percentage: Math.round((count / totalC) * 100)
    }));

    // 6. Segments (Mock logic based on guest notes or addons)
    const segmentDist = [
      { name: "Business", percentage: 40 },
      { name: "Leisure", percentage: 35 },
      { name: "Family", percentage: 25 }
    ];

    res.json({
      occupancy,
      revenue: totalRevenue,
      adr,
      bookings: totalBookingsCount,
      pending: pendingBookings,
      checkinsToday,
      dailyRevenue,
      roomsReady: currentStock,
      trend,
      channelDist,
      segmentDist,
      forecast: [
        { label: "Minggu ini", value: occupancy, trend: "+2%" },
        { label: "Minggu depan", value: Math.max(0, occupancy - 5), trend: "-3%" },
        { label: "High season", value: Math.min(100, occupancy + 15), trend: "+10%" }
      ]
    });
  } catch (err) {
    console.error("Admin stats error:", err.message);
    res.status(500).json({
      error: "Server error",
      message: "Gagal memuat statistik dashboard."
    });
  }
});

/**
 * GET /api/bookings/admin/all
 * Admin/Staff — List all bookings for management.
 */
router.get("/admin/all", requireAuth, requireStaff, async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    let query = supabaseAdmin
      .from("bookings")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) {
      query = query.eq("booking_status", status);
    }

    const { data: bookings, error, count } = await query;

    if (error) throw error;

    res.json({
      bookings,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: count,
        pages: Math.ceil(count / limit)
      }
    });
  } catch (err) {
    console.error("Admin list bookings error:", err.message);
    res.status(500).json({
      error: "Server error",
      message: "Gagal memuat daftar booking."
    });
  }
});

/**
 * PATCH /api/bookings/:code/status
 * Staff/Admin — Update booking status (check-in, check-out, cancel).
 */
router.patch("/:code/status", requireAuth, requireStaff, async (req, res) => {
  try {
    const { booking_status, payment_status } = req.body;
    const validBookingStatuses = ["confirmed", "checked_in", "checked_out", "cancelled", "no_show"];
    const validPaymentStatuses = ["pending", "paid", "refunded", "failed"];

    const updates = { updated_at: new Date().toISOString() };

    if (booking_status) {
      if (!validBookingStatuses.includes(booking_status)) {
        return res.status(400).json({
          error: "Status tidak valid",
          message: `Status booking harus salah satu dari: ${validBookingStatuses.join(", ")}`
        });
      }
      updates.booking_status = booking_status;
    }

    if (payment_status) {
      if (!validPaymentStatuses.includes(payment_status)) {
        return res.status(400).json({
          error: "Status tidak valid",
          message: `Status pembayaran harus salah satu dari: ${validPaymentStatuses.join(", ")}`
        });
      }
      updates.payment_status = payment_status;
    }

    const { data: booking, error } = await supabaseAdmin
      .from("bookings")
      .update(updates)
      .eq("code", req.params.code)
      .select()
      .single();

    if (error) throw error;

    // If cancelled, return stock
    if (booking_status === "cancelled") {
      console.log(`[CMS] Returning stock for hotel ${booking.hotel_id}`);
      await supabaseAdmin.rpc("increment_stock", { target_hotel_id: booking.hotel_id });
    }

    console.log(`[CMS] Booking ${req.params.code} status updated to ${booking_status || 'no-change'}/${payment_status || 'no-change'}`);
    res.json({ message: "Status booking diperbarui.", booking });
  } catch (err) {
    console.error("Update booking status error:", err.message);
    res.status(500).json({
      error: "Server error",
      message: "Gagal memperbarui status booking."
    });
  }
});

module.exports = router;
