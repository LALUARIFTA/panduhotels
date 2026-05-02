// ══════════════════════════════════════════
// PanduHotel — User Dashboard (user.html)
// Fetches bookings & profile from API.
// ══════════════════════════════════════════

if (!PanduAPI.isLoggedIn()) {
  window.location.href = "login.html";
}

const user = PanduAPI.getUser();
const userName = document.querySelector("#userName");
const profileName = document.querySelector("#profileName");
const profileEmail = document.querySelector("#profileEmail");
const profilePhone = document.querySelector("#profilePhone");
const panelNavToggle = document.querySelector(".nav-toggle");
const userNav = document.querySelector(".site-nav");

// Display user data
if (user && userName) {
  const displayName = user.name || user.email.split("@")[0];
  userName.textContent = displayName;
  if (profileName) profileName.textContent = displayName;
  if (profileEmail) profileEmail.textContent = user.email;
  if (profilePhone) profilePhone.textContent = user.phone || "Belum diisi";
}

// Update reward points display
const rewardDisplay = document.querySelector(".user-summary-card strong");
if (rewardDisplay && user) {
  rewardDisplay.textContent = `${(user.reward_points || 0).toLocaleString("id-ID")} poin`;
}

// Load user bookings from API
async function loadBookings() {
  try {
    const bookings = await PanduAPI.getBookings();
    const bookingList = document.querySelector("#user-bookings-list");
    const paymentList = document.querySelector("#user-payments-list");
    
    if (!bookings.length) {
      if (bookingList) bookingList.innerHTML = '<p class="section-desc">Belum ada reservasi. <a href="booking.html">Mulai booking sekarang?</a></p>';
      if (paymentList) paymentList.innerHTML = '<p class="section-desc">Belum ada riwayat pembayaran.</p>';
      return;
    }

    const currency = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });

    // Render Booking List
    if (bookingList) {
      bookingList.innerHTML = bookings.map(b => {
        let statusClass = "pending";
        if (b.booking_status === "confirmed") statusClass = "paid";
        if (b.booking_status === "cancelled" || b.booking_status === "refunded") statusClass = "cancelled";
        const statusLabel = b.booking_status.charAt(0).toUpperCase() + b.booking_status.slice(1);
        const checkIn = new Date(b.check_in).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });

        return `
          <article>
            <div><strong>${b.code}</strong><span>${b.hotel_name} | ${b.nights} malam</span></div>
            <span class="status ${statusClass}">${statusLabel}</span>
            <b>${checkIn}</b>
            <button class="ghost-btn detail-btn" data-code="${b.code}" style="padding: 6px 12px; font-size: 0.8rem;">Detail</button>
          </article>
        `;
      }).join("");
    }

    // Render Payment List
    if (paymentList) {
      paymentList.innerHTML = bookings.map(b => {
        let payStatusClass = "pending";
        if (b.payment_status === "paid") payStatusClass = "paid";
        if (b.payment_status === "refunded" || b.payment_status === "failed") payStatusClass = "cancelled";
        const payStatusLabel = b.payment_status.toUpperCase();
        const payMethod = b.payment_method.replace("_", " ").toUpperCase();

        return `
          <article>
            <div><strong>INV-${b.code.split("-")[1]}</strong><span>Ref: ${b.code} | ${payMethod}</span></div>
            <span class="status ${payStatusClass}">${payStatusLabel}</span>
            <b>${currency.format(b.total_price)}</b>
          </article>
        `;
      }).join("");
    }

    // Update Dashboard Stats
    const activeBookings = bookings.filter(b => b.booking_status === "confirmed" || b.booking_status === "checked_in");
    const statActive = document.querySelector("#stat-active-bookings");
    if (statActive) statActive.textContent = activeBookings.length;

    const nextBooking = activeBookings.sort((a, b) => new Date(a.check_in) - new Date(b.check_in))[0];
    const statNext = document.querySelector("#stat-next-checkin");
    if (statNext && nextBooking) {
      statNext.textContent = new Date(nextBooking.check_in).toLocaleDateString("id-ID", { day: "numeric", month: "short" });
    }

  } catch (err) {
    console.warn("Gagal memuat booking:", err.message);
  }
}

