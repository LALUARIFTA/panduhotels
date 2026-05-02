const loginForm = document.querySelector("#loginForm");
const toast = document.querySelector("#toast");

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  window.setTimeout(() => toast.classList.remove("show"), 3200);
}

// Redirect if already logged in
if (PanduAPI.isLoggedIn()) {
  const user = PanduAPI.getUser();
  if (user?.role === "admin") {
    window.location.href = "admin.html";
  } else if (user?.role === "staff") {
    window.location.href = "receptionist.html";
  } else {
    window.location.href = "user.html";
  }
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const email = document.querySelector("#loginEmail").value.trim();
  const password = document.querySelector("#loginPassword").value.trim();

  if (!email || password.length < 6) {
    showToast("Isi email dan password minimal 6 karakter.");
    return;
  }

  const submitBtn = loginForm.querySelector("button[type='submit']");
  submitBtn.disabled = true;
  submitBtn.textContent = "Memproses...";

  try {
    const data = await PanduAPI.login({ email, password });

    if (data?.user) {
      showToast(`Selamat datang, ${data.user.name || email}!`);
      setTimeout(() => {
        if (data.user.role === "admin") {
          window.location.href = "admin.html";
        } else if (data.user.role === "staff") {
          window.location.href = "receptionist.html";
        } else {
          window.location.href = "user.html";
        }
      }, 800);
    }
  } catch (err) {
    showToast(err.message || "Login gagal. Periksa email dan password Anda.");
    submitBtn.disabled = false;
    submitBtn.textContent = "Masuk ke Area User";
  }
});
