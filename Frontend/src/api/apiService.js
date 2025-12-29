// src/api/apiService.js
import axios from "axios";

// 🌍 Base URL setup (local + production)
// Allow env to provide http://localhost:8000 or http://10.8.0.15:8000/api
const rawBase =
  process.env.VITE_REACT_APP_API_BASE_URL || "http://localhost:8000/api";

// Ensure baseURL always ends with /api
const normalized = (() => {
  try {
    const trimmed = String(rawBase).replace(/\/+$/, "");
    return trimmed.endsWith("/api") ? trimmed : `${trimmed}/api`;
  } catch {
    return "http://localhost:8000/api";
  }
})();

const API = axios.create({
  baseURL: normalized,
  headers: { "Content-Type": "application/json" },
});

// ✅ Request interceptor for debugging and validation
API.interceptors.request.use(
  (config) => {
    // Ensure data is properly serialized
    if (config.data && typeof config.data === 'object') {
      try {
        // Test if data can be stringified
        JSON.stringify(config.data);
      } catch (err) {
        console.error('❌ Cannot serialize request data:', err);
        throw new Error('Invalid request data format');
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// ✅ Response interceptor for better error handling
API.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 400 && error.response?.data?.error?.includes('JSON')) {
      console.error('❌ Server JSON parsing error:', error.response.data);
    }
    return Promise.reject(error);
  }
);

// ------------------------------
// 🧾 FORM UPDATE FLOW (existing email system)
// ------------------------------
export const validateToken = (token) => API.get(`/form/validate/${token}`);
export const submitForm = (data) => API.post("/form/submit", data);
export const deferForm = (data) => API.post("/form/defer", data);
export const optOut = ({ token, reason }) =>
  API.post("/form/optout", { token, reason });

// ------------------------------
// 📱 AUTH FLOW (Firebase OTP-based signup/login system)
// ------------------------------

// 1️⃣ Signup (register a new user — creates pending record on backend)
export const signupUser = async (formData) => {
  try {
    const res = await API.post("/users/signup", formData);
    return res.data;
  } catch (err) {
    console.error("❌ Signup error:", err.response?.data || err.message);
    throw err.response?.data || { message: "Server error" };
  }
};

// Pre-check: ask backend if phone/email exists
export const requestOtp = async ({ phone, email }) => {
  try {
    const res = await API.post('/users/request-otp', { phone, email });
    return res.data;
  } catch (err) {
    console.error('❌ requestOtp error:', err.response?.data || err.message);
    throw err.response?.data || { message: 'Server error' };
  }
};

// 2️⃣ (Optional) Signin — previously used to request dummy OTP
// With Firebase, OTP is now handled on frontend.
// Keep this function for compatibility (may not be needed later).
export const signinUser = async (identifier) => {
  try {
    const res = await API.post("/auth/signin", identifier);
    return res.data;
  } catch (err) {
    console.error("❌ Signin error:", err.response?.data || err.message);
    throw err.response?.data || { message: "Server error" };
  }
};

// 3️⃣ Verify Firebase OTP (for both signup & login)
//    Payload must contain: { firebaseToken }
export const verifyOtp = async (payload) => {
  try {
    const { firebaseToken, phoneNumber } = payload;

    const res = await API.post("/login", {
      firebaseToken,
      phoneNumber,   // <--- SEND CORRECT FIELD
    });

    return res.data;
  } catch (err) {
    throw err.response?.data || { message: "Server error" };
  }
};


// 4️⃣ Alias for backward compatibility
export const verifyLoginOtp = async (payload) => {
  return verifyOtp(payload);
};


// 5️⃣ Protected route example (for later role-based auth)
export const getProtectedData = async (token) => {
  try {
    const res = await API.get("/auth/protected", {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.data;
  } catch (err) {
    console.error(
      "❌ Protected route error:",
      err.response?.data || err.message
    );
    throw err.response?.data || { message: "Server error" };
  }
};

export default API;
