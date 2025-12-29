// src/pages/Auth/SignUpPage.jsx

import React, { useState, useEffect } from "react";
import {
  Box,
  TextField,
  Typography,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Checkbox,
  Divider,
  Stack,
  CircularProgress,
  Stepper,
  Step,
  StepLabel,
  Paper
} from "@mui/material";
import { useNavigate } from "react-router-dom";
import {
  GithubAuthProvider,
  signInWithPopup,
  getAdditionalUserInfo,
  signOut,
} from "firebase/auth";
import { auth, signInWithPhoneNumber } from "../../firebase";
import { setupRecaptcha } from "../../utils/setupRecaptcha";
import { cleanupRecaptcha, } from "../../utils/recaptchaCleanup";
import { resetRecaptcha } from "../../utils/setupRecaptcha";
import { requestOtp } from "../../api/apiService";
import hero1 from "../../assets/white.png";
import hero2 from "../../assets/badal_final.png";
import Swal from "sweetalert2";
import Autocomplete from "@mui/material/Autocomplete";
import "../../styles/verifyAnimations.css";

// ---------- CONSTANTS ----------
const ORGANIZATIONS = [
  "Self",
  "Government of India",
  "NITI Aayog",
  "Indian Institute of Technology",
  "Indian Institute of Science",
  "Microsoft India",
  "Google India",
  "TCS",
  "Infosys",
  "Wipro",
  "Other",
];

const ORG_TYPE_MAPPINGS = {
  "Government of India": "Government",
  "NITI Aayog": "Government",
  "Indian Institute of Technology": "Academic",
  "Indian Institute of Science": "Academic",
  "Microsoft India": "Corporate",
  "Google India": "Corporate",
  TCS: "Corporate",
  Infosys: "Corporate",
  Wipro: "Corporate",
  Self: "Self",
};

const ROLES = [
  { label: "Program Coordinator", value: "R002" },
  { label: "Organization Manager", value: "R003" },
  { label: "Mentor", value: "R005" },
  { label: "Developer", value: "R004" },
];

const GENDERS = ["Male", "Female", "Other", "Prefer not to say"];

// Validation regex patterns
const githubRegex = /^https:\/\/(www\.)?github\.com\/[A-Za-z0-9_-]+\/?$/;
const linkedinRegex = /^https:\/\/(www\.)?linkedin\.com\/in\/[A-Za-z0-9_-]+\/?$/;
const discordTagRegex = /^.{2,32}#[0-9]{1,4}$/;
const discordUrlRegex = /^https:\/\/(www\.)?discord\.com\/users\/\d+\/?$/;

const DISCORD_REDIRECT =
   "http://127.0.0.1:3000/rcts/codeforgovtech/discord-callback";

const steps = ["Contact Info", "Affiliation", "Social & Verification"];

