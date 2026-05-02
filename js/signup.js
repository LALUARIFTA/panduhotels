const signupForm = document.querySelector("#signupForm");
const toast = document.querySelector("#toast");

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  window.setTimeout(() => toast.classList.remove("show"), 3200);
}

// Redirect if already logged in
if (PanduAPI.isLoggedIn()) {
  window.location.href = "user.html";
}

signupForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const name = document.querySelector("#signupName").value.trim();
  const email = document.querySelector("#signupEmail").value.trim();
  const phone = document.querySelector("#signupPhone").value.trim();
  const password = document.querySelector("#signupPassword").value.trim();
  const confirm = document.querySelector("#signupConfirm").value.trim();
  const agree = document.querySelector("#signupAgree").checked;

  if (!name || !email || !phone || password.length < 6) {
    showToast("Lengkapi data dan gunakan password minimal 6 karakter.");
    return;
  }

  if (password !== confirm) {
    showToast("Konfirmasi password belum sama.");
    return;
  }

  if (!agree) {
    showToast("Setujui syarat booking untuk melanjutkan.");
    return;
  }

  const submitBtn = signupForm.querySelector("button[type='submit']");
  submitBtn.disabled = true;
  submitBtn.textContent = "Mendaftarkan...";

  try {
    const data = await PanduAPI.signup({ name, email, phone, password });
    showToast(data.message || "Akun berhasil dibuat!");
    setTimeout(() => {
      window.location.href = "login.html";
    }, 1500);
  } catch (err) {
    showToast(err.message || "Gagal membuat akun. Coba lagi.");
    submitBtn.disabled = false;
    submitBtn.textContent = "Buat Akun User";
  }
});
