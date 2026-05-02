// ══════════════════════════════════════════
// PanduHotel — Homepage (index.html)
// Fetches hotels from backend API with
// localStorage fallback for offline mode.
// ══════════════════════════════════════════

const defaultHotels = [
  {
    name: "Pandu Grand Jakarta",
    location: "jakarta",
    area: "Sudirman, Jakarta",
    rating: 4.8,
    price: 1180000,
    tags: ["wifi", "breakfast", "airport"],
    image_url: "https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?auto=format&fit=crop&w=900&q=82",
    description: "Hotel bisnis premium dekat pusat perkantoran dengan check-in cepat dan lounge eksekutif."
  },
  {
    name: "Pandu Ocean Resort",
    location: "bali",
    area: "Nusa Dua, Bali",
    rating: 4.9,
    price: 1960000,
    tags: ["wifi", "pool", "breakfast"],
    image_url: "https://images.unsplash.com/photo-1540541338287-41700207dee6?auto=format&fit=crop&w=900&q=82",
    description: "Resort tepi pantai dengan kolam luas, spa, dan paket honeymoon fleksibel."
  },
  {
    name: "Pandu Hills Bandung",
    location: "bandung",
    area: "Dago Pakar, Bandung",
    rating: 4.7,
    price: 1420000,
    tags: ["wifi", "pool", "airport"],
    image_url: "https://images.unsplash.com/photo-1578683010236-d716f9a3f461?auto=format&fit=crop&w=900&q=82",
    description: "Penginapan sejuk untuk keluarga dengan kamar luas dan akses cepat ke wisata kuliner."
  }
];

const currency = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0
});

const hotelGrid = document.querySelector("#hotelGrid");
const filterButtons = document.querySelectorAll(".filter-chip");
const searchForm = document.querySelector("#searchForm");
const navToggle = document.querySelector(".nav-toggle");
const siteNav = document.querySelector(".site-nav");
const toast = document.querySelector("#toast");

let hotels = [...defaultHotels];
let activeFilter = "all";
let activeLocation = "all";
let activeCapacity = "all";

// Fetch hotels from API, fallback to defaults
async function loadHotels() {
  try {
    const apiHotels = await PanduAPI.getHotels();
    if (apiHotels && apiHotels.length > 0) {
      hotels = apiHotels;
    }
  } catch (err) {
    console.warn("API tidak tersedia, menggunakan data default:", err.message);
  }
  renderHotels();
  updateLocationDropdown();
  updateCapacityFilters();
}

function updateCapacityFilters() {
  const container = document.querySelector("#capacity-filter-container");
  if (!container) return;

  // Extract unique capacity numbers from potentially comma-separated strings
  const allCaps = hotels.flatMap(h => (h.capacity || "").split(", ").map(c => parseInt(c) || 0));
  const uniqueCapacities = [...new Set(allCaps)]
    .filter(c => c > 0)
    .sort((a, b) => a - b);

  container.innerHTML = `
    <button class="filter-chip ${activeCapacity === 'all' ? 'active' : ''}" data-capacity="all" type="button">Kapasitas: Semua</button>
    ${uniqueCapacities.map(c => `
      <button class="filter-chip ${activeCapacity === String(c) ? 'active' : ''}" data-capacity="${c}" type="button">${c} Tamu</button>
    `).join("")}
  `;
}

function updateLocationDropdown() {
  const select = document.querySelector("#location");
  if (!select) return;

  const uniqueLocations = [...new Set(hotels.map(h => h.location.toLowerCase()))];
  const currentVal = select.value;
  
  select.innerHTML = '<option value="all">Semua lokasi</option>' + 
    uniqueLocations.map(loc => {
      const label = loc.charAt(0).toUpperCase() + loc.slice(1);
      return `<option value="${loc}">${label}</option>`;
    }).join("");
  
  if (uniqueLocations.includes(currentVal)) select.value = currentVal;
}