const SignUpPage = () => {
  const navigate = useNavigate();
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [activeStep, setActiveStep] = useState(() => {
    const savedStep = sessionStorage.getItem("activeStep");
    return savedStep ? parseInt(savedStep, 10) : 0;
  });

  // Discord server invite - matches DISCORD_GUILD_ID: 973851473131761674
  const DISCORD_INVITE = "https://discord.gg/BsbzbUHz";

  const DISCORD_OAUTH =
    "https://discord.com/oauth2/authorize" +
    "?client_id=1450787791834447874" +
    "&redirect_uri=" +
    encodeURIComponent(DISCORD_REDIRECT) +
    "&response_type=code" +
    "&scope=identify%20guilds";

  const [phoneCheckStatus, setPhoneCheckStatus] = useState({
    checking: false,
    exists: false,
    message: "",
  });

  const [showCustomOrg, setShowCustomOrg] = useState(false);
  const [discordVerified, setDiscordVerified] = useState(
    sessionStorage.getItem("discordVerified") === "true"
  );
  const [discordNotMember, setDiscordNotMember] = useState(
    sessionStorage.getItem("discordNotMember") === "true"
  );

  const initialFormData = {
    fullName: "",
    phone: "",
    email: "",
    gender: "",
    organisation: "",
    orgType: "",
    role: "",
    githubUrl: "",
    githubId: "",
    discordId: "",
    linkedinId: "",
    termsAccepted: false,
  };

  // navigation flag for preserving data
  const isNavigatingBack = sessionStorage.getItem("isNavigating");
  const cameFromTermsOnLoad = sessionStorage.getItem("cameFromTerms");

  const [data, setData] = useState(() => {
    // Restore data if coming back from navigation (OTP, Discord, Terms)
    if (isNavigatingBack === "true" || cameFromTermsOnLoad === "true") {
      const savedData = sessionStorage.getItem("signupFormData");
      sessionStorage.removeItem("isNavigating");
      return savedData ? JSON.parse(savedData) : initialFormData;
    }
    sessionStorage.removeItem("signupFormData");
    return initialFormData;
  });

  const [githubStatus, setGithubStatus] = useState({
    verifying: false,
    verified: false,
    username: "",
    error: "",
  });

  const [githubCancelled, setGithubCancelled] = useState(false);
  const [discordCancelled, setDiscordCancelled] = useState(false);

  // Clear signup data when manually opening /signup
  useEffect(() => {
  const fromSignIn = sessionStorage.getItem("fromSignIn");
  const cameFromOtp = sessionStorage.getItem("cameFromOtp");
  const cameFromDiscord = sessionStorage.getItem("cameFromDiscord");
  const cameFromTerms = sessionStorage.getItem("cameFromTerms");

  // Detect if the page is reloaded (F5 or Ctrl+R or browser refresh)
  const navigation = performance.getEntriesByType("navigation")[0];
  const isReload = navigation?.type === "reload";

  // Coming from sign-in → full reset
  if (fromSignIn) {
    sessionStorage.removeItem("fromSignIn");

    sessionStorage.removeItem("signupFormData");
    sessionStorage.removeItem("githubVerified");
    sessionStorage.removeItem("githubUsername");
    sessionStorage.removeItem("githubUrl");
    sessionStorage.removeItem("githubId");

    sessionStorage.removeItem("discordVerified");
    sessionStorage.removeItem("discordUsername");
    sessionStorage.removeItem("discordAvatarUrl");
    sessionStorage.removeItem("discordId");
    sessionStorage.removeItem("discordNotMember");

    sessionStorage.removeItem("activeStep");

    // Also reset component state so UI clears immediately
    try {
      setData(initialFormData);
    } catch (e) {}
    try {
      setActiveStep(0);
    } catch (e) {}
    try {
      setGithubStatus({ verifying: false, verified: false, username: "", error: "" });
    } catch (e) {}
    try {
      setDiscordVerified(false);
      setDiscordNotMember(false);
    } catch (e) {}

    return;
  }

  // Page refresh → keep all data
  if (isReload) {
    return;
  }

  // Returning from OAuth or Terms → keep all data
  if (cameFromOtp || cameFromDiscord || cameFromTerms) {
    sessionStorage.removeItem("cameFromTerms");
    return;
  }

  // Fresh visit to /signup → full reset
  sessionStorage.removeItem("signupFormData");
  sessionStorage.removeItem("githubVerified");
  sessionStorage.removeItem("githubUsername");
  sessionStorage.removeItem("githubUrl");
  sessionStorage.removeItem("githubId");

  sessionStorage.removeItem("discordVerified");
  sessionStorage.removeItem("discordUsername");
  sessionStorage.removeItem("discordAvatarUrl");
  sessionStorage.removeItem("discordId");
  sessionStorage.removeItem("discordNotMember");

  sessionStorage.removeItem("activeStep");
}, []);

  // Discord from session
  useEffect(() => {
    const verified = sessionStorage.getItem("discordVerified") === "true";
    const notMember = sessionStorage.getItem("discordNotMember") === "true";

    setDiscordVerified(verified);
    setDiscordNotMember(notMember);

    if (verified) {
      const discordId = sessionStorage.getItem("discordId");
      if (discordId) {
        setData((prev) => ({ ...prev, discordId: discordId }));
      }
    }
  }, []);

  // Handle Discord cancellation
  useEffect(() => {
    if (sessionStorage.getItem("discord_cancelled") === "true") {
      setDiscordCancelled(true);
      sessionStorage.removeItem("discord_cancelled");
      setTimeout(() => setDiscordCancelled(false), 2500);
    }
    if (sessionStorage.getItem("github_cancelled") === "true") {
      setGithubCancelled(true);
      sessionStorage.removeItem("github_cancelled");
      setTimeout(() => setGithubCancelled(false), 2500);
    }
  }, []);

  // Save form data on unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (window?.performance?.navigation?.type !== 1) {
        sessionStorage.setItem("signupFormData", JSON.stringify(data));
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () =>
      window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [data]);

  // Real-time phone number validation
  useEffect(() => {
    const checkPhone = async () => {
      if (!/^\d{10}$/.test(data.phone)) {
        setPhoneCheckStatus({ checking: false, exists: false, message: "" });
        return;
      }

      setPhoneCheckStatus({
        checking: true,
        exists: false,
        message: "Checking...",
      });

      try {
        const result = await requestOtp({
          phone: data.phone
          // ❌ do NOT send email here
        });

        if (result?.exists === true && result.reason === "phone") {
          setPhoneCheckStatus({
            checking: false,
            exists: true,
            message: "Phone already registered",
          });
          return;
        }

        setPhoneCheckStatus({
          checking: false,
          exists: false,
          message: "Available",
        });

      } catch {
        setPhoneCheckStatus({
          checking: false,
          exists: false,
          message: "",
        });
      }
    };

    const timer = setTimeout(() => {
      if (data.phone) checkPhone();
    }, 800);

    return () => clearTimeout(timer);
  }, [data.phone]);

  // Restore GitHub verified data
  useEffect(() => {
    const verified = sessionStorage.getItem("githubVerified") === "true";
    const username = sessionStorage.getItem("githubUsername");
    const url = sessionStorage.getItem("githubUrl");
    const githubId = sessionStorage.getItem("githubId");

    if (verified && username && url) {
      setGithubStatus({
        verifying: false,
        verified: true,
        username,
        error: "",
      });

      setData((prev) => ({ 
        ...prev, 
        githubUrl: url,
        githubId: githubId || null 
      }));
    }
  }, []);

  // Signup reCAPTCHA init
  useEffect(() => {
    if (activeStep === 2) {
      setTimeout(() => {
        try {
          if (!window.recaptchaVerifier) {
            setupRecaptcha(auth, "recaptcha-container-signup");
          }
        } catch (err) {
          console.log("reCAPTCHA setup failed:", err);
        }
      }, 300);
    }
  }, [activeStep]);

  // Destroy reCAPTCHA when leaving step 2
  useEffect(() => {
    if (activeStep !== 2) {
      cleanupRecaptcha();
      resetRecaptcha();
    }
  }, [activeStep]);

  const handleOrgChange = (org) => {
    if (!org) {
      setShowCustomOrg(false);
      setData({ ...data, organisation: "", orgType: "" });
      return;
    }

    if (org === "Other") {
      setShowCustomOrg(true);
      setData({ ...data, organisation: "", orgType: "" });
    } else {
      setShowCustomOrg(false);
      const orgType = ORG_TYPE_MAPPINGS[org] || "";
      setData({ ...data, organisation: org, orgType });
    }
  };

  const handleVerifyGithub = async () => {
    setGithubStatus({
      verifying: true,
      verified: false,
      username: "",
      error: "",
    });

    try {
      const provider = new GithubAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const info = getAdditionalUserInfo(result);
      const githubUsername = info?.username;
      const githubNumericId = info?.profile?.id; // GitHub's numeric user ID

      if (!githubUsername) throw new Error("Unable to retrieve GitHub username");

      const verifiedUrl = `https://github.com/${githubUsername}`;

      setData((prev) => ({ 
        ...prev, 
        githubUrl: verifiedUrl,
        githubId: githubNumericId ? String(githubNumericId) : null 
      }));

      sessionStorage.setItem("githubVerified", "true");
      sessionStorage.setItem("githubUsername", githubUsername);
      sessionStorage.setItem("githubUrl", verifiedUrl);
      sessionStorage.setItem("githubId", githubNumericId ? String(githubNumericId) : "");

      setGithubStatus({
        verifying: false,
        verified: true,
        username: githubUsername,
        error: "",
      });

      await signOut(auth);
    } catch (err) {
      console.error("GitHub verify error:", err);
      
      if (err.code === "auth/popup-closed-by-user") {
        sessionStorage.setItem("github_cancelled", "true");
        setGithubStatus({
          verifying: false,
          verified: false,
          username: "",
          error: "",
        });
        Swal.fire({
          icon: "warning",
          title: "Verification Cancelled",
          text: "GitHub verification was cancelled. Please try again.",
          confirmButtonColor: "#1E4DD8"
        });
        return;
      }

      let errorMessage = "Failed to verify GitHub account. Please try again.";
      if (err.code === "auth/popup-blocked") {
        errorMessage = "Popup was blocked. Please allow popups for this site and try again.";
      } else if (err.code === "auth/cancelled-popup-request") {
        errorMessage = "Verification cancelled. Please try again.";
      }

      Swal.fire({
        icon: "error",
        title: "GitHub Verification Failed",
        text: errorMessage,
        confirmButtonColor: "#1E4DD8"
      });
      
      setGithubStatus({
        verifying: false,
        verified: false,
        username: "",
        error: "",
      });
    }
  };

  // ------- PER-STEP VALIDATION -------

  const validateStep0 = () => {
    if (!data.fullName.trim()) {
      Swal.fire("Warning", "Please enter your full name to continue", "warning");
      return false;
    }
    if (!/^\d{10}$/.test(data.phone)) {
      Swal.fire("Warning", "Please enter a valid 10-digit phone number", "warning");
      return false;
    }
    if (phoneCheckStatus.exists) {
      Swal.fire(
        "Info",
        "Phone number already registered. Please sign in instead.",
        "info"
      );
      return false;
    }
    if (!data.email.includes("@")) {
      Swal.fire("Warning", "Please enter a valid email address", "warning");
      return false;
    }
    if (!data.gender) {
      Swal.fire("Warning", "Please select your gender to continue", "warning");
      return false;
    }
    return true;
  };

  const validateStep1 = () => {
    if (!data.organisation) {
      Swal.fire("Warning", "Please select or enter your organisation", "warning");
      return false;
    }
    if (!data.role) {
      Swal.fire("Warning", "Please select your role to continue", "warning");
      return false;
    }
    return true;
  };

  const validateSocialBeforeSubmit = () => {
    if (!data.githubUrl || data.githubUrl.trim() === "") {
      Swal.fire("Warning", "GitHub URL is required", "warning");
      return false;
    }
    if (!githubRegex.test(data.githubUrl)) {
      Swal.fire("Warning", "Enter a valid GitHub URL", "warning");
      return false;
    }
    if (!githubStatus.verified) {
      Swal.fire("Warning", "Please verify your GitHub profile", "warning");
      return false;
    }

    if (sessionStorage.getItem("discordVerified") !== "true") {
      Swal.fire("Warning", "Please verify your Discord account", "warning");
      return false;
    }

    const verifiedDiscordId = sessionStorage.getItem("discordId");
    if (verifiedDiscordId) {
      data.discordId = verifiedDiscordId;
    }

    if (
      data.linkedinId &&
      !linkedinRegex.test(data.linkedinId)
    ) {
      Swal.fire("Warning", "Invalid LinkedIn URL format", "warning");
      return false;
    }

    const isDiscordVerified =
      sessionStorage.getItem("discordVerified") === "true";
    if (
      data.discordId &&
      !isDiscordVerified &&
      !discordTagRegex.test(data.discordId) &&
      !discordUrlRegex.test(data.discordId)
    ) {
      Swal.fire("Warning", "Invalid Discord format", "warning");
      return false;
    }

    if (!data.termsAccepted) {
      Swal.fire("Warning", "Accept Terms & Conditions", "warning");
      return false;
    }

    return true;
  };

  const handleNext = () => {
    if (activeStep === 0 && !validateStep0()) return;
    if (activeStep === 1 && !validateStep1()) return;

    // Clear OAuth flags when user manually proceeds to next step
    sessionStorage.removeItem("cameFromOtp");
    sessionStorage.removeItem("cameFromDiscord");
    
    setActiveStep((prev) => prev + 1);
  };

  const handleBackStep = () => {
    // Clear OAuth flags when user navigates back
    sessionStorage.removeItem("cameFromOtp");
    sessionStorage.removeItem("cameFromDiscord");
    
    setActiveStep((prev) => Math.max(prev - 1, 0));
  };
  const silentValidateStep0 = () =>
  data.fullName.trim() &&
  /^\d{10}$/.test(data.phone) &&
  data.email.includes("@") &&
  data.gender;

