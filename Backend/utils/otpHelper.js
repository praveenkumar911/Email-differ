// utils/otpHelper.js
import { auth } from "../config/firebaseAdmin.js";


/**
 * Normalize Indian numbers to E.164 (+91XXXXXXXXXX)
 */
function toE164(phone) {
  if (!phone) return phone;
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`;
  if (phone.startsWith('+')) return phone.replace(/\s+/g, '');
  return `+${digits}`;
}

/**
 * ✅ Verify Firebase ID Token (after OTP verification on frontend)
 */
const verifyFirebaseOtp = async (firebaseToken, phone) => {
  try {
    const decoded = await auth.verifyIdToken(firebaseToken, true);
    const firebasePhone = decoded.phone_number?.replace(/\s+/g, '');
    const normalizedPhone = toE164(phone);

    if (!firebasePhone) {
      return { valid: false, message: "No phone number found in Firebase token" };
    }

    if (!auth) {
  console.error("❌ Firebase Admin Auth is null — initialization failed");
  return { valid: false, message: "Server misconfiguration: Firebase not initialized" };
}

    if (firebasePhone !== normalizedPhone) {
      return { valid: false, message: "Phone mismatch between Firebase and request" };
    }

    return { valid: true, phone: firebasePhone };
  } catch (err) {
    console.error("❌ Firebase OTP verification error:", err.message);
    return { valid: false, message: "Invalid or expired Firebase token" };
  }
};

export { verifyFirebaseOtp, toE164 };