function renderHotels() {
  const filtered = hotels.filter((hotel) => {
    const matchesLocation = activeLocation === "all" || hotel.location === activeLocation;
    const matchesFilter = activeFilter === "all" || (hotel.tags && hotel.tags.includes(activeFilter));
    
    // Check if any of the room's capacities match the active filter
    const roomCaps = (hotel.capacity || "").split(", ").map(c => parseInt(c) || 0);
    const matchesCapacity = activeCapacity === "all" || roomCaps.includes(parseInt(activeCapacity));

    return matchesLocation && matchesFilter && matchesCapacity;
  });

  // Group by name to avoid many cards for the same hotel
  const grouped = filtered.reduce((acc, h) => {
    const key = h.name.trim();
    if (!acc[key]) acc[key] = { ...h, variations: [] };
    acc[key].variations.push(h);
    return acc;
  }, {});

  const hotelList = Object.values(grouped);

  hotelGrid.innerHTML = hotelList.map((hotel) => {
    const reviews = hotel.review_count || 0;
    const isPopular = hotel.rating >= 4.8;
    const badge = isPopular ? "Terpopuler" : (hotel.stock <= 3 ? "Sisa Sedikit" : null);
    const imageUrl = hotel.image_url || "https://images.unsplash.com/photo-1566073771259-6a8506099945";
    
    // Sort variations by price
    hotel.variations.sort((a, b) => a.price - b.price);
    const cheapest = hotel.variations[0];
    const capacities = [...new Set(hotel.variations.map(v => v.capacity))].join(", ");

    return `
      <article class="hotel-card" data-hotel-id="${cheapest.id}">
        ${badge ? `<div class="hotel-badge">${badge}</div>` : ""}
        <div class="hotel-image">
          <img src="${imageUrl}" alt="${hotel.name}" loading="lazy">
          <div class="image-overlay"></div>
        </div>
        <div class="hotel-body">
          <div class="hotel-top-row">
            <div class="hotel-rating">
              <span class="star-icon">★</span>
              <span class="rating-value">${hotel.rating}</span>
              <span class="review-count">(${reviews} ulasan)</span>
            </div>
            <div class="hotel-location">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
              <span>${hotel.area || hotel.location}</span>
            </div>
          </div>
          <h3 class="hotel-title">${hotel.name}</h3>
          <p class="hotel-desc">${hotel.description || "Hotel berkualitas dari Pandu Hotel Group."}</p>
          <div class="hotel-tags">
            <span class="tag-chip"><span class="tag-dot" style="background: #0ea5e9"></span>Kapasitas: ${capacities}</span>
            ${(hotel.tags || []).map((tag) => `
              <span class="tag-chip">
                <span class="tag-dot"></span>
                ${formatTag(tag)}
              </span>
            `).join("")}
          </div>
          <div class="hotel-footer">
            <div class="price-box">
              <span class="price-label">${hotel.variations.length > 1 ? 'Mulai dari' : 'Harga'}</span>
              <div class="price-amount">
                <strong>${currency.format(cheapest.price)}</strong>
                <small>/malam</small>
              </div>
            </div>
            <button class="primary-btn choose-hotel"
              data-id="${cheapest.id}"
              data-name="${cheapest.name}"
              data-price="${cheapest.price}"
              type="button">
              Pesan Sekarang
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
            </button>
          </div>
        </div>
      </article>
    `;
  }).join("");

  if (!hotelList.length) {
    hotelGrid.innerHTML = `<div class="no-results"><p>Tidak ada hotel yang cocok dengan pencarian Anda.</p></div>`;
  }
}

// Handle selection
hotelGrid.addEventListener("click", (e) => {
  const btn = e.target.closest(".choose-hotel");
  if (!btn) return;

  const hotelId = btn.dataset.id;
  const hotel = hotels.find((h) => h.id === hotelId);

  // Save selection
  localStorage.setItem("selectedHotel", JSON.stringify(hotel));
  localStorage.setItem("checkIn", document.querySelector("#checkIn").value);
  localStorage.setItem("checkOut", document.querySelector("#checkOut").value);

  if (typeof PanduAPI !== 'undefined' && PanduAPI.isLoggedIn()) {
    window.location.href = "booking.html";
  } else {
    window.location.href = "login.html";
  }
});

function formatTag(tag) {
  const labels = {
    wifi: "Wi-Fi",
    pool: "Kolam",
    breakfast: "Sarapan",
    airport: "Airport"
  };
  return labels[tag] || tag;
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  window.setTimeout(() => toast.classList.remove("show"), 3200);
}

// Add capacity filter listeners
document.addEventListener("click", (e) => {
  const filterBtn = e.target.closest(".filter-chip");
  if (!filterBtn) return;

  const container = filterBtn.parentElement;
  
  if (container.getAttribute("aria-label") === "Filter fasilitas") {
    container.querySelectorAll(".filter-chip").forEach(b => b.classList.remove("active"));
    filterBtn.classList.add("active");
    activeFilter = filterBtn.dataset.filter;
    renderHotels();
  }
  
  if (container.getAttribute("aria-label") === "Filter kapasitas") {
    container.querySelectorAll(".filter-chip").forEach(b => b.classList.remove("active"));
    filterBtn.classList.add("active");
    activeCapacity = filterBtn.dataset.capacity;
    renderHotels();
  }
});

searchForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const checkIn = document.querySelector("#checkIn").value;
  const checkOut = document.querySelector("#checkOut").value;
  activeLocation = document.querySelector("#location").value;

  if (checkIn && checkOut && checkOut <= checkIn) {
    showToast("Tanggal check-out harus setelah check-in.");
    return;
  }

  renderHotels();
  document.querySelector("#hotel").scrollIntoView({ behavior: "smooth" });
  showToast("Ketersediaan diperbarui secara real-time.");
});



navToggle.addEventListener("click", () => {
  const isOpen = siteNav.classList.toggle("open");
  navToggle.setAttribute("aria-expanded", String(isOpen));
});

siteNav.addEventListener("click", () => {
  siteNav.classList.remove("open");
  navToggle.setAttribute("aria-expanded", "false");
});

// Initialize dates
const today = new Date();
const tomorrow = new Date(today);
tomorrow.setDate(today.getDate() + 1);
const nextDay = new Date(today);
nextDay.setDate(today.getDate() + 2);

document.querySelector("#checkIn").valueAsDate = tomorrow;
document.querySelector("#checkOut").valueAsDate = nextDay;

// Load hotels from API
loadHotels();