const silentValidateStep1 = () =>
  data.organisation &&
  data.role;

const silentValidateStep2 = () =>
  data.termsAccepted &&
  githubStatus.verified &&
  sessionStorage.getItem("discordVerified") === "true" &&
  (!data.linkedinId || linkedinRegex.test(data.linkedinId));

const isSignupAllowed = () =>
  silentValidateStep0() &&
  silentValidateStep1() &&
  silentValidateStep2();


  // ------- FINAL SUBMIT (OTP SEND) -------

    const handleSubmit = async () => {
  // Step 1: Validate form fields per step
  if (!validateStep0()) return;
  if (!validateStep1()) return;
  if (!validateSocialBeforeSubmit()) return;

  // Step 2: Check if phone/email already exist — BEFORE sending OTP
  setIsSendingOtp(true);

  try {
    const preCheck = await requestOtp({
      phone: data.phone,
      email: data.email, // now included
    });

    if (preCheck.exists === true) {
      // Clear OTP state to avoid confusion
      setIsSendingOtp(false);
      
      if (preCheck.reason === "email") {
        Swal.fire("Email already exists", preCheck.message, "info");
        return;
      }

      if (preCheck.reason === "phone" || preCheck.reason === "both") {
        Swal.fire("Phone already exists", preCheck.message, "info");
        return;
      }
    }

    // Step 3: Only if new user → proceed with OTP
    if (!window.recaptchaVerifier) {
      await setupRecaptcha(auth, "recaptcha-container-signup");
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    if (!window.recaptchaVerifier) {
      throw new Error("reCAPTCHA not initialized. Please refresh and try again.");
    }

    const phoneNumber = `+91${data.phone}`;
    const confirmationResult = await signInWithPhoneNumber(
      auth,
      phoneNumber,
      window.recaptchaVerifier
    );

    sessionStorage.setItem("verificationId", confirmationResult.verificationId);
    sessionStorage.setItem("signupFormData", JSON.stringify(data));
    sessionStorage.setItem("isNavigating", "true");

    Swal.fire({
      icon: "success",
      title: "OTP Sent!",
      text: "Check your phone for the verification code",
      timer: 2000,
      showConfirmButton: false,
    });

    navigate("/verify-otp", { state: { phone: data.phone } });
  } catch (err) {
    let msg = err.message || "An error occurred";
    if (msg.includes("too-many-requests"))
      msg = "Too many attempts. Try later.";
    else if (msg.includes("invalid-phone-number"))
      msg = "Invalid phone number format.";
    else if (msg.includes("reCAPTCHA")) 
      msg = "reCAPTCHA failed. Please refresh and try again.";

    Swal.fire("Error", msg, "error");

    // Cleanup and reinit reCAPTCHA on error
    cleanupRecaptcha();
    resetRecaptcha();
    setTimeout(async () => {
      try {
        await setupRecaptcha(auth, "recaptcha-container-signup");
      } catch (e) {
        console.warn("Error reinitializing reCAPTCHA:", e);
      }
    }, 500);
  } finally {
    setIsSendingOtp(false);
  }
};
  // ---
  // ------- JSX FOR STEPS -------

  const renderStepContent = () => {
    if (activeStep === 0) {
      // CONTACT INFO
      return (
        <>
          <Typography
            fontWeight="bold"
            fontSize={14}
            mb={1}
            alignSelf="flex-start"
          >
            Contact Info
          </Typography>

          <Stack direction={{ xs: "column", sm: "row" }} spacing={2} width="100%">
            <TextField
              label="Full Name"
              fullWidth
              size="small"
              margin="dense"
              value={data.fullName}
              onChange={(e) =>
                setData({ ...data, fullName: e.target.value })
              }
              required
            />
          </Stack>

          <TextField
            label="Phone"
            fullWidth
            size="small"
            margin="dense"
            value={data.phone}
            onChange={(e) => {
              if (/^\d{0,10}$/.test(e.target.value))
                setData({ ...data, phone: e.target.value });
            }}
            error={phoneCheckStatus.exists}
            helperText={
              phoneCheckStatus.checking ? (
                <span style={{ color: "#1976d2" }}>
                  ⏳ Checking availability...
                </span>
              ) : phoneCheckStatus.exists ? (
                <span style={{ color: "#d32f2f" }}>
                  ❌ Phone already registered. Please sign in.
                </span>
              ) : phoneCheckStatus.message === "Available" &&
                data.phone.length === 10 ? (
                <span style={{ color: "#2e7d32" }}>✓ Available</span>
              ) : (
                ""
              )
            }
            InputProps={{
              endAdornment: phoneCheckStatus.checking ? (
                <CircularProgress size={20} />
              ) : null,
            }}
            required
          />

          <TextField
            label="Email"
            fullWidth
            size="small"
            margin="dense"
            value={data.email}
            onChange={(e) => setData({ ...data, email: e.target.value })}
            required
          />

          <FormControl fullWidth size="small" margin="dense" required>
            <InputLabel>Gender</InputLabel>
            <Select
              label="Gender"
              value={data.gender}
              onChange={(e) =>
                setData({ ...data, gender: e.target.value })
              }
            >
              {GENDERS.map((g) => (
                <MenuItem key={g} value={g}>
                  {g}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </>
      );
    }

    if (activeStep === 1) {
      // AFFILIATION
      return (
        <>
          <Typography
            fontWeight="bold"
            fontSize={14}
            mb={1}
            alignSelf="flex-start"
          >
            Affiliation
          </Typography>

          <Autocomplete
            disablePortal
            options={ORGANIZATIONS}
            value={data.organisation || (showCustomOrg ? "Other" : "")}
            onChange={(e, newValue) => handleOrgChange(newValue)}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Organisation"
                required
                fullWidth
                size="small"
                margin="dense"
              />
            )}
            sx={{ width: "100%" }}
          />

          {showCustomOrg && (
            <TextField
              label="Enter Organisation Name"
              fullWidth
              size="small"
              margin="dense"
              required
              value={data.organisation}
              onChange={(e) =>
                setData({ ...data, organisation: e.target.value })
              }
            />
          )}

          {showCustomOrg ? (
            <FormControl fullWidth size="small" margin="dense" required>
              <InputLabel>Organisation Type</InputLabel>
              <Select
                label="Organisation Type"
                value={data.orgType}
                onChange={(e) =>
                  setData({ ...data, orgType: e.target.value })
                }
              >
                <MenuItem value="Government">Government</MenuItem>
                <MenuItem value="Corporate">Corporate</MenuItem>
                <MenuItem value="Academic">Academic</MenuItem>
                <MenuItem value="NGO">NGO</MenuItem>
                <MenuItem value="Self">Self</MenuItem>
              </Select>
            </FormControl>
          ) : (
            <TextField
              label="Organisation Type"
              fullWidth
              size="small"
              margin="dense"
              value={data.orgType}
              InputProps={{ readOnly: true }}
            />
          )}

          <FormControl fullWidth size="small" margin="dense" required>
            <InputLabel>Role</InputLabel>
            <Select
              label="Role"
              value={data.role}
              onChange={(e) =>
                setData({ ...data, role: e.target.value })
              }
            >
              {ROLES.map((r) => (
                <MenuItem key={r.value} value={r.value}>
                  {r.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </>
      );
    }

    // STEP 2: SOCIAL & TERMS
    return (
      <>
        <Typography
          fontWeight="bold"
          fontSize={14}
          mb={1}
          alignSelf="flex-start"
        >
          Social & Verification
        </Typography>

        {/* GitHub */}
        <Typography
          fontWeight="bold"
          fontSize={14}
          mt={2}
          mb={1}
          alignSelf="flex-start"
        >
          GitHub
        </Typography>

        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            gap: 1,
            width: "100%",
            mt: 1,
          }}
        >
          {!githubStatus.verified ? (
            <Button
              fullWidth
              variant="contained"
              onClick={handleVerifyGithub}
              className={githubCancelled ? "verify-shake" : ""}
              disabled={githubStatus.verifying}
              sx={{
                borderRadius: "10px",
                fontWeight: "bold",
                backgroundColor: "#000",
                color: "white",
                "&:hover": { backgroundColor: "#333" },
              }}
            >
              {githubStatus.verifying ? "Verifying..." : "VERIFY GITHUB"}
            </Button>
          ) : (
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 2,
                p: 1.5,
                borderRadius: 2,
                backgroundColor: "#e8f5e9",
                border: "1px solid #4caf50",
              }}
            >
              <img
                src="https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png"
                alt="GitHub logo"
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: "50%",
                }}
              />

              <Typography fontWeight="bold" color="#2e7d32">
                {githubStatus.username}
              </Typography>

              <Typography
                sx={{
                  ml: "auto",
                  background: "#4caf50",
                  color: "white",
                  px: 1.5,
                  py: 0.5,
                  borderRadius: 1,
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                Verified ✓
              </Typography>
            </Box>
          )}

          {githubCancelled && (
            <Box
              className="verify-error"
              sx={{
                mt: 1,
                padding: "10px 12px",
                borderRadius: "8px",
                border: "1px solid #ef5350",
                background: "#ffebee",
              }}
            >
              <Typography color="#d32f2f" fontSize={13} fontWeight="600">
                ❌ GitHub verification cancelled
              </Typography>
            </Box>
          )}
        </Box>

        {/* Discord */}
        <Typography
          fontWeight="bold"
          fontSize={14}
          mt={3}
          mb={1}
          alignSelf="flex-start"
        >
          Discord
        </Typography>

        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            gap: 1,
            width: "100%",
            mt: 1,
          }}
        >
          {discordVerified ? (
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 2,
                p: 1.5,
                borderRadius: 2,
                backgroundColor: "#e8f5e9",
                border: "1px solid #4caf50",
              }}
            >
              <img
                src={sessionStorage.getItem("discordAvatarUrl")}
                alt="Discord avatar"
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: "50%",
                }}
              />

              <Typography fontWeight="bold" color="#2e7d32">
                {sessionStorage.getItem("discordUsername")}
              </Typography>

              <Typography
                sx={{
                  ml: "auto",
                  background: "#4caf50",
                  color: "white",
                  px: 1.5,
                  py: 0.5,
                  borderRadius: 1,
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                Verified ✓
              </Typography>
            </Box>
          ) : (
            <>
              <Button
                fullWidth
                variant="contained"
                className={discordCancelled ? "verify-shake" : ""}
                sx={{
                  borderRadius: "10px",
                  fontWeight: "bold",
                  backgroundColor: "#1E4DD8",
                  "&:hover": { backgroundColor: "#1536A1" },
                }}
                onClick={() => {
                  sessionStorage.setItem(
                    "signupFormData",
                    JSON.stringify(data)
                  );
                  sessionStorage.setItem("activeStep", "2");
                  sessionStorage.setItem("cameFromDiscord", "true");
                  sessionStorage.setItem("oauthReturnPath", "/signup");
                  window.location.href = DISCORD_OAUTH;
                }}
              >
                VERIFY DISCORD
              </Button>

              {discordCancelled && (
                <Box
                  className="verify-error"
                  sx={{
                    mt: 1,
                    padding: "10px 12px",
                    borderRadius: "8px",
                    border: "1px solid #ef5350",
                    background: "#ffebee",
                  }}
                >
                  <Typography color="#d32f2f" fontSize={13} fontWeight="600">
                    ❌ Discord authorization cancelled
                  </Typography>
                </Box>
              )}

              {discordNotMember && (
                <Button
                  fullWidth
                  variant="outlined"
                  component="a"
                  href={DISCORD_INVITE}
                  target="_blank"
                  rel="noopener noreferrer"
                  sx={{
                    borderRadius: "10px",
                    fontWeight: "bold",
                  }}
                >
                  JOIN DISCORD SERVER
                </Button>
              )}

              {discordNotMember && (
                <Typography fontSize={13} color="#d32f2f">
                  ❌ You must join our Discord server before verification.
                </Typography>
              )}
            </>
          )}  
        </Box>

        {/* LinkedIn */}
