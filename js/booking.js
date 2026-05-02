if (!PanduAPI.isLoggedIn()) { window.location.href = "login.html"; }

const currency = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });
const steps = document.querySelectorAll(".booking-step");
const progressDots = document.querySelectorAll(".progress-dot");
const stepLabel = document.querySelector(".step-label");
const toast = document.querySelector("#toast");
const user = PanduAPI.getUser();
let currentStep = 1;
let selectedHotel = JSON.parse(localStorage.getItem("selectedHotel") || '{"name":"Pandu Grand Jakarta","price":1180000}');

let allHotels = [];

// Sync dynamic data
async function loadBookingHotels() {
  try {
    allHotels = await PanduAPI.getHotels();
    if (!allHotels.length) return;

    updateLocationDropdown(allHotels);
    
    // Initial sync based on selected hotel or first available
    const locSelect = document.querySelector("#userLocation");
    if (locSelect) {
      const stored = JSON.parse(localStorage.getItem("selectedHotel"));
      const initialLoc = stored?.location || allHotels[0].location;
      locSelect.value = initialLoc.toLowerCase();
    }

    syncRoomSelection();
  } catch (err) {
    console.warn("Gagal memuat hotel:", err);
  }
}

function updateLocationDropdown(hotels) {
  const select = document.querySelector("#userLocation");
  if (!select) return;

  const uniqueLocations = [...new Set(hotels.map(h => h.location.toLowerCase()))];
  select.innerHTML = uniqueLocations.map(loc => {
    const label = loc.charAt(0).toUpperCase() + loc.slice(1);
    return `<option value="${loc}">${label}</option>`;
  }).join("");
}

function syncRoomSelection() {
  const location = document.querySelector("#userLocation")?.value;
  const roomSelect = document.querySelector("#roomType");
  const guestSelect = document.querySelector("#userGuests");
  
  if (!roomSelect || !allHotels.length) return;

  const filtered = allHotels.filter(h => !location || h.location.toLowerCase() === location.toLowerCase());
  
  roomSelect.innerHTML = filtered.map(h => `
    <option value="${h.id}" data-price="${h.price}" data-stock="${h.stock}" data-capacity="${h.capacity}" data-tags="${(h.tags||[]).join(', ')}">
      ${h.name} - Rp${h.price.toLocaleString("id-ID")}
    </option>
  `).join("");

  // Update Tamu options based on filtered hotels
  if (guestSelect) {
     const caps = [...new Set(filtered.flatMap(h => (h.capacity || "").split(", ").map(c => parseInt(c) || 0)))].sort((a,b)=>a-b);
     guestSelect.innerHTML = caps.map(c => `<option value="${c}">${c} tamu</option>`).join("");
  }

  // Restore selection if possible
  if (selectedHotel && selectedHotel.id) {
    roomSelect.value = selectedHotel.id;
    if (!roomSelect.value && filtered.length > 0) {
      roomSelect.selectedIndex = 0;
    }
  }

  updateRoomDetails();
  calcSummary();
}

function updateRoomDetails() {
  const select = document.querySelector("#roomType");
  const opt = select?.selectedOptions[0];
  if (!opt) return;

  selectedHotel = { 
    id: opt.value, 
    name: opt.textContent.split(" - ")[0].trim(), 
    price: parseInt(opt.dataset.price) 
  };
  localStorage.setItem("selectedHotel", JSON.stringify(selectedHotel));

  const el = id => document.querySelector(id);
  if (el("#availabilityText")) el("#availabilityText").textContent = `${opt.dataset.stock} kamar tersedia`;
  if (el("#roomCapacity")) el("#roomCapacity").textContent = opt.dataset.capacity || "2 tamu";
  if (el("#roomFacilities")) el("#roomFacilities").textContent = opt.dataset.tags || "-";
}

function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 3200);
}

