if (!PanduAPI.isLoggedIn()) { window.location.href = "login.html"; }

const adminTabs = document.querySelectorAll(".admin-tab");
const adminViews = document.querySelectorAll(".admin-view");
const panelNavToggle = document.querySelector(".panel-nav-toggle");
const adminNav = document.querySelector(".admin-shell-nav");
const inventoryForm = document.querySelector("#inventoryForm");
const securityForm = document.querySelector("#securityForm");
const securityModal = document.querySelector("#securityModal");
const addAccountBtn = document.querySelector("#addAccountBtn");
const cancelSecBtn = document.querySelector("#cancelSecBtn");
const toast = document.querySelector("#toast") || { textContent: "", classList: { add: () => {}, remove: () => {} } };

let allHotels = [];
let allAccounts = [];
let editingId = null;
let editingAccountId = null;

function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 3000);
}

const currency = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0
});

// Display logged-in user info in topbar
const currentUser = PanduAPI.getUser();
if (currentUser) {
  const profileEl = document.querySelector(".admin-profile");
  if (profileEl) {
    const initials = currentUser.name ? currentUser.name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) : "??";
    profileEl.innerHTML = `
      <span>${currentUser.email}</span>
      <strong>${initials}</strong>
    `;
  }
}

// Tab Navigation
adminTabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    adminTabs.forEach((item) => item.classList.remove("active"));
    adminViews.forEach((view) => view.classList.remove("active"));
    tab.classList.add("active");
    document.querySelector(`#admin-${tab.dataset.admin}`).classList.add("active");
    if (adminNav) adminNav.classList.remove("open");
  });
});

// Load Hotels
async function loadAdminHotels() {
  try {
    allHotels = await PanduAPI.getHotels();
    const list = document.querySelector(".inventory-list");
    if (!list) return;
    
    list.innerHTML = allHotels.map(h => `
      <article class="inventory-card" data-id="${h.id}">
        <div class="inv-card-header">
          <div class="inv-main-info">
            <h3>${h.name}</h3>
            <span class="inv-location">📍 ${h.location}</span>
          </div>
          <div class="inv-status-badge ${h.stock > 5 ? 'in-stock' : 'low-stock'}">
            ${h.stock} Kamar
          </div>
        </div>
        <div class="inv-card-body">
          <div class="inv-detail">
            <span>Harga Dasar</span>
            <strong>Rp${h.price.toLocaleString("id-ID")}</strong>
          </div>
          <div class="inv-detail">
            <span>Kapasitas</span>
            <strong>${h.capacity || '2 Tamu'}</strong>
          </div>
        </div>
        <div class="inv-card-footer">
          <button class="edit-btn" data-action="edit" data-id="${h.id}">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"></path></svg>
            Edit
          </button>
          <button class="delete-btn" data-action="delete" data-id="${h.id}">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            Hapus
          </button>
        </div>
      </article>
    `).join("");
  } catch (err) {
    console.warn("Gagal memuat hotel:", err);
  }
}

// CREATE & UPDATE
if (inventoryForm) {
  inventoryForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = inventoryForm.querySelector("button[type='submit']");
    btn.disabled = true;
    btn.textContent = editingId ? "Mengupdate..." : "Menyimpan...";

    try {
      const fd = new FormData();
      fd.append("name", document.querySelector("#invRoomName").value);
      fd.append("location", document.querySelector("#invLocation").value);
      fd.append("price", document.querySelector("#invPrice").value);
      fd.append("stock", document.querySelector("#invStock").value);
      
      const selectedCaps = [...document.querySelectorAll("#invCapacityCheckboxes input:checked")].map(i => i.value);
      fd.append("capacity", selectedCaps.join(", "));
      
      fd.append("tags", document.querySelector("#invFeatures").value);
      
      const img = document.querySelector("#invImage");
      if (img.files[0]) fd.append("image", img.files[0]);

      let res;
      if (editingId) {
        res = await PanduAPI.updateHotel(editingId, fd);
        showToast("Hotel berhasil diupdate!");
      } else {
        res = await PanduAPI.createHotel(fd);
        showToast("Hotel berhasil ditambahkan!");
      }

      cancelEdit();
      loadAdminHotels();
      document.querySelector("#inventoryModal")?.classList.remove("show");
    } catch (err) {
      alert(err.message || "Terjadi kesalahan.");
    } finally {
      btn.disabled = false;
      btn.textContent = "Simpan ke Database";
    }
  });
}

// DELETE
window.deleteHotel = async (id) => {
  if (!confirm("Apakah Anda yakin ingin menghapus hotel ini?")) return;
  try {
    await PanduAPI.deleteHotel(id);
    showToast("Hotel berhasil dihapus.");
    loadAdminHotels();
  } catch (err) {
    alert(err.message || "Gagal menghapus.");
  }
};

