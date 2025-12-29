// src/firebase.js
import { initializeApp } from "firebase/app";
import {
  getAuth,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  signInWithCredential,
  PhoneAuthProvider,
} from "firebase/auth";
import { getApps } from "firebase/app";
const firebaseConfig = {
  apiKey: "AIzaSyDdhCELLrtzklcSEgM8nSlt8G9FKW5xPMM", 
  authDomain: "c4gt-infra.firebaseapp.com",
  projectId: "c4gt-infra",
  storageBucket: "c4gt-infra.firebasestorage.app",
  messagingSenderId: "259145319129",
  appId: "1:259145319129:web:b0d84e6e50a455f9e074c8",
  measurementId: "G-1BHTE5ZB5Q"
};


// ✅ Prevent duplicate initialization during hot reload or re-import
const app = !getApps().length ? initializeApp(firebaseConfig) : getApps()[0];

// ✅ Always use a single shared auth instance
const auth = getAuth(app);

// ✅ Force v2 fallback (disable Enterprise completely)
try {
  auth.settings.appVerificationDisabledForTesting = false;
  auth.settings.forceRecaptchaFallback = true;
  console.log("⚙️ Classic Firebase reCAPTCHA v2 mode enabled (Enterprise disabled)");
} catch (e) {
  console.warn("⚠️ Could not set auth.settings:", e);
}

// ✅ Export everything needed across components
export {
  auth,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  signInWithCredential,
  PhoneAuthProvider,
};