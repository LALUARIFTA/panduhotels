if (!PanduAPI.isLoggedIn()) { window.location.href = "login.html"; }

const staffTabs = document.querySelectorAll(".staff-tab");
const staffViews = document.querySelectorAll(".staff-view");
const toast = document.querySelector("#toast");
const panelNavToggle = document.querySelector(".panel-nav-toggle");
const staffNav = document.querySelector(".staff-nav");

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  window.setTimeout(() => toast.classList.remove("show"), 2600);
}

// Navigasi Tab
staffTabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    staffTabs.forEach((item) => item.classList.remove("active"));
    staffViews.forEach((view) => view.classList.remove("active"));
    tab.classList.add("active");
    document.querySelector(`#staff-${tab.dataset.staff}`).classList.add("active");
    if (staffNav) staffNav.classList.remove("open");
    if (panelNavToggle) panelNavToggle.setAttribute("aria-expanded", "false");
  });
});

// Aksi Real-time (Check-in / Tagih)
document.addEventListener("click", async (e) => {
  const btn = e.target.closest(".staff-action");
  if (!btn) return;

  const row = btn.closest("article") || btn.closest("tr");
  const code = row.querySelector("strong")?.textContent;

  if (!code) return;

  btn.disabled = true;
  btn.textContent = "Processing...";

  try {
    let statusData = {};
    if (btn.textContent.includes("Check-in")) {
      statusData = { booking_status: "checked_in" };
    } else if (btn.textContent.includes("Tagih")) {
      statusData = { payment_status: "pending" };
    }

    await PanduAPI.updateBookingStatus(code, statusData);
    showToast(`Booking ${code} berhasil diperbarui.`);
    location.reload(); // Refresh untuk melihat perubahan status
  } catch (err) {
    showToast(err.message || "Gagal memproses aksi.");
    btn.disabled = false;
    btn.textContent = "Coba Lagi";
  }
});

// Logout
document.querySelector("#logoutButton")?.addEventListener("click", async () => {
  await PanduAPI.logout();
  window.location.href = "index.html";
});

// Mobile nav
panelNavToggle?.addEventListener("click", () => {
  const isOpen = staffNav.classList.toggle("open");
  panelNavToggle.setAttribute("aria-expanded", String(isOpen));
});