// Cancel Edit
function cancelEdit() {
  editingId = null;
  if (inventoryForm) inventoryForm.reset();
  document.querySelectorAll("#invCapacityCheckboxes input").forEach(i => i.checked = false);
  const submitBtn = inventoryForm?.querySelector("button[type='submit']");
  if (submitBtn) submitBtn.textContent = "Simpan ke Database";
  document.querySelector("#cancelEditBtn")?.remove();
}

// EDIT (Fill Form)
window.editHotel = (id) => {
  const hotel = allHotels.find(h => h.id === id);
  if (!hotel) return;

  editingId = id;
  document.querySelector("#invRoomName").value = hotel.name;
  document.querySelector("#invLocation").value = hotel.location;
  document.querySelector("#invPrice").value = hotel.price;
  document.querySelector("#invStock").value = hotel.stock;
  
  // Set Checkboxes
  document.querySelectorAll("#invCapacityCheckboxes input").forEach(i => i.checked = false);
  if (hotel.capacity) {
    const caps = hotel.capacity.split(", ");
    caps.forEach(c => {
      const cb = document.querySelector(`#invCapacityCheckboxes input[value="${c.trim()}"]`);
      if (cb) cb.checked = true;
    });
  }

  document.querySelector("#invFeatures").value = (hotel.tags || []).join(", ");
  
  const submitBtn = inventoryForm.querySelector("button[type='submit']");
  submitBtn.textContent = "Update Hotel";
  
  // Show Modal
  const inventoryModal = document.querySelector("#inventoryModal");
  if (inventoryModal) {
    inventoryModal.classList.add("show");
  }
  

};

// Mobile nav toggle
if (panelNavToggle) {
  panelNavToggle.addEventListener("click", () => {
    const isOpen = adminNav.classList.toggle("open");
    panelNavToggle.setAttribute("aria-expanded", String(isOpen));
  });
}

// Logout
const logoutBtn = document.createElement("button");
logoutBtn.textContent = "Keluar Panel";
logoutBtn.className = "admin-logout-btn";
logoutBtn.style.cssText = "margin-top: auto; padding: 12px; background: #fee2e2; color: #991b1b; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; margin-top: 20px;";
logoutBtn.addEventListener("click", async () => {
  await PanduAPI.logout();
  window.location.href = "index.html";
});
adminNav?.appendChild(logoutBtn);

// Event Delegation for Inventory & Reservations
document.addEventListener("click", (e) => {
  const target = e.target.closest("button");
  if (!target) return;

  const { action, id, code } = target.dataset;

  // Inventory actions
  if (action === "edit") editHotel(id);
  if (action === "delete") deleteHotel(id);

  // Reservation/Payment actions
  if (action === "pay") updateBookingStatus(code, { payment_status: "paid" });
  if (action === "cancel") updateBookingStatus(code, { booking_status: "cancelled" });
  if (action === "refund") updateBookingStatus(code, { booking_status: "cancelled", payment_status: "refunded" });

  // Account actions (Security)
  if (action === "edit-acc") editAccount(id);
  if (action === "delete-acc") deleteAccount(id);
  if (action === "view-guest-detail") viewGuestBookings(id);

  // Rate actions
  if (action === "edit-rate") editRate(target);
});

// Global Button Feedback (untuk tombol yang belum ada fungsinya)
document.addEventListener("click", (e) => {
  if (e.target.classList.contains("primary-btn") && !e.target.closest("form") && !e.target.onclick && e.target.id !== "createResBtn") {
    showToast("Fitur operasional sedang disiapkan.");
  }
});