function setStep(n) {
  currentStep = Math.min(3, Math.max(1, n));
  steps.forEach((s, i) => s.classList.toggle("active", i + 1 === currentStep));
  progressDots.forEach((d, i) => d.classList.toggle("active", i < currentStep));
  if (stepLabel) stepLabel.textContent = `Langkah ${currentStep} dari 3`;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function calcSummary() {
  const ci = new Date(localStorage.getItem("checkIn") || new Date());
  const co = new Date(localStorage.getItem("checkOut") || new Date(Date.now() + 86400000));
  const nights = Math.max(1, Math.ceil((co - ci) / 86400000));
  const base = selectedHotel.price * nights;
  const addons = [...document.querySelectorAll(".addon-item:checked")]
    .reduce((s, el) => s + parseInt(el.dataset.price), 0);
  const sub = base + addons;
  const tax = Math.round(sub * 0.11);
  const total = sub + tax;
  const fmt = d => d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });

  const el = id => document.querySelector(id);
  if (el("#summaryHotelName")) el("#summaryHotelName").textContent = selectedHotel.name;
  if (el("#summaryCheckIn")) el("#summaryCheckIn").textContent = fmt(ci);
  if (el("#summaryCheckOut")) el("#summaryCheckOut").textContent = fmt(co);
  if (el("#summaryNights")) el("#summaryNights").textContent = `${nights} malam`;
  if (el("#priceBase")) el("#priceBase").textContent = currency.format(base);
  if (el("#priceAddons")) el("#priceAddons").textContent = currency.format(addons);
  if (el("#priceTax")) el("#priceTax").textContent = currency.format(tax);
  if (el("#priceTotal")) el("#priceTotal").textContent = currency.format(total);
}

document.querySelectorAll(".next-step").forEach(b => b.addEventListener("click", () => setStep(currentStep + 1)));
document.querySelectorAll(".prev-step").forEach(b => b.addEventListener("click", () => setStep(currentStep - 1)));
document.querySelectorAll(".addon-item, select").forEach(el => el.addEventListener("change", calcSummary));
document.querySelector("#roomType")?.addEventListener("change", updateRoomDetails);
document.querySelector("#userLocation")?.addEventListener("change", syncRoomSelection);

const submitBtn = document.querySelector(".submit-booking");
if (submitBtn) {
  submitBtn.addEventListener("click", async () => {
    submitBtn.disabled = true;
    submitBtn.textContent = "Memproses...";
    try {
      const addons = [...document.querySelectorAll(".addon-item:checked")].map(el => el.dataset.name);
      const data = await PanduAPI.createBooking({
        hotel_id: selectedHotel.id,
        check_in: localStorage.getItem("checkIn"),
        check_out: localStorage.getItem("checkOut"),
        guest_name: document.querySelector("#guestName")?.value || "",
        guest_email: document.querySelector("#guestEmail")?.value || "",
        guest_phone: document.querySelector("#guestPhone")?.value || "",
        guest_note: document.querySelector("#guestNote")?.value || "",
        payment_method: document.querySelector("#paymentMethod")?.value || "va",
        addons
      });
      showToast(data.message || "Booking berhasil!");
      setTimeout(() => window.location.href = "user.html", 2000);
    } catch (err) {
      showToast(err.message || "Gagal membuat booking.");
      submitBtn.disabled = false;
      submitBtn.textContent = "Bayar Sekarang";
    }
  });
}

// Logout
document.querySelector("#logoutButton")?.addEventListener("click", async () => {
  await PanduAPI.logout();
  window.location.href = "index.html";
});

// Mobile nav toggle
const panelNavToggle = document.querySelector(".panel-nav-toggle");
const userNav = document.querySelector(".user-nav");
if (panelNavToggle && userNav) {
  panelNavToggle.addEventListener("click", () => {
    const isOpen = userNav.classList.toggle("open");
    panelNavToggle.setAttribute("aria-expanded", String(isOpen));
  });
}

// Prefill user data
if (user) {
  const nameEl = document.querySelector("#guestName");
  const emailEl = document.querySelector("#guestEmail");
  if (nameEl) nameEl.value = user.name || "";
  if (emailEl) emailEl.value = user.email || "";
}

// Set default dates for check-in/out fields
const today = new Date();
const tomorrow = new Date(today);
tomorrow.setDate(today.getDate() + 1);
const nextDay = new Date(today);
nextDay.setDate(today.getDate() + 2);

const ciField = document.querySelector("#userCheckIn");
const coField = document.querySelector("#userCheckOut");
if (ciField) ciField.value = localStorage.getItem("checkIn") || tomorrow.toISOString().split("T")[0];
if (coField) coField.value = localStorage.getItem("checkOut") || nextDay.toISOString().split("T")[0];

ciField?.addEventListener("change", (e) => { localStorage.setItem("checkIn", e.target.value); calcSummary(); });
coField?.addEventListener("change", (e) => { localStorage.setItem("checkOut", e.target.value); calcSummary(); });

loadBookingHotels();
calcSummary();
