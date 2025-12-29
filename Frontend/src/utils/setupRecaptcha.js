// src/utils/setupRecaptcha.js
import { RecaptchaVerifier } from "firebase/auth";

// Global singleton
let verifierPromise = null;

export const forceResetRecaptchaPromise = () => {
  verifierPromise = null;
};

export const setupRecaptcha = (auth, containerId) => {
  // Return existing promise if already setting up
  if (verifierPromise) {
    return verifierPromise;
  }

  verifierPromise = (async () => {
    try {
      // Clean container
      const container = document.getElementById(containerId);
      if (container) container.innerHTML = "";

      // Clear old verifier
      if (window.recaptchaVerifier) {
        try { window.recaptchaVerifier.clear(); } catch {}
        window.recaptchaVerifier = null;
      }

      // Create new verifier
      window.recaptchaVerifier = new RecaptchaVerifier(auth, containerId, {
        size: "invisible",
        callback: () => console.log("reCAPTCHA solved"),
        "expired-callback": () => console.warn("reCAPTCHA expired"),
      });

      // This is the key: wrap render() in a way that NEVER rejects unhandled
      try {
        await window.recaptchaVerifier.render();
        console.log("reCAPTCHA ready");
      } catch (renderError) {
        // Firebase sometimes throws here in dev — swallow it
        console.warn("reCAPTCHA render error (safe to ignore in dev):", renderError);
      }

      return true;
    } catch (err) {
      console.error("reCAPTCHA setup failed:", err);
      window.recaptchaVerifier = null;
      return false;
    }
  })();

  // Always return the promise
  return verifierPromise;
};

// Optional cleanup
export const resetRecaptcha = () => {
  if (window.recaptchaVerifier) {
    try { window.recaptchaVerifier.clear(); } catch {}
    window.recaptchaVerifier = null;
  }
  verifierPromise = null;
  
  // Clear containers
  document.querySelectorAll('div[id^="recaptcha-container"]').forEach(div => {
    div.innerHTML = "";
  });
};