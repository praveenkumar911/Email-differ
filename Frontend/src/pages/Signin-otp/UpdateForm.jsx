import React, { useEffect, useState, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import API, {
  validateToken,
  submitForm,
  deferForm,
  optOut,
  searchOrgs,
} from "../../api/apiService";
import { auth, signInWithPhoneNumber, RecaptchaVerifier } from "../../firebase";
import {
  GithubAuthProvider,
  signInWithPopup,
  getAdditionalUserInfo,
  signOut,
} from "firebase/auth";

import Swal from "sweetalert2";
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  Stack,
  Divider,
  Autocomplete,
  Fade,
} from "@mui/material";
import { keyframes } from "@mui/system";
import { MuiTelInput } from 'mui-tel-input';
import { parsePhoneNumber, isValidPhoneFormat } from "../../utils/phoneUtils";
import logo1 from "../../assets/badal_logo.png";
import logo2 from "../../assets/c4gt_logo.png";
import {
  FiCheckCircle,
  FiAlertTriangle,
  FiXCircle,
  FiClock,
  FiLink,
  FiMail,
  FiSave,
  FiLock,
  FiInfo,
  FiSlash,
  FiUserCheck
} from "react-icons/fi";

// ✅ Shake animation for skill limit
const shake = keyframes`
  0% { transform: translateX(0); }
  20% { transform: translateX(-4px); }
  40% { transform: translateX(4px); }
  60% { transform: translateX(-3px); }
  80% { transform: translateX(3px); }
  100% { transform: translateX(0); }
`;

// ✅ Role List (matching SignUpPage)
const ROLES = [
  { value: "R004", label: "Developer" },
];

// ✅ Role codes to backend strings (consistent with SignUpPage)
// eslint-disable-next-line no-unused-vars
const ROLE_MAP = {
  R004: "Developer",
  
};

const GENDERS = ["Male", "Female", "Other", "Prefer not to say"];

// ✅ Tech Skills (same as SignUpPage)
const SKILLS = [
  "Frontend Development",
  "Backend Development",
  "Full Stack Development",
  "UI/UX Design",
  "Data Science",
  "Machine Learning",
  "DevOps",
  "Cloud Computing",
  "Cybersecurity",
  "Mobile App Development",
  "Blockchain",
  "Product Management",
  "Public Policy",
  "Research",
  "Technical Writing",
];

// ✅ Validation regex (available for future use)
// eslint-disable-next-line no-unused-vars
const githubRegex = /^https:\/\/(www\.)?github\.com\/[A-Za-z0-9_-]+\/?$/;
// eslint-disable-next-line no-unused-vars
const linkedinRegex = /^https:\/\/(www\.)?linkedin\.com\/in\/[A-Za-z0-9_-]+\/?$/;

 const DISCORD_REDIRECT = "https://pl-app.iiit.ac.in/rcts/account-setup/discord-callback";
// const DISCORD_INVITE = "https://discord.gg/BsbzbUHz";
//const DISCORD_REDIRECT = "http://127.0.0.1:3000/rcts/codeforgovtech/discord-callback";
const DISCORD_INVITE = "https://discord.gg/BsbzbUHz";
// ✅ Generate OAuth state for CSRF protection
const generateOAuthState = () => {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
};

const DISCORD_OAUTH = (state) =>
  "https://discord.com/oauth2/authorize" +
  "?client_id=1450787791834447874" +
  "&redirect_uri=" +
  encodeURIComponent(DISCORD_REDIRECT) +
  "&response_type=code" +
  "&scope=identify%20guilds" +
  "&state=" + encodeURIComponent(state);

// LinkedIn OAuth removed: collecting URL via input field instead



