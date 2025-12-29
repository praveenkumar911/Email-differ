// src/pages/Auth/SignInPageMui.jsx
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { requestOtp } from "../../api/apiService";
import Swal from "sweetalert2";

import {
  Box,
  Typography,
  TextField,
  Button,
  CircularProgress,
  Stack,
  Divider,
  Paper,
  InputAdornment,
  Fade,
  Alert,
} from "@mui/material";

import { keyframes } from "@mui/system";

import PhoneAndroidIcon from "@mui/icons-material/PhoneAndroid";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";

import hero1 from "../../assets/white.png";
import hero2 from "../../assets/badal_final.png";

import { auth, signInWithPhoneNumber } from "../../firebase";
import { setupRecaptcha, resetRecaptcha, forceResetRecaptchaPromise } from "../../utils/setupRecaptcha";
import { cleanupRecaptcha } from "../../utils/recaptchaCleanup";

// Premium animations
const shake = keyframes`
  0% { transform: translateX(0); }
  15% { transform: translateX(-4px); }
  30% { transform: translateX(4px); }
  45% { transform: translateX(-3px); }
  60% { transform: translateX(3px); }
  75% { transform: translateX(-2px); }
  90% { transform: translateX(2px); }
  100% { transform: translateX(0); }
`;

const fadeError = keyframes`
  from { opacity: 0; transform: translateY(-4px); }
  to { opacity: 1; transform: translateY(0); }
`;