<Typography
  fontWeight="bold"
  fontSize={14}
  mt={3}
  mb={1}
  alignSelf="flex-start"
>
  LinkedIn
</Typography>

<TextField
  label="LinkedIn URL"
  fullWidth
  margin="dense"
  size="small"
  value={data.linkedinId}
  onChange={(e) =>
    setData({ ...data, linkedinId: e.target.value })
  }
  error={data.linkedinId !== "" && !linkedinRegex.test(data.linkedinId)}
  helperText={
    data.linkedinId !== "" &&
    !linkedinRegex.test(data.linkedinId)
      ? "Enter valid LinkedIn profile URL (e.g. https://linkedin.com/in/username)"
      : ""
  }
/>
        {/* reCAPTCHA */}
        <Box
          sx={{
            width: "100%",
            display: "flex",
            justifyContent: "center",
            mt: 2,
            mb: 1,
          }}
        >
          <div id="recaptcha-container-signup" />
        </Box>

        {/* Terms */}
        <Box
          display="flex"
          alignItems="center"
          width="100%"
          mt={1}
        >
          <Checkbox
            checked={data.termsAccepted}
            onChange={(e) =>
              setData({ ...data, termsAccepted: e.target.checked })
            }
          />
          <Typography variant="body2">
            Accept{" "}
            <span
              style={{
                color: "#1E4DD8",
                cursor: "pointer",
                textDecoration: "underline",
              }}
              onClick={() => {
                sessionStorage.setItem("signupFormData", JSON.stringify(data));
                sessionStorage.setItem("activeStep", String(activeStep));
                sessionStorage.setItem("cameFromTerms", "true");
                navigate("/terms-and-conditions");
              }}
            >
              Terms & Conditions
            </span>
          </Typography>
        </Box>

        <Button
  fullWidth
  variant="contained"
  disabled={!isSignupAllowed() || isSendingOtp}
  sx={{
    mt: 2,
    borderRadius: "20px",
    backgroundColor: !isSignupAllowed() ? "#B0BEC5" : "#1E4DD8",
    "&:hover": {
      backgroundColor: !isSignupAllowed() ? "#B0BEC5" : "#1536A1",
    },
    py: 1,
  }}
  onClick={handleSubmit}