const UpdateForm = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phone: "",
    gender: "",
    organization: null,
    role: "",
    skills: [],
    githubId: "",
    githubUrl: "",
    discordId: "",
    linkedinId: "",
  });

  const [phoneVerification, setPhoneVerification] = useState({
    isVerified: false,
    showOtpInput: false,
    otp: "",
    isProcessing: false,
    firebaseToken: null, // ✅ Store Firebase token for form submission
  });

  const [status, setStatus] = useState("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [interested, setInterested] = useState(null);
  const [optoutReason, setOptoutReason] = useState("");
  const [optoutProcessing, setOptoutProcessing] = useState(false);
  const [timer, setTimer] = useState(0);
  
  // ---------------- ORG STATE ----------------
  const [orgLoadError, setOrgLoadError] = useState(false);
  const [showCustomOrg, setShowCustomOrg] = useState(false);
  const [orgOptions, setOrgOptions] = useState([]);
  const [orgLoading, setOrgLoading] = useState(false);
  const isDirtyRef = useRef(false);
  const [fadeOut, setFadeOut] = useState(false);
  const [countdown, setCountdown] = useState(5);
  const [timeRemaining, setTimeRemaining] = useState(600); // 10 minutes in seconds
  const [isSubmitting, setIsSubmitting] = useState(false); // ✅ Prevent double submit
  const recaptchaCleanedUp = useRef(false); // ✅ Track recaptcha cleanup
  const recaptchaContainerIdRef = useRef(0); // ✅ Track unique container IDs
  const recaptchaWidgetIdRef = useRef(null); // ✅ Track widget ID for proper cleanup
  const [shakeSkills, setShakeSkills] = useState(false); // ✅ Shake animation state

  // ✅ Reusable reCAPTCHA cleanup function
  const cleanupRecaptcha = async (aggressive = false) => {
    console.log(`🧹 Cleaning up reCAPTCHA (aggressive: ${aggressive})...`);
    
    // Step 1: Clear Firebase RecaptchaVerifier
    if (window.recaptchaVerifier) {
      try {
        await window.recaptchaVerifier.clear();
        console.log('✓ Cleared recaptchaVerifier');
      } catch (e) {
        console.warn('Failed to clear recaptchaVerifier:', e);
      }
      delete window.recaptchaVerifier;
      window.recaptchaVerifier = null;
    }
    
    // Step 2: Reset ALL grecaptcha widgets aggressively
    if (window.grecaptcha && window.grecaptcha.reset) {
      try {
        // Try to reset by widget ID first
        if (recaptchaWidgetIdRef.current !== null) {
          try {
            window.grecaptcha.reset(recaptchaWidgetIdRef.current);
            console.log(`✓ Reset grecaptcha widget ${recaptchaWidgetIdRef.current}`);
          } catch (e) {
            console.warn('Failed to reset specific widget:', e);
          }
        }
        // Always try to reset without ID (resets all widgets)
        try {
          window.grecaptcha.reset();
          console.log('✓ Reset all grecaptcha widgets');
        } catch (e) {
          console.warn('Failed to reset all widgets:', e);
        }
      } catch (e) {
        console.warn('Failed to reset grecaptcha:', e);
      }
    }
    recaptchaWidgetIdRef.current = null;
    
    // Step 3: Completely remove and recreate DOM container
    const container = document.getElementById("recaptcha-container-update");
    if (container) {
      // Remove ALL content and event listeners
      container.innerHTML = "";
      container.textContent = "";
      
      // Remove all data attributes that grecaptcha might have added
      Array.from(container.attributes).forEach(attr => {
        if (attr.name.startsWith('data-')) {
          container.removeAttribute(attr.name);
        }
      });
      
      console.log('✓ Cleared DOM container completely');
    }
    
    recaptchaCleanedUp.current = true;
  };

  // Form validation - check if all required fields are filled
  const isFormComplete = () => {
    // ✅ Check if submission is in progress
    if (isSubmitting) return false;
    
    // ✅ Check organization object structure
    const hasValidOrg =
      formData.organization &&
      formData.organization.name &&
      formData.organization.ref &&
      formData.organization.ref.type &&
      (
        formData.organization.ref.type !== "custom" ||
        formData.organization.orgType
      );
    
    const requiredFieldsFilled = 
      formData.fullName?.trim() !== "" &&
      formData.email?.trim() !== "" &&
      formData.phone?.trim() !== "" &&
      formData.gender !== "" &&
      hasValidOrg &&
      formData.role !== "";
    
    const socialVerified = githubStatus.verified && discordVerified;
    const phoneVerified = phoneVerification.isVerified;
    
    return requiredFieldsFilled && socialVerified && phoneVerified;
  };

  // OAuth verification states
  const [githubStatus, setGithubStatus] = useState({
    verifying: false,
    verified: false,
    username: "",
    avatar: "", // ✅ Store avatar URL
    error: "",
  });
  const [discordVerified, setDiscordVerified] = useState(
    sessionStorage.getItem("discordVerified") === "true"
  );
  const [discordNotMember, setDiscordNotMember] = useState(
    sessionStorage.getItem("discordNotMember") === "true"
  );
  const [discordStatus, setDiscordStatus] = useState({
    verifying: false,
  });
  const [oauthInProgress, setOauthInProgress] = useState(false);

  // 🔔 SweetAlert helper
  const showAlert = (text, icon = "info") =>
    Swal.fire({
      text,
      icon,
      confirmButtonColor: "#1E4DD8",
    });

  // ✅ Restore UpdateForm context when returning from OAuth
  useEffect(() => {
    const isReturningFromOAuth = sessionStorage.getItem("isNavigating");
    if (isReturningFromOAuth) {
      const savedFormData = sessionStorage.getItem("updateFormData");
      const savedToken = sessionStorage.getItem("updateFormToken");
      
      if (savedFormData) {
        try {
          const parsedData = JSON.parse(savedFormData);
          setFormData(prev => ({ ...prev, ...parsedData }));
        } catch (e) {
          console.error("Failed to restore form data:", e);
        }
      }
      
      // ✅ Restore phone verification state
      const savedPhoneVerification = sessionStorage.getItem("phoneVerificationState");
      if (savedPhoneVerification) {
        try {
          const parsedPhoneData = JSON.parse(savedPhoneVerification);
          setPhoneVerification(prev => ({
            ...prev,
            isVerified: parsedPhoneData.isVerified,
            firebaseToken: parsedPhoneData.firebaseToken,
            showOtpInput: false, // Hide OTP input since already verified
          }));
          console.log("✅ Restored phone verification state from sessionStorage");
        } catch (e) {
          console.error("Failed to restore phone verification:", e);
        }
      }
      
      // Clear OAuth in progress flag on backend
      if (savedToken) {
        API.post('/form/oauth-status', { token: savedToken, inProgress: false })
          .catch(err => console.error("Failed to clear OAuth flag:", err));
      }
      
      sessionStorage.removeItem("isNavigating");
      sessionStorage.removeItem("updateFormData");
      sessionStorage.removeItem("updateFormToken");
      setOauthInProgress(false);
    }
  }, []);

  // ✅ Token validation
  useEffect(() => {
    const activateAndValidate = async () => {
      if (!token) {
        setStatus("invalid");
        setErrorMessage("No token provided");
        return;
      }

      try {
        // ✅ Activate token and get activatedAt timestamp
        const activateRes = await API.post("/form/activate", { token });
        const res = await validateToken(token);

        if (res.data.valid) {
          setStatus("valid");

          const partialRes = await API.get(`/form/partial/${token}`);
          if (partialRes.data?.data) {
            const partial = partialRes.data.data;

            setFormData((prev) => ({
              ...prev,
              ...partial,
              skills: partial.techStack || partial.skills || [],   // ✅ map correctly
            }));
          }

          // ✅ Calculate time remaining from backend activatedAt timestamp
          if (activateRes.data?.activatedAt) {
            const activatedTime = new Date(activateRes.data.activatedAt).getTime();
            const now = Date.now();
            const elapsed = Math.floor((now - activatedTime) / 1000); // seconds elapsed
            const remaining = Math.max(0, 600 - elapsed); // 10 minutes = 600 seconds
            setTimeRemaining(remaining);
          }

          // ⏰ Token expires after 7 days (matches backend expiry window)
          const timer = setTimeout(() => {
            setStatus("expired");
            alert(
              "This link has expired. Please check your email for a new update link."
            );
          }, 7 * 24 * 60 * 60 * 1000); // 7 days

          return () => clearTimeout(timer);
        } else {
          setStatus("invalid");
          setErrorMessage(res.data.message || "Invalid token");
        }
      } catch (err) {
        const errorMsg = err.response?.data?.message || "Failed to load form";
        
        // ✅ Check if form was already submitted
        if (errorMsg === "Form already submitted") {
          setStatus("submitted");
        } else {
          setStatus("invalid");
          setErrorMessage(errorMsg);
        }
      }
    };
    activateAndValidate();
  }, [token]);

  // ✅ Clean up reCAPTCHA on component unmount
  useEffect(() => {
    return () => {
      cleanupRecaptcha(true); // Aggressive cleanup on unmount
    };
  }, []);

  // ✅ Auto-save every 5 seconds (only if form data changed)
  useEffect(() => {
    if (status !== "valid") return;
    const timer = setInterval(async () => {
      // ✅ Only save if form data has changed
      if (!isDirtyRef.current) return;
      
      try {
        await API.post(`/form/save-partial`, { token, data: formData });
        isDirtyRef.current = false; // ✅ Reset dirty flag after successful save
      } catch {}
    }, 5000);
    return () => clearInterval(timer);
  }, [formData, status, token]);

  // ⏱ Resend timer
  useEffect(() => {
    if (timer > 0) {
      const interval = setInterval(() => setTimer((t) => t - 1), 1000);
      return () => clearInterval(interval);
    }
  }, [timer]);
  
  // Restore GitHub verification from sessionStorage
  useEffect(() => {
    const verified = sessionStorage.getItem("githubVerified") === "true";
    const username = sessionStorage.getItem("githubUsername");
    const url = sessionStorage.getItem("githubUrl");

    if (verified && username && url) {
      setGithubStatus({
        verifying: false,
        verified: true,
        username,
        error: "",
      });
      setFormData(prev => ({ ...prev, githubUrl: url }));
    }
  }, []);
  
  // Restore Discord verification from sessionStorage
  useEffect(() => {
    const verified = sessionStorage.getItem("discordVerified") === "true";
    const notMember = sessionStorage.getItem("discordNotMember") === "true";

    setDiscordVerified(verified);
    setDiscordNotMember(notMember);

    if (verified) {
      const discordUsername = sessionStorage.getItem("discordUsername");
      if (discordUsername) {
        // Use username (display name like "user#1234"), not numeric ID
        setFormData((prev) => ({ ...prev, discordId: discordUsername }));
      }
    }
  }, []);
  // ✅ Auto-close tab + countdown when deferred
  useEffect(() => {
    if (status === "deferred") {
      const interval = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            window.close(); // auto-close after countdown
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [status]);

  // Restore GitHub verification from sessionStorage
  useEffect(() => {
    const verified = sessionStorage.getItem("githubVerified") === "true";
    const username = sessionStorage.getItem("githubUsername");
    const url = sessionStorage.getItem("githubUrl");

    if (verified && username && url) {
      setGithubStatus({
        verifying: false,
        verified: true,
        username,
        error: "",
      });
      setFormData(prev => ({ ...prev, githubUrl: url }));
    }
  }, []);

  // ✅ Restore phone verification from sessionStorage on mount
  useEffect(() => {
    const savedPhoneVerification = sessionStorage.getItem("phoneVerificationState");
    if (savedPhoneVerification) {
      try {
        const parsedPhoneData = JSON.parse(savedPhoneVerification);
        // Check if verification is still recent (within 1 hour)
        const verifiedAt = new Date(parsedPhoneData.verifiedAt);
        const now = new Date();
        const ageInMs = now - verifiedAt;
        const oneHourInMs = 60 * 60 * 1000;
        
        if (ageInMs < oneHourInMs) {
          setPhoneVerification(prev => ({
            ...prev,
            isVerified: parsedPhoneData.isVerified,
            firebaseToken: parsedPhoneData.firebaseToken,
            showOtpInput: false,
          }));
          console.log("✅ Restored phone verification from sessionStorage on mount");
        } else {
          // Expired - clear it
          sessionStorage.removeItem("phoneVerificationState");
          console.log("⚠️ Phone verification expired, cleared from sessionStorage");
        }
      } catch (e) {
        console.error("Failed to restore phone verification on mount:", e);
      }
    }
  }, []);

  // ✅ Load initial org options on mount (matching Signup)
  useEffect(() => {
    const loadInitialOrgs = async () => {
      try {
        const results = await searchOrgs("");
        setOrgOptions(results || []);
      } catch (err) {
        console.error("Failed to load initial organizations:", err);
        setOrgLoadError(true);
      }
    };

    loadInitialOrgs();
  }, []);

  // ✅ 10-minute countdown timer with auto-expiry
  useEffect(() => {
    if (status === "valid" && timeRemaining > 0) {
      const countdownInterval = setInterval(() => {
        setTimeRemaining((prev) => {
          if (prev <= 1) {
            clearInterval(countdownInterval);
            setStatus("expired");
            Swal.fire({
              icon: "warning",
              title: "Token Expired",
              html: `
                <p>Your form session has expired after 10 minutes.</p>
                <p><strong>What happens next?</strong></p>
                <ul style="text-align: left; margin: 10px 20px;">
                  <li>This form will be automatically closed</li>
                  <li>You will receive a new reminder email within 24 hours</li>
                  <li>You can complete the form using the new link</li>
                </ul>
              `,
              confirmButtonColor: "#1E4DD8",
              confirmButtonText: "OK",
            });
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(countdownInterval);
    }
  }, [status, timeRemaining]);

  // ✅ Verify GitHub
  const handleVerifyGithub = async () => {
    setGithubStatus({
      verifying: true,
      verified: false,
      username: "",
      avatar: "",
      error: "",
    });

    try {
      const provider = new GithubAuthProvider();
      const result = await signInWithPopup(auth, provider);

      const info = getAdditionalUserInfo(result);
      const githubUsername = info?.username;
      const githubAvatar = info?.profile?.avatar_url || "";

      if (!githubUsername) throw new Error("Unable to retrieve GitHub username");

      const verifiedUrl = `https://github.com/${githubUsername}`;
      
      setFormData(prev => ({ ...prev, githubUrl: verifiedUrl }));

      // ✅ Store in sessionStorage for persistence
      sessionStorage.setItem("githubVerified", "true");
      sessionStorage.setItem("githubUsername", githubUsername);
      sessionStorage.setItem("githubUrl", verifiedUrl);
      sessionStorage.setItem("githubAvatar", githubAvatar);

      setGithubStatus({
        verifying: false,
        verified: true,
        username: githubUsername,
        avatar: githubAvatar,
        error: "",
      });

      await signOut(auth);
      showAlert("GitHub verified successfully!", "success");
    } catch (err) {
      console.error("GitHub verify error:", err);
      
      // ✅ Handle different error types
      let errorMsg = "GitHub verification failed. Please try again.";
      
      if (err.code === "auth/popup-closed-by-user") {
        errorMsg = "Verification cancelled. Please try again.";
      } else if (err.code === "auth/popup-blocked") {
        errorMsg = "Popup was blocked by your browser. Please allow popups for this site and try again.";
      } else if (err.code === "auth/cancelled-popup-request") {
        errorMsg = "Verification cancelled. Please try again.";
      } else if (err.message?.includes("rate") || err.message?.includes("limit")) {
        errorMsg = "Too many verification attempts. Please wait a few minutes and try again.";
      }
      
      setGithubStatus({
        verifying: false,
        verified: false,
        username: "",
        avatar: "",
        error: errorMsg,
      });
      
      if (err.code !== "auth/popup-closed-by-user") {
        showAlert(errorMsg, "error");
      }
    }
  };

  // ✅ Verify Discord (redirect-based)
  const handleVerifyDiscord = async () => {
    try {
      // ✅ Set verifying state
      setDiscordStatus({ verifying: true });
      
      // ✅ Generate OAuth state for CSRF protection
      const state = generateOAuthState();
      sessionStorage.setItem("discordOAuthState", state);
      
      // ✅ Clear stale member flag before starting
      sessionStorage.removeItem("discordNotMember");
      setDiscordNotMember(false);
      
      // Mark OAuth as in progress to extend token expiry
      await API.post('/form/oauth-status', { token, inProgress: true });
      
      // Save form data and token before redirect
      sessionStorage.setItem("updateFormData", JSON.stringify(formData));
      sessionStorage.setItem("updateFormToken", token);
      
      // ✅ Save phone verification state if verified
      if (phoneVerification.isVerified && phoneVerification.firebaseToken) {
        sessionStorage.setItem("phoneVerificationState", JSON.stringify({
          isVerified: true,
          firebaseToken: phoneVerification.firebaseToken,
          verifiedAt: new Date().toISOString(),
        }));
      }
      sessionStorage.setItem("oauthReturnPath", `/update-form?token=${token}`);
      
      setOauthInProgress(true);
      
      // ✅ Show loading state briefly before redirect
      showAlert("Redirecting to Discord...", "info");
      
      // Redirect to Discord OAuth with state
      setTimeout(() => {
        window.location.href = DISCORD_OAUTH(state);
      }, 500);
    } catch (err) {
      console.error("Failed to mark OAuth in progress:", err);
      setOauthInProgress(false); // ✅ Clear flag to allow retry
      setDiscordStatus({ verifying: false }); // ✅ Reset verifying state
      showAlert("Failed to start Discord verification. Please try again.", "error");
    }
  };

  // ✅ Handle org search (like Signup)
  const handleOrgSearch = async (searchTerm) => {
    if (!searchTerm || searchTerm.trim() === "") {
      setOrgLoading(true);
      try {
        const results = await searchOrgs("");
        setOrgOptions(results || []);
      } catch (err) {
        console.error("Org search error:", err);
        setOrgOptions([]);
      } finally {
        setOrgLoading(false);
      }
      return;
    }

    if (searchTerm.length < 2) {
      return;
    }

    setOrgLoading(true);
    try {
      const results = await searchOrgs(searchTerm);
      setOrgOptions(results || []);
    } catch (err) {
      console.error("Org search error:", err);
      setOrgOptions([]);
    } finally {
      setOrgLoading(false);
    }
  };

  // ✅ Handle organization change (matching Signup structure)
  const handleOrgChange = (value) => {
    isDirtyRef.current = true;

    if (!value) {
      setShowCustomOrg(false);
      setFormData({ ...formData, organization: null });
      return;
    }

    if (value.source === "custom") {
      setShowCustomOrg(true);
      setFormData({
        ...formData,
        organization: {
          source: "custom",
          ref: { type: "custom", id: null },
          name: "",
          orgType: ""
        }
      });
    } else {
      setShowCustomOrg(false);
      setFormData({
        ...formData,
        organization: {
          source: value.source,
          ref: value.orgRef,
          name: value.label,
          orgType: value.orgType
        }
      });
    }
  };

  // ✅ Handle changes
  const handleChange = (e) => {
    isDirtyRef.current = true;
    const { name, value } = e.target;

    setFormData({ ...formData, [name]: value });
  };

  // ✅ Request OTP
  const handleRequestOtp = async () => {
    const phoneValidation = parsePhoneNumber(formData.phone);

    if (!phoneValidation.isValid) {
      return showAlert(
        "Please enter a valid phone number.",
        "warning"
      );
    }

    if (timer > 0)
      return showAlert(`Please wait ${timer}s before resending OTP.`, "info");

    // ✅ Prevent multiple rapid clicks
    if (phoneVerification.isProcessing) {
      console.log('⚠️ OTP request already in progress');
      return;
    }

    setPhoneVerification((p) => ({ ...p, isProcessing: true }));

    try {
      // ✅ Use aggressive cleanup utility
      await cleanupRecaptcha(true);
      
      // Generate unique container ID
      recaptchaContainerIdRef.current += 1;
      const uniqueContainerId = `recaptcha-container-update-${recaptchaContainerIdRef.current}`;
      
      // Recreate container
      const container = document.getElementById("recaptcha-container-update");
      if (!container) {
        console.error('❌ recaptcha-container-update not found in DOM');
        throw new Error('reCAPTCHA container not found');
      }
      
      // Create fresh inner div
      const newDiv = document.createElement('div');
      newDiv.id = uniqueContainerId;
      newDiv.className = 'recaptcha-inner';
      container.appendChild(newDiv);

      // Wait for DOM to be ready
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Verify container exists
      const targetContainer = document.getElementById(uniqueContainerId);
      if (!targetContainer) {
        throw new Error(`Container ${uniqueContainerId} not found after creation`);
      }
      
      console.log(`✓ Created fresh container: ${uniqueContainerId}`);

      // Step 6: Create new RecaptchaVerifier with unique container
      console.log('🔧 Creating new RecaptchaVerifier...');
      window.recaptchaVerifier = new RecaptchaVerifier(
        auth,
        uniqueContainerId,
        {
          size: "invisible",
          callback: () => console.log("reCAPTCHA solved"),
          "expired-callback": () => console.warn("reCAPTCHA expired"),
        }
      );

      // Step 7: Render and store widget ID (with additional error handling)
      let widgetId;
      try {
        widgetId = await window.recaptchaVerifier.render();
        recaptchaWidgetIdRef.current = widgetId;
        console.log(`✅ reCAPTCHA rendered successfully in ${uniqueContainerId} (widget ID: ${widgetId})`);
      } catch (renderError) {
        // If render still fails, try one more time with complete reset
        console.warn('⚠️ First render attempt failed, trying complete reset...', renderError);
        
        // Nuclear option: reload grecaptcha script
        if (window.grecaptcha) {
          delete window.grecaptcha;
        }
        
        // Wait a bit longer
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Try to render again
        widgetId = await window.recaptchaVerifier.render();
        recaptchaWidgetIdRef.current = widgetId;
        console.log(`✅ reCAPTCHA rendered successfully on retry (widget ID: ${widgetId})`);
      }

      const e164Phone = phoneValidation.e164;
      const confirmationResult = await signInWithPhoneNumber(
        auth,
        e164Phone,
        window.recaptchaVerifier
      );
      window.confirmationResult = confirmationResult;

      showAlert("OTP sent successfully to your phone!", "success");
      setPhoneVerification({
        showOtpInput: true,
        isVerified: false,
        otp: "",
        isProcessing: false,
      });
      setTimer(30); // cooldown
      recaptchaCleanedUp.current = false;
    } catch (err) {
      console.error("OTP send error:", err);
      
      // ✅ Provide user-friendly error messages
      let errorMsg = "Failed to send OTP. Please try again.";
      if (err.code === "auth/too-many-requests") {
        errorMsg = "Too many attempts. Please try again later.";
      } else if (err.code === "auth/invalid-phone-number") {
        errorMsg = "Invalid phone number format.";
      } else if (err.message?.includes("reCAPTCHA")) {
        errorMsg = err.message;
      }
      
      showAlert(errorMsg, "error");
      
      // ✅ Clean up on error
      await cleanupRecaptcha(true);
      
      setPhoneVerification((p) => ({ ...p, isProcessing: false }));
    }
  };

  // ✅ Verify OTP
  const handleVerifyOtp = async () => {
    if (!phoneVerification.otp.trim() || phoneVerification.otp.length !== 6) {
      return showAlert("Please enter a valid 6-digit OTP.", "warning");
    }

    setPhoneVerification((p) => ({ ...p, isProcessing: true }));

    try {
      const result = await window.confirmationResult.confirm(
        phoneVerification.otp
      );
      const user = result.user;
      const firebaseToken = await user.getIdToken();

      // ✅ Send phone in E.164 format
      await API.post(`/form/verify-phone`, {
        token,
        phone: formData.phone, // E.164 format from MuiTelInput
        firebaseToken,
      });

      showAlert("Phone verified successfully!", "success");

      const verifiedState = {
        ...phoneVerification,
        isVerified: true,
        isProcessing: false,
        firebaseToken, // ✅ Store token for form submission
      };
      
      setPhoneVerification(verifiedState);
      
      // ✅ Save to sessionStorage to persist across OAuth redirects
      sessionStorage.setItem("phoneVerificationState", JSON.stringify({
        isVerified: true,
        firebaseToken,
        verifiedAt: new Date().toISOString(),
      }));
      
      // ✅ Clean up recaptcha after successful verification
      await cleanupRecaptcha(false);
    } catch (err) {
      console.error("OTP verification failed:", err);
      
      // ✅ User-friendly error messages
      let errorMsg = "Invalid or expired OTP. Please try again.";
      if (err.code === "auth/invalid-verification-code") {
        errorMsg = "Invalid OTP code. Please check and try again.";
      } else if (err.code === "auth/code-expired") {
        errorMsg = "OTP has expired. Please request a new one.";
      }
      
      showAlert(errorMsg, "error");
      
      // ✅ Clear verifier to allow retry
      await cleanupRecaptcha(false);
      
      setPhoneVerification((p) => ({ ...p, isProcessing: false }));
    }
  };

  // ✅ Submit
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // ✅ Prevent double submission
    if (isSubmitting) {
      return;
    }

    // ✅ Detailed validation
    if (!formData.fullName?.trim()) {
      return showAlert("Please enter your full name.", "warning");
    }
    
    const phoneValidation = parsePhoneNumber(formData.phone);
    if (!phoneValidation.isValid) {
      return showAlert("Please enter a valid phone number.", "warning");
    }
    if (!formData.email?.trim() || !formData.email.includes("@")) {
      return showAlert("Please enter a valid email address.", "warning");
    }
    if (!formData.gender) {
      return showAlert("Please select your gender.", "warning");
    }
    if (
      !formData.organization ||
      !formData.organization.name ||
      !formData.organization.ref ||
      !formData.organization.ref.type
    ) {
      return showAlert("Please select or enter your organization.", "warning");
    }
    if (!formData.role) {
      return showAlert("Please select your role.", "warning");
    }
    if (!githubStatus.verified) {
      return showAlert("Please verify your GitHub account before submitting.", "warning");
    }
    if (!discordVerified) {
      return showAlert("Please verify your Discord account before submitting.", "warning");
    }
    if (!phoneVerification.isVerified) {
      return showAlert("Please verify your phone number before submitting.", "warning");
    }
    if (!formData.skills || formData.skills.length === 0) {
      return showAlert("Please select at least one tech skill.", "warning");
    }
    if (formData.skills.length > 6) {
      return showAlert("You can select maximum 6 skills.", "warning");
    }

    const confirm = await Swal.fire({
      title: "Confirm Submission?",
      text: "Please review your information before submitting.",
      icon: "question",
      showCancelButton: true,
      confirmButtonText: "Submit",
      confirmButtonColor: "#1E4DD8",
    });

    if (!confirm.isConfirmed) return;

    // ✅ Prevent multiple submissions
    if (isSubmitting) {
      console.log('⚠️ Submission already in progress');
      return;
    }

    setIsSubmitting(true);

    try {
      isDirtyRef.current = false;
      
      // ✅ Get verified social media data from sessionStorage
      const githubUsername = sessionStorage.getItem("githubUsername") || "";
      const githubUrl = sessionStorage.getItem("githubUrl") || "";
      const discordId = sessionStorage.getItem("discordId") || "";
      
      const cleanedData = {
        fullName: formData.fullName?.trim(),
        email: formData.email?.trim(),
        phone: phoneValidation.e164,
        gender: formData.gender,
        organization: {
          name: formData.organization?.name,
          ref: formData.organization?.ref,
          orgType: formData.organization?.orgType
        },
        role: formData.role,
        techStack: formData.skills,
        githubUrl: githubUrl || formData.githubUrl?.trim() || null,
        githubId: githubUsername || formData.githubId?.trim() || null,
        discordId: discordId || formData.discordId?.trim() || null,
        linkedinId: formData.linkedinId?.trim() || null,
        token,
        firebaseToken: phoneVerification.firebaseToken, // ✅ Include Firebase token
      };
      
      // ✅ Remove null/empty fields (but keep token and firebaseToken)
      const finalData = {};
      Object.keys(cleanedData).forEach(key => {
        // Always include token and firebaseToken
        if (key === 'token' || key === 'firebaseToken') {
          finalData[key] = cleanedData[key];
        } else if (cleanedData[key] !== null && cleanedData[key] !== "") {
          finalData[key] = cleanedData[key];
        }
      });
      
      // ✅ Debug logging
      console.log('📤 Submitting form with keys:', Object.keys(finalData));
      console.log('📤 Token:', finalData.token?.substring(0, 10) + '...');
      console.log('📤 Firebase token:', finalData.firebaseToken?.substring(0, 20) + '...');
      
      await submitForm(finalData);
      await API.delete(`/form/partial/${token}`);
      
      sessionStorage.removeItem("updateFormData");
      sessionStorage.removeItem("updateFormToken");
      sessionStorage.removeItem("oauthReturnPath");
      sessionStorage.removeItem("phoneVerificationState"); // ✅ Clear phone verification
      sessionStorage.removeItem("githubVerified");
      sessionStorage.removeItem("githubUsername");
      sessionStorage.removeItem("githubUrl");
      sessionStorage.removeItem("githubAvatar");
      sessionStorage.removeItem("discordVerified");
      sessionStorage.removeItem("discordUsername");
      sessionStorage.removeItem("discordId");
      sessionStorage.removeItem("discordAvatarUrl");
      sessionStorage.removeItem("discordNotMember");
      sessionStorage.removeItem("discordOAuthState");
      
      setStatus("submitted");
      showAlert("Form submitted successfully!", "success");
    } catch (err) {
      console.error("Submission error:", err);
      console.error("Error response:", err.response?.data);
      console.error("Error status:", err.response?.status);
      
      const errorMessage = err.response?.data?.message || "Submission failed. Please try again.";
      
      // ✅ Handle 409 Conflict (user already exists)
      if (err.response?.status === 409) {
        const userId = err.response?.data?.userId;
        showAlert(
          `This account already exists${userId ? ` (User ID: ${userId})` : ''}. ${errorMessage}`,
          "error"
        );
        return;
      }
      
      // ✅ If phone conflict error, reset phone verification so user can change number
      if (errorMessage.includes("phone number") || errorMessage.includes("already registered")) {
        setPhoneVerification({
          isVerified: false,
          showOtpInput: false,
          otp: "",
          isProcessing: false,
          firebaseToken: null,
        });
        showAlert(
          "This phone number is already registered with a different account. Please use a different number or verify with the correct account.",
          "error"
        );
      } else {
        showAlert(errorMessage, "error");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // ✅ Defer
  // ✅ Defer (with confirmation + smooth exit)
  const handleDefer = async () => {
    const confirmDefer = window.confirm(
      "Are you sure you want to defer filling this form?\nYou’ll receive a reminder email later."
    );
    if (!confirmDefer) return; // user chose No — stay on form

    try {
      await deferForm({ token });
      setFadeOut(true);
      setTimeout(() => setStatus("deferred"), 600); // fade-out animation time
    } catch (err) {
      showAlert(
        err.response?.data?.message || "Failed to defer form.",
        "error"
      );
    }
  };

  // ✅ Opt-out
  const handleOptOut = async () => {
    const confirm = await Swal.fire({
      title: "Confirm Opt-Out?",
      text: "You won’t receive future communications.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Opt Out",
      confirmButtonColor: "#d33",
    });

    if (!confirm.isConfirmed) return;

    setOptoutProcessing(true);
    try {
      await optOut({ token, reason: optoutReason });
      setOptoutProcessing(false);
      setInterested("no");
      setStatus("deferred");
      showAlert("You have been opted out successfully.", "success");
    } catch (err) {
      setOptoutProcessing(false);
      showAlert(err.response?.data?.message || "Failed to opt out.", "error");
    }
  };

  // ✅ Conditional Views
  if (status === "loading")
    return <Typography align="center">Loading form...</Typography>;
  if (status === "invalid")
    return (
      <Box
        sx={{
          minHeight: "100vh",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          bgcolor: "#f8f9fa",
          p: 2,
        }}
      >
        <Paper
          sx={{
            width: "100%",
            maxWidth: 480,
            p: 4,
            borderRadius: 3,
            boxShadow: 4,
            textAlign: "center",
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 1, mb: 1 }}>
            <FiXCircle size={28} color="#d32f2f" />
            <Typography variant="h5" color="error" fontWeight="bold">
              Invalid or Expired Link
            </Typography>
          </Box>
          <Typography variant="body1" sx={{ mb: 2 }}>
            {errorMessage || "This link is no longer valid."}
          </Typography>
          <Divider sx={{ my: 2 }} />
          <Typography variant="h6" fontWeight="bold" gutterBottom>
            What happened?
          </Typography>
          <Box sx={{ textAlign: "left", mx: 3, my: 2 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
              <FiLink size={16} color="#1976d2" />
              <Typography variant="body2">
                The link may have already been used
              </Typography>
            </Box>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
              <FiClock size={16} color="#ed6c02" />
              <Typography variant="body2">
                The link may have expired 
              </Typography>
            </Box>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
              <FiCheckCircle size={16} color="#2e7d32" />
              <Typography variant="body2">
                You may have already submitted the form
              </Typography>
            </Box>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <FiSlash size={16} color="#d32f2f" />
              <Typography variant="body2">
                You may have opted out or deferred
              </Typography>
            </Box>
          </Box>
          <Divider sx={{ my: 2 }} />
          <Typography variant="h6" fontWeight="bold" gutterBottom>
            What to do next?
          </Typography>
          <Box sx={{ textAlign: "left", mx: 3, my: 2 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
              <FiMail size={16} color="#1976d2" />
              <Typography variant="body2">
                Check your email for the latest update form link
              </Typography>
            </Box>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
              <FiClock size={16} color="#ed6c02" />
              <Typography variant="body2">
                Wait for the next reminder email (sent automatically)
              </Typography>
            </Box>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <FiMail size={16} color="#1976d2" />
              <Typography variant="body2">
                Contact support if you believe this is an error
              </Typography>
            </Box>
          </Box>
          <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: "block" }}>
            You can close this window now.
          </Typography>
        </Paper>
      </Box>
    );
  if (status === "expired")
    return (
      <Box
        sx={{
          minHeight: "100vh",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          bgcolor: "#f8f9fa",
          p: 2,
        }}
      >
        <Paper
          sx={{
            width: "100%",
            maxWidth: 480,
            p: 4,
            borderRadius: 3,
            boxShadow: 4,
            textAlign: "center",
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 1, mb: 1 }}>
            <FiClock size={28} color="#ed6c02" />
            <Typography variant="h5" color="warning.main" fontWeight="bold">
              Form Expired
            </Typography>
          </Box>
          <Typography variant="body1" sx={{ mb: 2 }}>
            Your 10-minute session has expired.
          </Typography>
          <Divider sx={{ my: 2 }} />
          <Typography variant="h6" fontWeight="bold" gutterBottom>
            What happens next?
          </Typography>
          <Box sx={{ textAlign: "left", mx: 3, my: 2 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
              <FiMail size={16} color="#1976d2" />
              <Typography variant="body2">
                You will receive a new reminder email within 24 hours
              </Typography>
            </Box>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
              <FiLink size={16} color="#1976d2" />
              <Typography variant="body2">
                Use the new link to complete your form
              </Typography>
            </Box>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
              <FiSave size={16} color="#2e7d32" />
              <Typography variant="body2">
                Your progress has been saved automatically
              </Typography>
            </Box>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <FiClock size={16} color="#ed6c02" />
              <Typography variant="body2">
                You'll have another 10 minutes when you return
              </Typography>
            </Box>
          </Box>
          <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: "block" }}>
            You can close this window now.
          </Typography>
        </Paper>
      </Box>
    );
  if (status === "submitted")
    return (
      <Box
        sx={{
          minHeight: "100vh",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          bgcolor: "#f8f9fa",
          p: 2,
        }}
      >
        <Paper
          sx={{
            width: "100%",
            maxWidth: 480,
            p: 4,
            borderRadius: 3,
            boxShadow: 4,
            textAlign: "center",
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 1, mb: 1 }}>
            <FiCheckCircle size={28} color="#2e7d32" />
            <Typography variant="h5" color="success.main" fontWeight="bold">
              Form Submitted
            </Typography>
          </Box>
          
          <Divider sx={{ my: 2 }} />
          <Typography variant="h6" fontWeight="bold" gutterBottom>
            What happened?
          </Typography>
          <Box sx={{ textAlign: "left", mx: 3, my: 2 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
              <FiCheckCircle size={16} color="#2e7d32" />
              <Typography variant="body2">
                Your form submission was completed successfully
              </Typography>
            </Box>
            <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1, mb: 1 }}>
  <FiUserCheck size={16} color="#2e7d32" style={{ marginTop: 3 }} />
  <Typography variant="body2">
    No separate signup is needed .
  </Typography>
</Box>

            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <FiLock size={16} color="#ed6c02" />
              <Typography variant="body2">
                This link can no longer be used to prevent duplicate submissions
              </Typography>
            </Box>
          </Box>
          <Divider sx={{ my: 2 }} />
          <Typography variant="h6" fontWeight="bold" gutterBottom>
            What to do next?
          </Typography>
          <Box sx={{ textAlign: "left", mx: 3, my: 2 }}>
            <Box
  sx={{
    display: "flex",
    alignItems: "flex-start",
    gap: 1,
    mb: 1,
  }}
>
  <FiInfo size={16} color="#1976d2" style={{ marginTop: 3 }} />

  <Typography variant="body2">
    You're all set!{" "}
    <Box
      component="a"
      href="https://pl-app.iiit.ac.in/c4gt/signin"
      target="_blank"
      rel="noopener noreferrer"
      sx={{
        color: "#1976d2",
        fontWeight: 700,
        fontSize: "1rem",
        textDecoration: "underline",
        "&:hover": {
          textDecoration: "underline",
          color:"#d219c9ff"
        },
      }}
    >
      Continue to login →
    </Box>
  </Typography>
</Box>

            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
              <FiInfo size={16} color="#1976d2" />
              <Typography variant="body2">
                No further action is needed
              </Typography>
            </Box>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <FiMail size={16} color="#1976d2" />
              <Typography variant="body2">
                Contact support if you need to update your information
              </Typography>
            </Box>
          </Box>
          <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: "block" }}>
            You can close this window now.
          </Typography>
        </Paper>
      </Box>
    );
  // ✅ Deferred screen (auto-close + message)
  if (status === "deferred")
    return (
      <Box
        sx={{
          minHeight: "100vh",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          bgcolor: "#f8f9fa",
          textAlign: "center",
          p: 3,
        }}
      >
        <Paper
          sx={{
            p: 4,
            borderRadius: 3,
            border: "1px solid #ddd",
            boxShadow: 3,
            maxWidth: 480,
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 1, mb: 1 }}>
            <FiAlertTriangle size={28} color="#ed6c02" />
            <Typography variant="h5" color="warning.main">
              Form Deferred
            </Typography>
          </Box>
          <Typography variant="body1" sx={{ mb: 1 }}>
            You’ve chosen to defer filling this form.
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            You can complete it later using the reminder email link we’ll send
            soon.
          </Typography>
          <Typography variant="body2" color="text.secondary">
            This window will close automatically in <b>{countdown}</b> seconds.
          </Typography>
        </Paper>
      </Box>
    );

  // ✅ Main Form UI
  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        bgcolor: "#f8f9fa",
        p: 2,
        flex: 1,
        width: "100%",
      }}
    >
      <Paper
        sx={{
          width: "100%",
          maxWidth: 480,
          p: 3,
          borderRadius: 3,
          boxShadow: 4,
          border: "1px solid #ddd",
          opacity: fadeOut ? 0 : 1,
          transition: "opacity 0.6s ease-in-out",
        }}
      >
        <Stack alignItems="center" spacing={1}>
          <Stack
            direction="row"
            spacing={3}
            alignItems="center"
            justifyContent="center"
            sx={{ mb: 1 }}
          >
            <Box
              component="img"
              src={logo1}
              alt="Badal"
              sx={{
                height: 42,
                width: "auto",
                objectFit: "contain",
              }}
            />

            <Box
              component="img"
              src={logo2}
              alt="C4GT"
              sx={{
                height: 42,
                width: "auto",
                objectFit: "contain",
              }}
            />
          </Stack>
          <Typography variant="h6" fontWeight="bold">
            Update Your Information
          </Typography>
          
          {/* Countdown Timer */}
          <Box
            sx={{
              width: "100%",
              mt: 1,
              p: 1.5,
              borderRadius: 2,
              backgroundColor: timeRemaining <= 120 ? "#ffebee" : timeRemaining <= 300 ? "#fff3e0" : "#e3f2fd",
              border: `2px solid ${timeRemaining <= 120 ? "#d32f2f" : timeRemaining <= 300 ? "#f57c00" : "#1976d2"}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 1,
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <FiClock size={20} color={timeRemaining <= 120 ? "#d32f2f" : timeRemaining <= 300 ? "#f57c00" : "#1976d2"} />
              <Typography
                sx={{
                  fontSize: "1.1rem",
                  fontWeight: "bold",
                  color: timeRemaining <= 120 ? "#d32f2f" : timeRemaining <= 300 ? "#f57c00" : "#1976d2",
                }}
              >
                Time Remaining: {Math.floor(timeRemaining / 60)}:{String(timeRemaining % 60).padStart(2, "0")}
              </Typography>
            </Box>
          </Box>
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 0.5 }}>
            {timeRemaining <= 120 && <FiAlertTriangle size={14} color="#d32f2f" />}
            <Typography
              variant="caption"
              sx={{
                color: timeRemaining <= 120 ? "#d32f2f" : "text.secondary",
                fontWeight: timeRemaining <= 120 ? "bold" : "normal",
              }}
            >
              {timeRemaining <= 120
                ? "Hurry! Your session will expire soon!"
                : "Complete the form within 10 minutes or it will expire"}
            </Typography>
          </Box>
          
          <Divider sx={{ width: "100%", my: 1 }} />
        </Stack>

        {/* Opt-in/out */}
        <FormControl fullWidth size="small" sx={{ mt: 2 }}>
          <InputLabel>Continue as part of our organization?</InputLabel>
          <Select
            value={interested ?? ""}
            label="Continue?"
            onChange={(e) => setInterested(e.target.value)}
          >
            <MenuItem value="yes">Yes, I want to continue</MenuItem>
            <MenuItem value="no">No, I want to opt out</MenuItem>
          </Select>
        </FormControl>

        {interested === "no" ? (
          <Box mt={3}>
            <Typography variant="body2">
              We're sorry to see you go. You may share feedback (optional):
            </Typography>
            <TextField
              fullWidth
              multiline
              rows={3}
              placeholder="Your reason..."
              value={optoutReason}
              onChange={(e) => setOptoutReason(e.target.value)}
              sx={{ mt: 1 }}
            />
            <Button
              fullWidth
              variant="contained"
              color="error"
              sx={{ mt: 2, borderRadius: "20px" }}
              onClick={handleOptOut}
              disabled={optoutProcessing}
            >
              {optoutProcessing ? "Processing..." : "Confirm Opt-Out"}
            </Button>
          </Box>
        ) : (
          <Box component="form" onSubmit={handleSubmit} mt={2}>
            {/* Full Name */}
            <TextField
              label="Full Name *"
              fullWidth
              size="small"
              margin="dense"
              name="fullName"
              value={formData.fullName}
              onChange={handleChange}
              required
            />

            {/* Phone */}
            <MuiTelInput
              label="Phone Number *"
              value={formData.phone}
              defaultCountry="IN"
              forceCallingCode
              focusOnSelectCountry
              fullWidth
              size="small"
              margin="dense"
              disabled={phoneVerification.isVerified}
              onChange={(value, info) => {
                if (!info) return;

                setFormData(prev => ({
                  ...prev,
                  phone: value
                }));

                // Reset verification if phone changes
                setPhoneVerification({
                  isVerified: false,
                  showOtpInput: false,
                  otp: "",
                  isProcessing: false,
                  firebaseToken: null,
                });

                sessionStorage.removeItem("phoneVerificationState");
                cleanupRecaptcha(false);
              }}
              error={formData.phone && !isValidPhoneFormat(formData.phone)}
              helperText={
                formData.phone && !isValidPhoneFormat(formData.phone)
                  ? "Enter valid phone number for selected country"
                  : ""
              }
              required
            />

            {/* Email */}
            <TextField
              label="Email "
              fullWidth
              size="small"
              margin="dense"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
            />

            {/* Gender */}
            <FormControl fullWidth size="small" margin="dense" required>
              <InputLabel>Gender *</InputLabel>
              <Select
                value={formData.gender}
                label="Gender *"
                onChange={handleChange}
                name="gender"
              >
                {GENDERS.map((g) => (
                  <MenuItem key={g} value={g}>
                    {g}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Organisation */}
            {orgLoadError ? (
              <Box sx={{ mt: 2 }}>
                <Typography color="error" fontSize={13}>
                  ❌ Unable to load organizations. Please refresh or try again later.
                </Typography>
              </Box>
            ) : (
              <Autocomplete
                options={orgOptions}
                loading={orgLoading}
                filterOptions={(x) => x}
                getOptionLabel={(o) => o.label || ""}
                isOptionEqualToValue={(option, value) =>
                  option.orgRef?.id === value.orgRef?.id &&
                  option.orgRef?.type === value.orgRef?.type
                }
                value={
                  formData.organization
                    ? {
                        label: formData.organization.name,
                        orgRef: formData.organization.ref,
                        source: formData.organization.ref?.type,
                        orgType: formData.organization.orgType
                      }
                    : null
                }
                onInputChange={(e, v) => handleOrgSearch(v)}
                onChange={(e, value) => handleOrgChange(value)}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Organisation (type to search or select)"
                    size="small"
                    margin="dense"
                    required
                    placeholder="Search for your organization..."
                  />
                )}
                sx={{ width: "100%" }}
              />
            )}

            {/* Custom Organization Input (shown when "Other" is selected) */}
            {showCustomOrg && (
              <TextField
                label="Enter Organization Name "
                fullWidth
                size="small"
                margin="dense"
                required
                value={formData.organization?.name || ""}
                onChange={(e) => {
                  isDirtyRef.current = true;
                  setFormData({
                    ...formData,
                    organization: {
                      ...formData.organization,
                      name: e.target.value,
                      ref: { type: "custom", id: null }
                    }
                  });
                }}
              />
            )}

            {/* Organization Type */}
            {showCustomOrg ? (
              <FormControl fullWidth size="small" margin="dense" required>
                <InputLabel>Organization Type</InputLabel>
                <Select
                  label="Organization Type"
                  value={formData.organization?.orgType || ""}
                  onChange={(e) => {
                    isDirtyRef.current = true;
                    setFormData({ 
                      ...formData, 
                      organization: {
                        ...formData.organization,
                        orgType: e.target.value
                      }
                    });
                  }}
                >
                  <MenuItem value="Government">Government</MenuItem>
                  <MenuItem value="Corporate">Corporate</MenuItem>
                  <MenuItem value="Academic">Academic</MenuItem>
                  <MenuItem value="NGO">NGO</MenuItem>
                  <MenuItem value="Not For Profit">Not For Profit</MenuItem>
                  <MenuItem value="For Profit">For Profit</MenuItem>
                  <MenuItem value="Self">Self</MenuItem>
                </Select>
              </FormControl>
            ) : (
              <TextField
                label="Organization Type"
                fullWidth
                size="small"
                margin="dense"
                value={formData.organization?.orgType || ""}
                InputProps={{ readOnly: true }}
              />
            )}

            {/* Role */}
            <FormControl fullWidth size="small" margin="dense" required>
              <InputLabel>Role *</InputLabel>
              <Select
                value={formData.role}
                label="Role "
                name="role"
                onChange={(e) =>
                  setFormData({ ...formData, role: e.target.value })
                }
              >
                {ROLES.map((r) => (
                  <MenuItem key={r.value} value={r.value}>
                    {r.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Tech Skills - Collapsed */}
            <Box sx={{ mt: 2, border: '1px solid #e0e0e0', borderRadius: 1 }}>
              {(() => {
                const isTechStackComplete = formData.skills?.length >= 1 && formData.skills?.length <= 6;
                
                return (
                  <Box
                    sx={{
                      p: 1.5,
                      cursor: 'pointer',
                      bgcolor: '#f5f5f5',
                      borderRadius: '4px 4px 0 0',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                    onClick={() => setFormData({ ...formData, _skillsOpen: !formData._skillsOpen })}
                  >
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <Typography fontWeight="bold" fontSize={14}>
                        Tech Skills ({formData.skills?.length || 0})
                      </Typography>

                      <Fade in={isTechStackComplete}>
                        <Box>
                          <FiCheckCircle size={16} color="#2e7d32" />
                        </Box>
                      </Fade>
                    </Box>

                    <Typography>{formData._skillsOpen ? '▲' : '▼'}</Typography>
                  </Box>
                );
              })()}
              {formData._skillsOpen && (
                <Box sx={{ p: 1.5 }}>
                  <Box
                    sx={{
                      animation: shakeSkills ? `${shake} 0.4s ease` : "none"
                    }}
                  >
                    <Autocomplete
                      multiple
                      options={SKILLS}
                      value={formData.skills || []}
                      disableCloseOnSelect
                      limitTags={3}
                      getOptionDisabled={(option) =>
                        formData.skills.length >= 6 && !formData.skills.includes(option)
                      }
                      onChange={(event, newValue) => {
                        isDirtyRef.current = true;

                        if (newValue.length <= 6) {
                          setFormData({ ...formData, skills: newValue });
                        } else {
                          // Trigger shake
                          setShakeSkills(true);
                          setTimeout(() => setShakeSkills(false), 400);
                        }
                      }}
                    renderInput={(params) => {
                      const isMaxReached = formData.skills.length === 6;

                      return (
                        <TextField
                          {...params}
                          label="Select up to 6 skills *"
                          placeholder="Choose your skills"
                          size="small"
                          error={isMaxReached}
                          helperText={
                            isMaxReached
                              ? "Maximum 6 skills reached"
                              : `Select up to 6 skills (${formData.skills.length}/6)`
                          }
                          FormHelperTextProps={{
                            sx: {
                              color: isMaxReached ? "#d32f2f" : "text.secondary",
                              fontWeight: isMaxReached ? 600 : 400,
                            },
                          }}
                        />
                      );
                    }}
                    />
                  </Box>
                </Box>
              )}
            </Box>

            {/* Social - Collapsed */}
            <Box sx={{ mt: 2, border: '1px solid #e0e0e0', borderRadius: 1 }}>
              {(() => {
                const isSocialFullyVerified = githubStatus.verified && discordVerified;
                
                return (
                  <Box
                    sx={{
                      p: 1.5,
                      cursor: 'pointer',
                      bgcolor: '#f5f5f5',
                      borderRadius: '4px 4px 0 0',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                    onClick={() => setFormData({ ...formData, _socialOpen: !formData._socialOpen })}
                  >
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <Typography fontWeight="bold" fontSize={14}>
                        Social Accounts
                      </Typography>

                      {isSocialFullyVerified && (
                        <FiCheckCircle size={16} color="#2e7d32" />
                      )}
                    </Box>

                    <Typography>{formData._socialOpen ? '▲' : '▼'}</Typography>
                  </Box>
                );
              })()}
              {formData._socialOpen && (
                <Box sx={{ p: 1.5 }}>
                  {/* GitHub Section */}
                  <Typography fontWeight="bold" fontSize={14} mb={1}>
                    GitHub:
                  </Typography>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1, width: "100%", mt: 1 }}>
              <Button
                fullWidth
                variant="contained"
                onClick={handleVerifyGithub}
                disabled={githubStatus.verified || githubStatus.verifying}
                sx={{
                  borderRadius: "10px",
                  fontWeight: "bold",
                  backgroundColor: githubStatus.verified ? "#4CAF50" : "#000",
                  color: "white",
                  "&:disabled": {
                    backgroundColor: githubStatus.verified ? "#4CAF50" : "#9e9e9e",
                    color: "white",
                  },
                }}
              >
                {githubStatus.verified ? "GitHub Verified ✓" : "Verify GitHub"}
              </Button>

              {githubStatus.verified && (
                <Typography fontSize={13} color="#2e7d32">
                  ✓ Verified as: {githubStatus.username}
                </Typography>
              )}

              {!githubStatus.verified && githubStatus.error && (
                <Typography fontSize={13} color="#d32f2f">
                  ❌ {githubStatus.error}
                </Typography>
              )}
            </Box>

            {/* Discord Section */}
            <Typography fontWeight="bold" fontSize={14} mt={2} mb={1}>
              Discord:
            </Typography>
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1, width: "100%", mt: 1 }}>
              {discordVerified ? (
                <>
                  <Button
                    fullWidth
                    variant="contained"
                    disabled
                    sx={{
                      borderRadius: "10px",
                      fontWeight: "bold",
                      backgroundColor: "#4CAF50",
                      color: "white",
                      "&.Mui-disabled": {
                        backgroundColor: "#4CAF50",
                        color: "white",
                      },
                    }}
                  >
                    DISCORD VERIFIED ✓
                  </Button>

                  <Typography fontSize={13} color="#2e7d32">
                    ✓ Verified as: {sessionStorage.getItem("discordUsername")}
                  </Typography>
                </>
              ) : (
                <>
                  <Button
                    fullWidth
                    variant="contained"
                    sx={{
                      borderRadius: "10px",
                      fontWeight: "bold",
                      backgroundColor: "#1E4DD8",
                      "&:hover": { backgroundColor: "#1536A1" },
                    }}
                    onClick={handleVerifyDiscord}
                    disabled={discordStatus.verifying}
                    startIcon={discordStatus.verifying ? <CircularProgress size={20} color="inherit" /> : null}
                  >
                    {discordStatus.verifying ? "REDIRECTING..." : "VERIFY DISCORD"}
                  </Button>

                  {discordNotMember && (
                    <>
                      <Button
                        fullWidth
                        variant="outlined"
                        sx={{ borderRadius: "10px", fontWeight: "bold" }}
                        onClick={() => window.open(DISCORD_INVITE, "_blank")}
                      >
                        JOIN DISCORD SERVER
                      </Button>
                      <Typography fontSize={13} color="#d32f2f">
                        ❌ You must join our Discord server before verification.
                      </Typography>
                    </>
                  )}
                </>
              )}
            </Box>

                  {/* LinkedIn Section */}
                  <Typography fontWeight="bold" fontSize={14} mt={2} mb={1}>
                    LinkedIn URL (Optional):
                  </Typography>
                  <Box sx={{ display: "flex", flexDirection: "column", gap: 1, width: "100%" }}>
                    <TextField
                      label="Enter LinkedIn profile URL"
                      placeholder="https://www.linkedin.com/in/username"
                      value={formData.linkedinId}
                      onChange={(e) => setFormData({ ...formData, linkedinId: e.target.value })}
                      size="small"
                      fullWidth
                    />
                  </Box>
                </Box>
              )}
            </Box>

            {/* OTP Section - Compact */}
            <Box mt={2}>
              <Typography fontWeight="bold" fontSize={14} mb={1}>
                Phone Verification:
              </Typography>
              <div id="recaptcha-container-update"></div>
              {!phoneVerification.isVerified && (
                <Stack direction="row" spacing={1} mt={1}>
                  <Button
                    variant="outlined"
                    fullWidth
                    onClick={handleRequestOtp}
                    disabled={phoneVerification.isProcessing || timer > 0}
                  >
                    {timer > 0
                      ? `Resend in ${timer}s`
                      : phoneVerification.isProcessing
                      ? "Sending..."
                      : phoneVerification.showOtpInput
                      ? "Resend OTP"
                      : "Send OTP"}
                  </Button>
                  {phoneVerification.showOtpInput && (
                    <TextField
                      label="Enter 6-digit OTP"
                      size="small"
                      value={phoneVerification.otp}
                      onChange={(e) => {
                        const onlyNums = e.target.value.replace(/\D/g, "");
                        if (onlyNums.length <= 6)
                          setPhoneVerification({
                            ...phoneVerification,
                            otp: onlyNums,
                          });
                      }}
                      inputProps={{
                        inputMode: "numeric",
                        pattern: "[0-9]*",
                        maxLength: 6,
                        onKeyPress: (e) => {
                          if (!/[0-9]/.test(e.key)) e.preventDefault();
                        },
                      }}
                    />
                  )}
                  {phoneVerification.showOtpInput && (
                    <Button
                      variant="contained"
                      color="primary"
                      onClick={handleVerifyOtp}
                      disabled={phoneVerification.isProcessing}
                    >
                      {phoneVerification.isProcessing ? (
                        <CircularProgress size={18} color="inherit" />
                      ) : (
                        "Verify"
                      )}
                    </Button>
                  )}
                </Stack>
              )}
              {phoneVerification.isVerified && (
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 1 }}>
                  <FiCheckCircle size={18} color="#2e7d32" />
                  <Typography color="success.main">
                    Phone verified successfully!
                  </Typography>
                </Box>
              )}
            </Box>

            {/* Actions */}
            <Stack direction="row" spacing={2} mt={3}>
              <Button
                type="submit"
                variant="contained"
                color="primary"
                fullWidth
                disabled={!isFormComplete()}
              >
                Submit
              </Button>
              <Button 
                variant="outlined" 
                fullWidth 
                onClick={handleDefer}
                disabled={oauthInProgress}
              >
                Defer
              </Button>
            </Stack>
          </Box>
        )}
      </Paper>
    </Box>
  );
};

export default UpdateForm;