// Modal Logic
const detailModal = document.querySelector("#detailModal");
const detailModalBody = document.querySelector("#detailModalBody");
const closeDetailModal = document.querySelector("#closeDetailModal");

async function openDetailModal(code) {
  if (!detailModal || !detailModalBody) return;
  
  detailModal.classList.add("show");
  detailModalBody.innerHTML = "<p>Memuat detail...</p>";

  try {
    const booking = await PanduAPI.getBooking(code);
    if (!booking) throw new Error("Booking tidak ditemukan");

    const currency = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });
    const checkIn = new Date(booking.check_in).toLocaleDateString("id-ID", { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const checkOut = new Date(booking.check_out).toLocaleDateString("id-ID", { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

    detailModalBody.innerHTML = `
      <div class="receipt-card">
        <div class="receipt-header">
          <p>Kode Booking Resmi</p>
          <h2>${booking.code}</h2>
        </div>
        
        <div class="receipt-info-grid">
          <div class="receipt-item">
            <label>Check-in</label>
            <span>${checkIn}</span>
          </div>
          <div class="receipt-item">
            <label>Check-out</label>
            <span>${checkOut}</span>
          </div>
          <div class="receipt-item" style="grid-column: span 2;">
            <label>Hotel & Kamar</label>
            <span>${booking.hotel_name}</span>
            <p style="margin: 4px 0 0; color: var(--muted); font-size: 0.85rem;">${booking.nights} Malam</p>
          </div>
        </div>

        <hr class="receipt-divider">

        <div class="receipt-info-grid">
          <div class="receipt-item" style="grid-column: span 2;">
            <label>Data Tamu</label>
            <span>${booking.guest_name}</span>
            <p style="margin: 4px 0 0; color: var(--muted); font-size: 0.85rem;">${booking.guest_email} | ${booking.guest_phone || '-'}</p>
          </div>
        </div>

        <div class="receipt-footer">
          <div style="display: flex; justify-content: space-between;">
            <label style="font-size: 0.75rem; color: var(--muted); font-weight: 800; text-transform: uppercase;">Status Reservasi</label>
            <span class="status ${booking.booking_status === 'confirmed' ? 'paid' : (booking.booking_status === 'cancelled' ? 'cancelled' : 'pending')}">${booking.booking_status}</span>
          </div>
          <div class="receipt-total">
            <label style="font-weight: 800; color: var(--ink);">Total Pembayaran</label>
            <strong>${currency.format(booking.total_price)}</strong>
          </div>
        </div>
      </div>
    `;
  } catch (err) {
    detailModalBody.innerHTML = `<p style="color: red;">Error: ${err.message}</p>`;
  }
}

if (closeDetailModal) {
  closeDetailModal.addEventListener("click", () => detailModal.classList.remove("show"));
}

window.addEventListener("click", (e) => {
  if (e.target === detailModal) detailModal.classList.remove("show");
});

// Event delegation for detail buttons
document.addEventListener("click", (e) => {
  if (e.target.classList.contains("detail-btn")) {
    const code = e.target.dataset.code;
    openDetailModal(code);
  }
});

const printBookingBtn = document.querySelector("#printBookingBtn");
if (printBookingBtn) {
  printBookingBtn.addEventListener("click", () => {
    window.print();
  });
}

// Logout handler
document.querySelector("#logoutButton").addEventListener("click", async () => {
  await PanduAPI.logout();
  window.location.href = "index.html";
});

// Mobile nav toggle
if (panelNavToggle && userNav) {
  panelNavToggle.addEventListener("click", () => {
    const isOpen = userNav.classList.toggle("open");
    panelNavToggle.setAttribute("aria-expanded", String(isOpen));
  });

  userNav.addEventListener("click", () => {
    userNav.classList.remove("open");
    panelNavToggle.setAttribute("aria-expanded", "false");
  });
}

loadBookings();
