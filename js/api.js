/**
 * PanduHotel API Client
 * Centralized module for all backend communication.
 * Handles authentication tokens, auto-refresh, and error handling.
 */
const PanduAPI = (() => {
  // Gunakan /api jika di satu domain, atau ganti dengan URL backend Anda (misal: https://panduhotel-api.onrender.com/api)
  const BASE_URL = localStorage.getItem("PANDU_API_URL") || "/api";

  // ── Session Management ──────────────────────────

  function getSession() {
    try {
      return JSON.parse(localStorage.getItem("panduSession") || "null");
    } catch {
      return null;
    }
  }

  function setSession(session, user) {
    localStorage.setItem("panduSession", JSON.stringify(session));
    localStorage.setItem("panduUser", JSON.stringify(user));
  }

  function clearSession() {
    localStorage.removeItem("panduSession");
    localStorage.removeItem("panduUser");
  }

  function getUser() {
    try {
      return JSON.parse(localStorage.getItem("panduUser") || "null");
    } catch {
      return null;
    }
  }

  function getToken() {
    const session = getSession();
    return session?.access_token || null;
  }

  function isLoggedIn() {
    return !!getToken();
  }

  // ── HTTP Helper ─────────────────────────────────

  async function request(endpoint, options = {}) {
    const url = `${BASE_URL}${endpoint}`;
    const headers = { ...options.headers };

    // Add auth token if available
    const token = getToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    // Add JSON content-type for non-FormData bodies
    if (options.body && !(options.body instanceof FormData)) {
      headers["Content-Type"] = "application/json";
      options.body = JSON.stringify(options.body);
    }

    try {
      const response = await fetch(url, { ...options, headers });
      const data = await response.json();

      if (!response.ok) {
        // If 401, try refresh token
        if (response.status === 401 && getSession()?.refresh_token) {
          const refreshed = await refreshToken();
          if (refreshed) {
            // Retry the original request with new token
            headers["Authorization"] = `Bearer ${getToken()}`;
            const retryResponse = await fetch(url, { ...options, headers });
            return await retryResponse.json();
          } else {
            clearSession();
            window.location.href = "login.html";
            return null;
          }
        }
        throw { status: response.status, ...data };
      }

      return data;
    } catch (err) {
      if (err.status) throw err;
      console.error("Network error:", err);
      throw { error: "Koneksi gagal", message: "Tidak dapat terhubung ke server." };
    }
  }

  async function refreshToken() {
    const session = getSession();
    if (!session?.refresh_token) return false;

    try {
      const response = await fetch(`${BASE_URL}/auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: session.refresh_token })
      });

      if (!response.ok) return false;

      const data = await response.json();
      const user = getUser();
      setSession(data.session, user);
      return true;
    } catch {
      return false;
    }
  }

  // ── Auth Endpoints ──────────────────────────────

  async function signup({ name, email, phone, password }) {
    const data = await request("/auth/signup", {
      method: "POST",
      body: { name, email, phone, password }
    });
    return data;
  }

  async function login({ email, password }) {
    const data = await request("/auth/login", {
      method: "POST",
      body: { email, password }
    });

    if (data?.session) {
      setSession(data.session, data.user);
    }

    return data;
  }

  async function logout() {
    try {
      await request("/auth/logout", { method: "POST" });
    } catch {
      // Logout locally even if server fails
    }
    clearSession();
  }

  // ── Hotel Endpoints ─────────────────────────────

  async function getHotels(location) {
    const params = location && location !== "all" ? `?location=${location}` : "";
    const data = await request(`/hotels${params}`);
    return data?.hotels || [];
  }

  async function getHotel(id) {
    const data = await request(`/hotels/${id}`);
    return data?.hotel || null;
  }

  async function createHotel(formData) {
    const data = await request("/hotels", {
      method: "POST",
      body: formData  // FormData for file upload
    });
    return data;
  }

  async function updateHotel(id, formData) {
    const data = await request(`/hotels/${id}`, {
      method: "PATCH",
      body: formData
    });
    return data;
  }

  async function deleteHotel(id) {
    const data = await request(`/hotels/${id}`, {
      method: "DELETE"
    });
    return data;
  }

  // ── Booking Endpoints ───────────────────────────

  async function createBooking(bookingData) {
    const data = await request("/bookings", {
      method: "POST",
      body: bookingData
    });
    return data;
  }

  async function getBookings() {
    const data = await request("/bookings");
    return data?.bookings || [];
  }

  async function getBooking(code) {
    const data = await request(`/bookings/${code}`);
    return data?.booking || null;
  }

  async function getAllBookings(params = {}) {
    const query = new URLSearchParams(params).toString();
    const data = await request(`/bookings/admin/all${query ? "?" + query : ""}`);
    return data;
  }

  async function updateBookingStatus(code, statusData) {
    const data = await request(`/bookings/${code}/status`, {
      method: "PATCH",
      body: statusData
    });
    return data;
  }

  // ── Public API ──────────────────────────────────

  return {
    // Session
    getSession,
    getUser,
    getToken,
    isLoggedIn,
    clearSession,
    request,

    // Auth
    signup,
    login,
    logout,

    // Hotels
    getHotels,
    getHotel,
    createHotel,
    updateHotel,
    deleteHotel,

    // Bookings
    createBooking,
    getBookings,
    getBooking,
    getAllBookings,
    updateBookingStatus
  };
})();