>

          {isSendingOtp ? (
            <CircularProgress size={20} sx={{ color: "white" }} />
          ) : (
            "Sign Up & Send OTP"
          )}
        </Button>

        <Divider sx={{ mt: 3, mb: 1, width: "100%" }} />
      </>
    );
  };

  // ------- MAIN RENDER -------
  return (
    <Box
      sx={{
        minHeight: "100vh",
        width: "100%",
        background: "linear-gradient(135deg, #1e3c72, #2a5298)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        py: 4,
        px: 2,
      }}
    >
      <Box
        sx={{
          width: "100%",
          maxWidth: 1400,
          display: "flex",
          flexDirection: { xs: "column", md: "row" },
          gap: { xs: 4, md: 8 },
          alignItems: "center",
        }}
      >
        {/* LEFT HERO */}
        <Box
          sx={{
            flex: 1,
            color: "white",
            textAlign: { xs: "center", md: "left" },
          }}
        >
          <Typography variant="h3" fontWeight={900} mb={1}>
            Join C4GT-Badal
          </Typography>
          <Typography
            variant="h2"
            fontWeight={900}
            sx={{ fontSize: { xs: "2.3rem", md: "3.2rem" } }}
            mb={3}
          >
            Build for Public Good
          </Typography>

          <Typography
            sx={{
              opacity: 0.95,
              maxWidth: 520,
              fontSize: "1.1rem",
              lineHeight: 1.6,
              marginX: { xs: "auto", md: 0 },
            }}
            mb={3}
          >
            Collaborate with government, academia, and industry to solve
            real-world challenges. Sign up to be part of India’s largest
            open collaboration platform for governance and technology.
          </Typography>

          <Stack direction="row" spacing={2} justifyContent={{ xs: "center", md: "flex-start" }}>
       
            <img
  src={hero2}
  alt="Badal Logo"
  style={{ height: 100, width: "auto", borderRadius: 16 }}
/>
<img
  src={hero1}
  alt="C4GT Logo"
  style={{ height: 100, width: "auto", borderRadius: 16 }}
/>

          </Stack>
        </Box>

        {/* RIGHT CARD WITH STEPPER */}
        <Box
          sx={{
            flex: 0.9,
            display: "flex",
            justifyContent: "center",
          }}
        >
          <Paper
            elevation={8}
            sx={{
              width: "100%",
              maxWidth: 480,
              p: 4,
              borderRadius: 4,
              background: "rgba(255,255,255,0.96)",
            }}
          >

            <Typography
              variant="h5"
              fontWeight={800}
              textAlign="center"
              color="#1E4DD8"
              mb={2}
            >
              Create Your Account
            </Typography>

            {/* Stepper */}
            <Stepper activeStep={activeStep} alternativeLabel sx={{ mb: 3 }}>
              {steps.map((label) => (
                <Step key={label}>
                  <StepLabel>{label}</StepLabel>
                </Step>
              ))}
            </Stepper>

            {/* Step Content */}
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
              {renderStepContent()}
            </Box>

            {/* Step Navigation Buttons */}
            <Box
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                mt: 3,
              }}
            >
              <Button
                disabled={activeStep === 0}
                onClick={handleBackStep}
                sx={{ textTransform: "none" }}
              >
                Back
              </Button>
              {activeStep < 2 ? (
                <Button
                  variant="contained"
                  onClick={handleNext}
                  sx={{
                    textTransform: "none",
                    borderRadius: 3,
                    backgroundColor: "#1E4DD8",
                    "&:hover": { backgroundColor: "#1536A1" },
                  }}
                >
                  Next
                </Button>
              ) : (
                <Typography
                  fontSize={15}
                  color="text.secondary"
                >
                  Already have an account?{" "}
                  <span
                    onClick={() => navigate("/signin")}
                    style={{
                      color: "#1E4DD8",
                      cursor: "pointer",
                      textDecoration: "underline",
                    }}
                  >
                    Sign In
                  </span>
                </Typography>
              )}
            </Box>
          </Paper>
        </Box>
      </Box>
    </Box>
  );
};

export default SignUpPage;