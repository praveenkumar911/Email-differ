// src/utils/recaptchaCleanup.js
export const cleanupRecaptcha = () => {
  try {
    if (window.recaptchaVerifier) {
      window.recaptchaVerifier.clear?.();
      window.recaptchaVerifier = null;
    }
    document.querySelectorAll('div[id^="recaptcha-container"]').forEach(div => {
      div.innerHTML = "";
    });
  } catch (err) {
    console.warn("Cleanup error:", err);
  }
};