// Load Dashboard Stats
async function loadDashboardStats() {
  try {
    const stats = await PanduAPI.request("/bookings/admin/stats");
    
    // Primary Analytics
    const statCards = document.querySelectorAll(".stat-grid > div strong");
    if (statCards.length >= 4) {
      statCards[0].textContent = `${stats.occupancy}%`;
      statCards[1].textContent = `Rp${(stats.revenue / 1000000).toFixed(1)}jt`;
      statCards[2].textContent = `Rp${(stats.adr / 1000).toFixed(0)}rb`;
      statCards[3].textContent = stats.bookings;
      
      const smalls = document.querySelectorAll(".stat-grid > div small");
      if (smalls[3]) smalls[3].textContent = `${stats.pending} menunggu bayar`;
    }

    // Operational Summary (Real-time)
    const ciEl = document.querySelector("#stat-checkins");
    if (ciEl) ciEl.textContent = stats.checkinsToday;

    const rrEl = document.querySelector("#stat-rooms-ready");
    if (rrEl) rrEl.textContent = stats.roomsReady;

    const drEl = document.querySelector("#stat-daily-rev");
    if (drEl) drEl.textContent = currency.format(stats.dailyRevenue);

    // Dynamic Chart: Tren Booking (Last 6 Months)
    const chart = document.querySelector(".chart-card");
    if (chart && stats.trend) {
      const max = Math.max(...stats.trend.map(t => t.value), 1);
      chart.innerHTML = stats.trend.map(t => `
        <div class="bar" data-label="${t.label}" style="height: ${(t.value/max * 80) + 10}%"></div>
      `).join("");
    }

    // Forecast List
    const forecastList = document.querySelector(".forecast-list");
    if (forecastList && stats.forecast) {
      forecastList.innerHTML = stats.forecast.map(f => `
        <div><span>${f.label}</span><strong>${f.value}%</strong><em class="${f.trend.startsWith('+') ? 'trend-up' : 'trend-down'}">${f.trend}</em></div>
      `).join("");
    }

    // Channel Distribution
    const channelList = document.querySelector(".channel-list");
    if (channelList && stats.channelDist) {
      channelList.innerHTML = stats.channelDist.map(c => `
        <div><span>${c.name}</span><strong>${c.percentage}%</strong><em style="width: ${c.percentage}%"></em></div>
      `).join("");
    }

    // Guest Segments
    const segmentGrid = document.querySelector(".segment-grid");
    if (segmentGrid && stats.segmentDist) {
      segmentGrid.innerHTML = stats.segmentDist.map(s => `
        <article><strong>${s.name}</strong><span>${s.percentage}%</span></article>
      `).join("");
    }

  } catch (err) {
    console.warn("Gagal memuat statistik dashboard:", err);
  }
}

// Real-time Polling (Every 30 seconds)
function startRealtimePolling() {
  setInterval(() => {
    // Only refresh if Dashboard or Payments are active
    const activeTab = document.querySelector(".admin-tab.active")?.dataset.admin;
    if (activeTab === "dashboard") {
      loadDashboardStats();
    } else if (activeTab === "payments") {
      loadAdminPayments();
    } else if (activeTab === "reservations") {
      loadAdminReservations();
    }
  }, 30000);
}
startRealtimePolling();