const SignInPageMui = () => {
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorBanner, setErrorBanner] = useState("");
  const [shakePhone, setShakePhone] = useState(false);

  const navigate = useNavigate();

  // Initialize reCAPTCHA
  useEffect(() => {
    // 🔥 VERY IMPORTANT: Reset promise whenever entering SignIn page
    forceResetRecaptchaPromise();
    
    cleanupRecaptcha();
    // Small delay so DOM is ready
    setTimeout(() => {
      setupRecaptcha(auth, "recaptcha-container-login").catch((err) =>
        console.warn("reCAPTCHA login init error:", err)
      );
    }, 150);

    return () => {
      cleanupRecaptcha();
      resetRecaptcha();
    };
  }, []);

  const triggerPhoneError = (msg) => {
    setErrorBanner(msg);
    setShakePhone(true);
    setTimeout(() => setShakePhone(false), 500);
  };

  const handleRequestOtp = async (e) => {
    e.preventDefault();
    const trimmed = phone.trim();

    if (!trimmed || trimmed.length !== 10) {
      Swal.fire({
        icon: "error",
        title: "Invalid Number",
        text: "Please enter a valid 10-digit phone number.",
        confirmButtonColor: "#1E4DD8",
      });
      triggerPhoneError("Please enter a valid 10-digit phone number.");
      return;
    }

    setLoading(true);
    setErrorBanner("");

    try {
      const check = await requestOtp({ phone: trimmed });

      if (check.mode === "signup") {
        Swal.fire({
          icon: "info",
          title: "Not Registered",
          text: "We couldn't find an account with this number. Please sign up first.",
          confirmButtonColor: "#1E4DD8",
        }).then(() => {
          sessionStorage.setItem("fromSignIn", "true");
          navigate("/signup");
        });
        return;
      }

      if (check.roleId) {
        sessionStorage.setItem("loginRoleId", check.roleId);
      }

      const confirmationResult = await signInWithPhoneNumber(
        auth,
        `+91${trimmed}`,
        window.recaptchaVerifier
      );

      sessionStorage.setItem(
        "loginConfirmationResult",
        JSON.stringify({
          verificationId: confirmationResult.verificationId,
          phone: `+91${trimmed}`,
        })
      );

      Swal.fire({
        icon: "success",
        title: "OTP Sent!",
        text: `OTP sent to +91 ${trimmed}`,
        timer: 1500,
        showConfirmButton: false,
      });

      navigate("/login-otp-verify", { state: { phone: `+91${trimmed}` } });

      // Reset recaptcha instance so it can be reused on errors/resends
      cleanupRecaptcha();
      resetRecaptcha();
    } catch (err) {
      console.error("OTP send error:", err);
      
      let errorMsg = err?.message || "Could not send OTP. Try again.";
      if (errorMsg.includes("too-many-requests")) {
        errorMsg = "Too many attempts. Please wait a moment and try again.";
      } else if (errorMsg.includes("invalid-phone-number")) {
        errorMsg = "Invalid phone number format.";
      }
      
      Swal.fire({
        icon: "error",
        title: "Failed to send OTP",
        text: errorMsg,
      });
      triggerPhoneError(errorMsg);
      
      // Cleanup and reinit reCAPTCHA on error
      cleanupRecaptcha();
      resetRecaptcha();
      setTimeout(async () => {
        try {
          await setupRecaptcha(auth, "recaptcha-container-login");
        } catch (e) {
          console.warn("Error reinitializing reCAPTCHA:", e);
        }
      }, 500);
    } finally {
      setLoading(false);
    }
  };

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
      {/* WRAPPER */}
      <Box
        sx={{
          width: "100%",
          maxWidth: "1400px",
          display: "flex",
          gap: { xs: 4, md: 6, lg: 8 },
          flexDirection: { xs: "column", md: "row" },
          alignItems: "center",
          px: { xs: 2, md: 4 },
        }}
      >
        {/* LEFT SECTION */}
        <Box
          sx={{
            flex: 1,
            color: "white",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            pt: { xs: 2, md: 0 },
          }}
        >
          <Typography variant="h3" fontWeight={900} mb={1}>
            Welcome to
          </Typography>

          <Typography variant="h2" fontWeight={900} mb={3}>
            C4GT - Badal
          </Typography>

          <Typography
            variant="body1"
            sx={{
              opacity: 0.95,
              maxWidth: 500,
              fontSize: "1.1rem",
              lineHeight: 1.6,
            }}
            mb={3}
          >
            A platform connecting developers with high-impact government
            projects. Fueling innovation, transparency, and transformation.
          </Typography>

          <Stack direction="row" spacing={2}>
          
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

        {/* RIGHT LOGIN CARD */}
        <Box
          sx={{
            flex: 0.8,
            display: "flex",
            justifyContent: "center",
          }}
        >
          <Fade in timeout={500}>
            <Paper
              elevation={10}
              sx={{
                width: "100%",
                maxWidth: 420,
                padding: 4,
                borderRadius: 4,
                textAlign: "center",
                background: "rgba(255,255,255,0.96)",
                position: "relative",
                overflow: "hidden",
              }}
            >
              {/* Top subtle gradient border */}
              <Box
                sx={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  height: 4,
                  background:
                    "linear-gradient(90deg, #1E4DD8, #22c55e, #1E4DD8)",
                }}
              />

              {/* ERROR BANNER */}
              {errorBanner && (
                <Box
                  sx={{
                    mb: 2,
                    animation: `${fadeError} 0.25s ease-out`,
                  }}
                >
                  <Alert
                    severity="error"
                    sx={{
                      borderRadius: 2,
                      fontSize: 13,
                      py: 0.75,
                    }}
                  >
                    {errorBanner}
                  </Alert>
                </Box>
              )}

              <Typography variant="h4" fontWeight={800} color="#1E4DD8" mb={1}>
                Welcome Back
              </Typography>

              <Typography mb={4} color="text.secondary">
                Enter your phone number to continue
              </Typography>

              {/* FORM */}
              <Box component="form" onSubmit={handleRequestOtp}>
                <Box
                  sx={{
                    mb: 3,
                    animation: shakePhone
                      ? `${shake} 0.4s ease-in-out`
                      : "none",
                  }}
                >
                  <TextField
                    fullWidth
                    label="Phone Number"
                    value={phone}
                    onChange={(e) =>
                      setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))
                    }
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <PhoneAndroidIcon sx={{ color: "#1E4DD8" }} />
                        </InputAdornment>
                      ),
                    }}
                  />
                </Box>

                <div
                  id="recaptcha-container-login"
                  style={{ marginBottom: 16 }}
                />

                <Button
                  fullWidth
                  type="submit"
                  disabled={loading || phone.length !== 10}
                  endIcon={!loading && <ArrowForwardIcon />}
                  sx={{
                    py: 1.7,
                    borderRadius: 3,
                    backgroundColor:
                      phone.length === 10 ? "#1E4DD8" : "#94A3B8",
                    color: "white",
                    fontWeight: 700,
                    textTransform: "none",
                    boxShadow:
                      phone.length === 10
                        ? "0 8px 18px rgba(30,77,216,0.35)"
                        : "none",
                    transform:
                      loading || phone.length !== 10
                        ? "none"
                        : "translateY(0)",
                    transition:
                      "background-color 0.25s ease, transform 0.15s ease, box-shadow 0.15s ease",
                    "&:hover": {
                      backgroundColor:
                        phone.length === 10 ? "#1536A1" : "#94A3B8",
                      transform:
                        phone.length === 10 ? "translateY(-1px)" : "none",
                      boxShadow:
                        phone.length === 10
                          ? "0 10px 24px rgba(21,54,161,0.45)"
                          : "none",
                    },
                  }}
                >
                  {loading ? (
                    <CircularProgress size={26} color="inherit" />
                  ) : (
                    "Send OTP"
                  )}
                </Button>
              </Box>

              <Divider sx={{ my: 4 }}>New User?</Divider>

              <Typography>
                Don’t have an account?{" "}
                <span
                  style={{
                    color: "#1E4DD8",
                    cursor: "pointer",
                    fontWeight: 700,
                    textDecoration: "underline",
                  }}
                  onClick={() => {
                    sessionStorage.setItem("fromSignIn", "true");
                    navigate("/signup");
                  }}
                >
                  Sign Up Here
                </span>
              </Typography>
            </Paper>
          </Fade>
        </Box>
      </Box>
    </Box>
  );
};

export default SignInPageMui;