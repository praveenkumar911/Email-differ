// src/pages/Auth/LoginOtpVerification.jsx

import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { verifyLoginOtp } from "../../api/apiService";

import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  CircularProgress,
  IconButton,
  Stack,
  Fade,
  Alert,
} from "@mui/material";

import { keyframes } from "@mui/system";

import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import Swal from "sweetalert2";
import { auth, signInWithPhoneNumber } from "../../firebase";
import { PhoneAuthProvider, signInWithCredential } from "firebase/auth";
import { setupRecaptcha } from "../../utils/setupRecaptcha";

import { useAuth } from "../../context/AuthContext";

// Animations
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

const LoginOtpVerification = () => {
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [timer, setTimer] = useState(0);
  const [errorBanner, setErrorBanner] = useState("");
  const [shakeOtp, setShakeOtp] = useState(false);

  const location = useLocation();
  const navigate = useNavigate();
  const { setUser } = useAuth();

  // Restore phone
  let phone = location.state?.phone;
  if (!phone) {
    try {
      const saved = JSON.parse(
        sessionStorage.getItem("loginConfirmationResult")
      );
      phone = saved?.phone;
    } catch {}
  }

  // Before Unload Warning
  useEffect(() => {
    const handler = (e) => {
      e.returnValue = "Refreshing will clear OTP verification progress.";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  // Timer Countdown
  useEffect(() => {
    if (timer > 0) {
      const intv = setInterval(() => setTimer((t) => t - 1), 1000);
      return () => clearInterval(intv);
    }
  }, [timer]);

  const triggerOtpError = (msg) => {
    setErrorBanner(msg);
    setShakeOtp(true);
    setTimeout(() => setShakeOtp(false), 500);
  };

  const handleVerify = async () => {
    if (otp.trim().length !== 6) {
      Swal.fire({
        icon: "warning",
        title: "Invalid OTP",
        text: "Please enter a valid 6-digit OTP.",
      });
      triggerOtpError("Please enter a valid 6-digit OTP.");
      return;
    }

    setLoading(true);
    setErrorBanner("");

    try {
      const storedData = JSON.parse(
        sessionStorage.getItem("loginConfirmationResult")
      );

      if (!storedData) {
        Swal.fire({
          icon: "info",
          title: "Session Expired",
          text: "Your OTP session has expired. Please sign in again.",
        });
        return navigate("/signin");
      }

      const credential = PhoneAuthProvider.credential(
        storedData.verificationId,
        otp.trim()
      );

      const userCredential = await signInWithCredential(auth, credential);
      const firebaseToken = await userCredential.user.getIdToken();

      const payload = {
        firebaseToken,
        phoneNumber: phone.startsWith("+91") ? phone : `+91${phone}`,
      };

      const response = await verifyLoginOtp(payload);
      const appUser = response.user || response;

      setUser({
        token: response.token,
        userId: appUser.userId || appUser.id || appUser._id,
        roleId: appUser.roleId,
        orgId: appUser.orgId,
        permissions: appUser.permissions,
        phone,
      });

      sessionStorage.removeItem("loginConfirmationResult");

      Swal.fire({
        icon: "success",
        title: "Login Successful",
        timer: 1500,
        showConfirmButton: false,
      });

      navigate("/home", { replace: true });
    } catch (err) {
      console.error("OTP verification error:", err);

      let message = "OTP verification failed. Please try again.";

      // Friendly error mapping
      const code = err?.code || err?.message || "";

      if (code.includes("invalid-verification-code")) {
        message = "The OTP you entered is incorrect. Please check and try again.";
      }
      else if (code.includes("missing-verification-code")) {
        message = "Please enter the OTP before verifying.";
      }
      else if (code.includes("session-expired")) {
        message = "The OTP has expired. Please request a new one.";
      }
      else if (code.includes("too-many-requests")) {
        message = "Too many attempts. Please wait a moment before retrying.";
      }
      else if (code.includes("network-request-failed")) {
        message = "Network error. Check your internet connection and try again.";
      }
      else if (code.includes("invalid-phone-number")) {
        message = "Phone number invalid. Try again.";
      }
      else if (code.includes("quota-exceeded")) {
        message = "Too many OTP requests. Please try again later.";
      }

      Swal.fire({
        icon: "error",
        title: "OTP Verification Failed",
        text: message,
        confirmButtonColor: "#1E4DD8",
      });

      triggerOtpError(message);
    }

    setLoading(false);
  };

  const handleResendOtp = async () => {
    if (resending || timer > 0) return;

    setResending(true);
    setErrorBanner("");

    try {
      // Clear existing recaptcha verifier if any
      if (window.recaptchaVerifier) {
        window.recaptchaVerifier.clear?.();
        window.recaptchaVerifier = null;
      }

      await setupRecaptcha(auth, "recaptcha-container-login-otp");

      const confirmation = await signInWithPhoneNumber(
        auth,
        phone,
        window.recaptchaVerifier
      );

      sessionStorage.setItem(
        "loginConfirmationResult",
        JSON.stringify({
          verificationId: confirmation.verificationId,
          phone,
        })
      );

      Swal.fire({
        icon: "success",
        title: "OTP Resent!",
        text: `OTP sent to ${phone}`,
      });

      setTimer(30);
    } catch (err) {
      console.error("Resend OTP error:", err);
      Swal.fire({
        icon: "error",
        title: "Failed",
        text: "Could not resend OTP. Please try again.",
      });
      triggerOtpError("Could not resend OTP. Please try again.");
    } finally {
      setResending(false);
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
      {/* WRAPPER - Matches Sign In UI */}
      <Box
        sx={{
          width: "100%",
          maxWidth: 1400,
          display: "flex",
          alignItems: "center",
          flexDirection: "column",
        }}
      >
        {/* CENTERED CARD */}
        <Fade in timeout={500}>
          <Paper
            elevation={8}
            sx={{
              width: "100%",
              maxWidth: 420,
              p: 3,
              pb: 2,
              borderRadius: 4,
              textAlign: "center",
              background: "rgba(255,255,255,0.96)",
              position: "relative",
              overflow: "hidden",
            }}
          >
            {/* Top gradient border */}
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

            {/* BACK BUTTON */}
            <IconButton
              onClick={() => navigate("/signin")}
              sx={{
                position: "absolute",
                top: 16,
                left: 16,
                bgcolor: "#f1f1f1",
                "&:hover": { bgcolor: "#e0e0e0" },
                zIndex: 2,
              }}
            >
              <ArrowBackIcon />
            </IconButton>

            
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
              Verify OTP
            </Typography>

            <Typography sx={{ mb: 3 }}>
              Enter the 6-digit OTP sent to
              <strong> {phone}</strong>
            </Typography>

            {/* OTP INPUT */}
            <Box
              sx={{
                mb: 3,
                animation: shakeOtp ? `${shake} 0.4s ease-in-out` : "none",
              }}
            >
              <TextField
                fullWidth
                placeholder="123456"
                value={otp}
                onChange={(e) =>
                  setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
                }
                inputProps={{
                  maxLength: 6,
                  style: {
                    textAlign: "center",
                    letterSpacing: "6px",
                    fontSize: "20px",
                    fontWeight: 700,
                  },
                }}
              />
            </Box>

            {/* VERIFY BUTTON */}
            <Button
              fullWidth
              variant="contained"
              disabled={loading}
              onClick={handleVerify}
              sx={{
                py: 1.5,
                borderRadius: 3,
                bgcolor: "#1E4DD8",
                "&:hover": { bgcolor: "#1536A1" },
                color: "white",
                fontWeight: 600,
                textTransform: "none",
                boxShadow: "0 8px 18px rgba(30,77,216,0.35)",
              }}
            >
              {loading ? (
                <CircularProgress size={24} sx={{ color: "white" }} />
              ) : (
                "Verify OTP"
              )}
            </Button>

            {/* RESEND OTP */}
            <Button
              fullWidth
              sx={{
                mt: 2,
                borderRadius: 3,
                color: "#1E4DD8",
                fontWeight: 700,
                textTransform: "none",
                opacity: resending || timer > 0 ? 0.7 : 1,
              }}
              disabled={resending || timer > 0}
              onClick={handleResendOtp}
            >
              {resending
                ? "Resending..."
                : timer > 0
                ? `Resend OTP in ${timer}s`
                : "Resend OTP"}
            </Button>

            <Box
              id="recaptcha-container-login-otp"
              sx={{ mt: 1 }}
            />
          </Paper>
        </Fade>
      </Box>
    </Box>
  );
};

export default LoginOtpVerification;