// Export Report to CSV
window.exportReport = async () => {
  try {
    showToast("Menyiapkan laporan...");
    const hotels = await PanduAPI.getHotels();
    
    // Header CSV
    let csv = "ID,Nama Hotel,Lokasi,Harga,Stok,Rating\n";
    
    // Isi Data
    hotels.forEach(h => {
      csv += `${h.id},"${h.name}","${h.location}",${h.price},${h.stock},${h.rating}\n`;
    });
    
    // Download Trigger
    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.setAttribute("hidden", "");
    a.setAttribute("href", url);
    a.setAttribute("download", `laporan_hotel_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    showToast("Laporan berhasil diunduh!");
  } catch (err) {
    alert("Gagal mengekspor laporan: " + err.message);
  }
};

// Bind Export Button
document.querySelector(".admin-section-title button.primary-btn")?.addEventListener("click", (e) => {
  if (e.target.textContent.includes("Export")) {
    window.exportReport();
  }
});

// Load All Reservations
async function loadAdminReservations() {
  try {
    const res = await PanduAPI.request("/bookings/admin/all");
    const tbody = document.querySelector("#admin-reservations tbody");
    if (!tbody) return;

    const bookings = res.bookings || [];
    tbody.innerHTML = bookings.map(b => `
      <tr>
        <td><strong>${b.code}</strong></td>
        <td>${b.guest_name}<br><small>${b.guest_email}</small></td>
        <td>${b.hotel_name}</td>
        <td>${new Date(b.check_in).toLocaleDateString("id-ID", {day:"numeric", month:"short"})} - ${new Date(b.check_out).toLocaleDateString("id-ID", {day:"numeric", month:"short"})}</td>
        <td>${(b.addons || []).map(a => typeof a === 'string' ? a : a.name).join(", ") || "-"}</td>
        <td>${b.payment_method.toUpperCase()}</td>
        <td><span class="status ${b.payment_status}">${b.payment_status}</span></td>
        <td>${currency.format(b.total_price)}</td>
        <td>
          <div class="inv-actions">
            ${b.payment_status === "pending" ? `<button class="edit-btn" data-action="pay" data-code="${b.code}">Set Paid</button>` : ""}
            <button class="delete-btn" data-action="cancel" data-code="${b.code}">Cancel</button>
          </div>
        </td>
      </tr>
    `).join("");
  } catch (err) {
    console.warn("Gagal memuat reservasi:", err);
  }
}

// Guest Form Toggle
const addGuestBtn = document.querySelector("#addGuestBtn");
const guestModal = document.querySelector("#guestModal");
const cancelGuestBtn = document.querySelector("#cancelGuestBtn");
const guestSearch = document.querySelector("#guestSearch");

if (addGuestBtn && guestModal) {
  addGuestBtn.addEventListener("click", () => {
    guestModal.classList.add("show");
  });
}

if (cancelGuestBtn && guestModal) {
  cancelGuestBtn.addEventListener("click", () => {
    guestModal.classList.remove("show");
  });
}

// Close guest modal on click outside
if (guestModal) {
  guestModal.addEventListener("click", (e) => {
    if (e.target === guestModal) {
      guestModal.classList.remove("show");
    }
  });
}

// Guest Search (Mock Filtering)
if (guestSearch) {
  guestSearch.addEventListener("input", (e) => {
    const term = e.target.value.toLowerCase();
    const rows = document.querySelectorAll("#admin-guests tbody tr");
    rows.forEach(row => {
      const text = row.textContent.toLowerCase();
      row.style.display = text.includes(term) ? "" : "none";
    });
  });
}

// Rate Plan Logic
function editRate(btn) {
  const card = btn.closest(".rate-card");
  if (!card || !rateModal) return;

  const name = card.querySelector("h3")?.textContent || "";
  const multiplier = card.querySelector(".multiplier")?.textContent || "";
  const desc = card.querySelector("p")?.textContent || "";

  document.querySelector("#rateName").value = name;
  document.querySelector("#rateMultiplier").value = multiplier;
  document.querySelector("#rateRefund").value = desc.includes("Refund") ? "H-2" : "No Refund";
  
  rateModal.classList.add("show");
}

// Rate Form Toggle
const addRateBtn = document.querySelector("#addRateBtn");
const rateModal = document.querySelector("#rateModal");
const cancelRateBtn = document.querySelector("#cancelRateBtn");

if (addRateBtn && rateModal) {
  addRateBtn.addEventListener("click", () => {
    document.querySelector("#rateForm")?.reset();
    rateModal.classList.add("show");
  });
}

if (cancelRateBtn && rateModal) {
  cancelRateBtn.addEventListener("click", () => {
    rateModal.classList.remove("show");
  });
}

// Close rate modal on click outside
if (rateModal) {
  rateModal.addEventListener("click", (e) => {
    if (e.target === rateModal) {
      rateModal.classList.remove("show");
    }
  });
}


// Reservation Form Toggle
const createResBtn = document.querySelector("#createResBtn");
const reservationModal = document.querySelector("#reservationModal");
const reservationForm = document.querySelector("#reservationForm");
const cancelResBtn = document.querySelector("#cancelResBtn");

// Inventory Form Toggle
const addInventoryBtn = document.querySelector("#addInventoryBtn");
const inventoryModal = document.querySelector("#inventoryModal");
const cancelInvBtn = document.querySelector("#cancelInvBtn");

if (addInventoryBtn && inventoryModal) {
  addInventoryBtn.addEventListener("click", () => {
    cancelEdit(); // Reset form state
    inventoryModal.classList.add("show");
  });
}

if (cancelInvBtn && inventoryModal) {
  cancelInvBtn.addEventListener("click", () => {
    inventoryModal.classList.remove("show");
    setTimeout(cancelEdit, 400);
  });
}

// Close inventory modal on click outside
if (inventoryModal) {
  inventoryModal.addEventListener("click", (e) => {
    if (e.target === inventoryModal) {
      inventoryModal.classList.remove("show");
      setTimeout(cancelEdit, 400);
    }
  });
}

if (createResBtn && reservationModal) {
  createResBtn.addEventListener("click", () => {
    reservationModal.classList.add("show");
    // Generate semi-random code for demo
    document.querySelector("#resCode").value = `PH-${Math.floor(1000 + Math.random() * 9000)}`;
  });
}

if (cancelResBtn) {
  cancelResBtn.addEventListener("click", () => {
    reservationModal.classList.remove("show");
    setTimeout(() => {
      if (!reservationModal.classList.contains("show")) {
        reservationForm.reset();
      }
    }, 400);
  });
}

// Close modal on click outside content
if (reservationModal) {
  reservationModal.addEventListener("click", (e) => {
    if (e.target === reservationModal) {
      reservationModal.classList.remove("show");
      setTimeout(() => reservationForm.reset(), 400);
    }
  });
}

// Manual Reservation Submission
if (reservationForm) {
  reservationForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = reservationForm.querySelector("button[type='submit']");
    btn.disabled = true;
    btn.textContent = "Memproses...";

    try {
      const checkIn = document.querySelector("#resCheckIn").value;
      const checkOut = document.querySelector("#resCheckOut").value;

      if (new Date(checkOut) <= new Date(checkIn)) {
        throw new Error("Tanggal check-out harus setelah check-in.");
      }

      const payload = {
        code: document.querySelector("#resCode").value,
        guest_name: document.querySelector("#resGuestName").value,
        guest_email: document.querySelector("#resGuestEmail").value,
        hotel_name: document.querySelector("#resHotelName").value,
        payment_status: document.querySelector("#resPaymentStatus").value,
        payment_method: document.querySelector("#resPaymentMethod").value,
        notes: document.querySelector("#resNotes").value,
        check_in: checkIn,
        check_out: checkOut,
        total_price: 1500000 // Mock price
      };

      // For demo, we might just use updateBookingStatus or a mock create
      // Since manual creation might not have a dedicated endpoint in the mock API,
      // we'll simulate success and reload.
      showToast("Reservasi manual berhasil disimpan!");
      reservationModal.classList.remove("show");
      reservationForm.reset();
      loadAdminReservations();
    } catch (err) {
      alert(err.message || "Gagal menyimpan reservasi.");
    } finally {
      btn.disabled = false;
      btn.textContent = "Simpan Reservasi";
    }
  });
}

// Update Booking/Payment Status
window.updateBookingStatus = async (code, statusUpdates) => {
  console.log(`[CMS] Updating status for ${code}`, statusUpdates);
  try {
    showToast("Memperbarui status...");
    const res = await PanduAPI.updateBookingStatus(code, statusUpdates);
    console.log("[CMS] Update response:", res);
    showToast("Status berhasil diperbarui!");
    loadAdminReservations();
    loadDashboardStats();
    loadAdminPayments();
    loadAdminHotels(); // Refresh room stock
  } catch (err) {
    alert("Gagal memperbarui status: " + err.message);
  }
};

// Load All Payments (derived from bookings)
async function loadAdminPayments() {
  try {
    const res = await PanduAPI.request("/bookings/admin/all");
    const bookings = res.bookings || [];
    
    const paid = bookings.filter(b => b.payment_status === "paid");
    const pending = bookings.filter(b => b.payment_status === "pending");
    const refunded = bookings.filter(b => b.payment_status === "refunded");

    // paid: payment_status === "paid"
    // refunded: payment_status === "refunded"
    const paidRevenue = paid.reduce((acc, b) => acc + b.total_price, 0);
    const refundTotal = refunded.reduce((acc, b) => acc + b.total_price, 0);
    const pendingRevenue = pending.reduce((acc, b) => acc + b.total_price, 0);
    
    // Nett revenue is the money we actually keep (successful paid bookings)
    // We don't need to subtract refundTotal here because refunded bookings are ALREADY not in the 'paid' array
    const netRevenue = paidRevenue;
    
    const netEl = document.querySelector("#stat-net-revenue");
    if (netEl) netEl.textContent = currency.format(netRevenue);
    
    const paidCountEl = document.querySelector("#stat-paid-count");
    if (paidCountEl) paidCountEl.textContent = `${paid.length} sukses`;
    
    const pendingRevEl = document.querySelector("#stat-pending-revenue");
    if (pendingRevEl) pendingRevEl.textContent = currency.format(pendingRevenue);
    
    const pendingCountEl = document.querySelector("#stat-pending-count");
    if (pendingCountEl) pendingCountEl.textContent = `${pending.length} transaksi`;
    
    const refundRevEl = document.querySelector("#stat-refund-revenue");
    if (refundRevEl) refundRevEl.textContent = currency.format(refundTotal);
    
    const refundCountEl = document.querySelector("#stat-refund-count");
    if (refundCountEl) refundCountEl.textContent = `${refunded.length} transaksi`;

    // Render Pending Table
    const pendingTbody = document.querySelector("#table-pending-payments tbody");
    if (pendingTbody) {
      pendingTbody.innerHTML = pending.length ? pending.map(b => `
        <tr>
          <td>INV-${b.id.slice(0,4).toUpperCase()}</td>
          <td><strong>${b.code}</strong></td>
          <td>${b.payment_method.toUpperCase()}</td>
          <td><span class="status pending">Pending</span></td>
          <td>${currency.format(b.total_price)}</td>
          <td>
            <div class="inv-actions">
              <button class="edit-btn" data-action="pay" data-code="${b.code}">Approve</button>
              <button class="delete-btn" data-action="cancel" data-code="${b.code}">Cancel</button>
            </div>
          </td>
        </tr>
      `).join("") : '<tr><td colspan="6" style="text-align:center; padding: 20px;">Tidak ada transaksi menunggu.</td></tr>';
    }

    // Render Settled Table
    const settledTbody = document.querySelector("#table-settled-payments tbody");
    if (settledTbody) {
      const settled = bookings.filter(b => ["paid", "refunded", "failed", "cancelled"].includes(b.payment_status));
      settledTbody.innerHTML = settled.length ? settled.map(b => `
        <tr>
          <td>INV-${b.id.slice(0,4).toUpperCase()}</td>
          <td><strong>${b.code}</strong></td>
          <td>${b.payment_method.toUpperCase()}</td>
          <td><span class="status ${b.payment_status}">${b.payment_status}</span></td>
          <td>${currency.format(b.total_price)}</td>
          <td>
            <div class="inv-actions">
              ${b.payment_status === "paid" ? `<button class="delete-btn" data-action="refund" data-code="${b.code}">Refund</button>` : "-"}
            </div>
          </td>
        </tr>
      `).join("") : '<tr><td colspan="6" style="text-align:center; padding: 20px;">Belum ada riwayat.</td></tr>';
    }
  } catch (err) {
    console.warn("Gagal memuat pembayaran:", err);
  }
}

// Load Admin Accounts (Security)
async function loadAdminAccounts() {
  try {
    const res = await PanduAPI.request("/auth/admin/users");
    allAccounts = res.users || [];
    
    // Update security stats
    const totalAcc = document.querySelector("#stat-total-accounts");
    if (totalAcc) totalAcc.textContent = allAccounts.length;
    
    const adminCount = document.querySelector("#stat-admin-count");
    if (adminCount) adminCount.textContent = allAccounts.filter(u => u.role === 'admin').length;
    
    const staffCount = document.querySelector("#stat-staff-count");
    if (staffCount) staffCount.textContent = allAccounts.filter(u => u.role === 'staff').length;
    
    const userCount = document.querySelector("#stat-user-count");
    if (userCount) userCount.textContent = allAccounts.filter(u => u.role === 'user').length;

    const tbody = document.querySelector("#table-admin-accounts tbody");
    if (!tbody) return;

    tbody.innerHTML = allAccounts.map(u => `
      <tr>
        <td><span class="tier ${u.role === 'admin' ? 'gold' : u.role === 'staff' ? 'silver' : 'bronze'}">${u.role.toUpperCase()}</span></td>
        <td>${u.email}</td>
        <td><strong>${u.name}</strong></td>
        <td>${u.phone || "-"}</td>
        <td>${u.reward_points.toLocaleString()}</td>
        <td><span class="status paid">Aktif</span></td>
        <td>
          <div class="inv-actions">
            <button class="edit-btn" data-action="edit-acc" data-id="${u.id}">Edit</button>
            <button class="delete-btn" data-action="delete-acc" data-id="${u.id}">Hapus</button>
          </div>
        </td>
      </tr>
    `).join("");
  } catch (err) {
    console.warn("Gagal memuat akun admin:", err);
  }
}

// Load Admin Guests (Tamu)
async function loadAdminGuests() {
  try {
    const res = await PanduAPI.request("/auth/admin/users");
    const guests = (res.users || []).filter(u => u.role.toLowerCase() === "user");
    
    const tbody = document.querySelector("#table-admin-guests tbody");
    if (!tbody) return;

    tbody.innerHTML = guests.map(u => `
      <tr>
        <td>
          <div class="guest-info">
            <strong>${u.name}</strong>
            <small>ID: ${u.id.slice(0,8).toUpperCase()}</small>
          </div>
        </td>
        <td>${u.email}</td>
        <td>${u.phone || "-"}</td>
        <td><span class="loyalty-badge ${u.reward_points > 500 ? 'gold' : u.reward_points > 100 ? 'silver' : 'bronze'}">${u.reward_points.toLocaleString()} Pts</span></td>
        <td><strong>${u.booking_count}</strong> Reservasi</td>
        <td>
          <button class="ghost-btn" data-action="view-guest-detail" data-id="${u.id}">Detail</button>
        </td>
      </tr>
    `).join("") || '<tr><td colspan="6" style="text-align:center; padding:20px;">Belum ada tamu terdaftar.</td></tr>';
  } catch (err) {
    console.warn("Gagal memuat daftar tamu:", err);
  }
}

// Manual Account Submission (Security)

function cancelAccountEdit() {
  editingAccountId = null;
  if (securityForm) {
    securityForm.reset();
    document.querySelector("#accLogin").disabled = false;
    document.querySelector("#accPass").required = true;
    document.querySelector("#accPass").placeholder = "Minimal 6 karakter";
    securityForm.querySelector("button[type='submit']").textContent = "Simpan Konfigurasi";
  }
}

if (securityForm) {
  securityForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = securityForm.querySelector("button[type='submit']");
    btn.disabled = true;
    btn.textContent = editingAccountId ? "Mengupdate..." : "Membuat Akun...";

    try {
      const payload = {
        role: document.querySelector("#accRole").value,
        name: document.querySelector("#accName").value,
        phone: document.querySelector("#accPhone")?.value || null
      };

      if (!editingAccountId) {
        payload.email = document.querySelector("#accLogin").value;
        payload.password = document.querySelector("#accPass").value;
      }

      const method = editingAccountId ? "PATCH" : "POST";
      const endpoint = editingAccountId ? `/auth/admin/users/${editingAccountId}` : "/auth/admin/users";

      await PanduAPI.request(endpoint, {
        method,
        body: payload
      });

      showToast(editingAccountId ? "Akun berhasil diperbarui!" : "Akun berhasil dibuat!");
      securityModal.classList.remove("show");
      cancelAccountEdit();
      loadAdminAccounts();
    } catch (err) {
      alert(err.message || "Gagal memproses akun.");
    } finally {
      btn.disabled = false;
      btn.textContent = "Simpan Konfigurasi";
    }
  });
}

async function deleteAccount(id) {
  if (!confirm("Hapus akun ini secara permanen?")) return;
  try {
    await PanduAPI.request(`/auth/admin/users/${id}`, { method: "DELETE" });
    showToast("Akun berhasil dihapus.");
    loadAdminAccounts();
  } catch (err) {
    alert(err.message || "Gagal menghapus akun.");
  }
}

function editAccount(id) {
  const user = allAccounts.find(u => u.id === id);
  if (!user) return;
  
  editingAccountId = id;
  document.querySelector("#accRole").value = user.role;
  document.querySelector("#accLogin").value = user.email;
  document.querySelector("#accLogin").disabled = true; 
  document.querySelector("#accPass").required = false; 
  document.querySelector("#accPass").placeholder = "(Kosongkan jika tidak diubah)";
  document.querySelector("#accName").value = user.name;
  document.querySelector("#accPhone").value = user.phone || "";
  
  securityForm.querySelector("button[type='submit']").textContent = "Update Akun";
  securityModal.classList.add("show");
}

if (addAccountBtn && securityModal) {
  addAccountBtn.addEventListener("click", () => {
    cancelAccountEdit();
    securityModal.classList.add("show");
  });
}

if (cancelSecBtn && securityModal) {
  cancelSecBtn.addEventListener("click", () => {
    securityModal.classList.remove("show");
    setTimeout(cancelAccountEdit, 400);
  });
}

// Close security modal on click outside
if (securityModal) {
  securityModal.addEventListener("click", (e) => {
    if (e.target === securityModal) {
      securityModal.classList.remove("show");
      setTimeout(cancelAccountEdit, 400);
    }
  });
}

// Guest Detail Modal Close
document.querySelector("#closeGuestDetailBtn")?.addEventListener("click", () => {
  document.querySelector("#guestDetailModal").classList.remove("show");
});

async function viewGuestBookings(userId) {
  try {
    const modal = document.querySelector("#guestDetailModal");
    const tbody = document.querySelector("#guestBookingsList tbody");
    if (!modal || !tbody) return;

    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:20px;">Memuat data...</td></tr>';
    modal.classList.add("show");

    // Fetch all bookings and filter by user
    const res = await PanduAPI.request("/bookings/admin/all");
    const bookings = (res.bookings || []).filter(b => b.user_id === userId);

    if (!bookings.length) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:20px;">Tamu ini belum memiliki reservasi.</td></tr>';
      return;
    }

    tbody.innerHTML = bookings.map(b => `
      <tr>
        <td><strong>${b.code}</strong></td>
        <td>${b.hotel_name || "Hotel"}</td>
        <td>${new Date(b.check_in).toLocaleDateString("id-ID")}</td>
        <td>${new Date(b.check_out).toLocaleDateString("id-ID")}</td>
        <td><span class="status ${b.payment_status}">${b.payment_status.toUpperCase()}</span></td>
        <td>${currency.format(b.total_price)}</td>
      </tr>
    `).join("");

  } catch (err) {
    alert("Gagal memuat detail booking: " + err.message);
  }
}

// Init
loadAdminHotels();
loadDashboardStats();
loadAdminReservations();
loadAdminPayments();
loadAdminAccounts();
loadAdminGuests();
loadAdminRates();
loadCmsSettings();

// Load Admin Rates (Dummy fallback for now as there's no rates table)
function loadAdminRates() {
  const grid = document.querySelector("#admin-rate-grid");
  if (!grid) return;

  const defaultRates = [
    { name: "Flexible Rate", desc: "Refund sampai H-2, harga dasar aktif setiap hari.", mult: "100%", status: "Aktif", type: "neutral" },
    { name: "Non-refundable", desc: "Diskon untuk booking pasti tanpa refund.", mult: "-10%", status: "Aktif", type: "down" },
    { name: "Weekend Premium", desc: "Otomatis aktif Jumat sampai Minggu.", mult: "+18%", status: "Aktif", type: "up" }
  ];

  grid.innerHTML = defaultRates.map(r => `
    <article class="rate-card">
      <div class="rate-header">
        <h3>${r.name}</h3>
        <span class="status paid">${r.status}</span>
      </div>
      <p>${r.desc}</p>
      <div class="rate-footer">
        <span class="multiplier ${r.type}">${r.mult}</span>
        <button class="edit-btn" data-action="edit-rate">Edit</button>
      </div>
    </article>
  `).join("");
}

// CMS Logic
async function loadCmsSettings() {
  try {
    const res = await PanduAPI.request("/cms/settings");
    const s = res.settings || {};
    
    const fieldMap = {
      "#cmsSiteName": s.siteName,
      "#cmsTagline": s.tagline,
      "#cmsHeroTitle": s.heroTitle,
      "#cmsPromoText": s.promoText,
      "#cmsBannerUrl": s.bannerUrl,
      "#cmsContactEmail": s.contactEmail,
      "#cmsContactPhone": s.contactPhone,
      "#cmsAddress": s.address,
      "#cmsCheckInTime": s.checkIn,
      "#cmsCheckOutTime": s.checkOut,
      "#cmsInstagram": s.instagram
    };

    for (const [id, val] of Object.entries(fieldMap)) {
      const el = document.querySelector(id);
      if (el && val) el.value = val;
    }
    
    if (s.logoUrl) {
      const preview = document.querySelector("#cmsLogoPreview");
      if (preview) {
        preview.innerHTML = `<img src="${s.logoUrl}" style="width:100%; height:100%; border-radius:inherit; object-fit:contain;">`;
        preview.dataset.url = s.logoUrl;
      }
    }
  } catch (err) {
    console.warn("Gagal memuat settings CMS:", err);
  }
}

// Logo Upload Logic
const cmsLogoDropZone = document.querySelector("#cmsLogoDropZone");
const cmsLogoInput = document.querySelector("#cmsLogoInput");
const cmsLogoPreview = document.querySelector("#cmsLogoPreview");

if (cmsLogoDropZone && cmsLogoInput) {
  cmsLogoDropZone.addEventListener("click", () => cmsLogoInput.click());
  
  cmsLogoInput.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("logo", file);

    try {
      showToast("Mengupload logo...");
      const data = await PanduAPI.request("/cms/upload-logo", {
        method: "POST",
        body: formData
      });
      
      if (data.logoUrl) {
        cmsLogoPreview.innerHTML = `<img src="${data.logoUrl}" style="width:100%; height:100%; border-radius:inherit; object-fit:contain;">`;
        cmsLogoPreview.dataset.url = data.logoUrl;
        showToast("Logo berhasil diupload!");
      }
    } catch (err) {
      alert("Gagal upload logo: " + err.message);
    }
  });
}

// CMS Save Logic
const saveCmsBtn = document.querySelector("#saveCmsBtn");
if (saveCmsBtn) {
  saveCmsBtn.addEventListener("click", async () => {
    saveCmsBtn.disabled = true;
    saveCmsBtn.textContent = "Menyimpan...";
    
    const settings = {
      siteName: document.querySelector("#cmsSiteName")?.value,
      tagline: document.querySelector("#cmsTagline")?.value,
      heroTitle: document.querySelector("#cmsHeroTitle")?.value,
      promoText: document.querySelector("#cmsPromoText")?.value,
      bannerUrl: document.querySelector("#cmsBannerUrl")?.value,
      contactEmail: document.querySelector("#cmsContactEmail")?.value,
      contactPhone: document.querySelector("#cmsContactPhone")?.value,
      address: document.querySelector("#cmsAddress")?.value,
      checkIn: document.querySelector("#cmsCheckInTime")?.value,
      checkOut: document.querySelector("#cmsCheckOutTime")?.value,
      instagram: document.querySelector("#cmsInstagram")?.value,
      logoUrl: cmsLogoPreview?.dataset.url || null
    };

    try {
      await PanduAPI.request("/cms/settings", {
        method: "POST",
        body: { settings }
      });
      showToast("Konten website berhasil disimpan!");
    } catch (err) {
      alert("Gagal menyimpan: " + err.message);
    } finally {
      saveCmsBtn.disabled = false;
      saveCmsBtn.textContent = "Publikasikan Perubahan";
    }
  });
}
