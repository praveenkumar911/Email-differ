// src/pages/Auth/OtpVerification.jsx

import React, { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { verifyOtp, signupUser } from "../../api/apiService";
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  CircularProgress,
  IconButton,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import {
  auth,
  signInWithPhoneNumber,
  PhoneAuthProvider,
  signInWithCredential,
} from "../../firebase";
import { setupRecaptcha } from "../../utils/setupRecaptcha";

import Swal from "sweetalert2";

const OtpVerification = () => {
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [timer, setTimer] = useState(0);

  const location = useLocation();
  const navigate = useNavigate();

  // Restore phone
  let phone = location.state?.phone;
  if (!phone) {
    try {
      const saved = JSON.parse(sessionStorage.getItem("signupFormData"));
      phone = saved?.phone;
    } catch {
      phone = "";
    }
  }

  const showAlert = (message, icon = "info") => {
    Swal.fire({
      title:
        icon === "success"
          ? "Success!"
          : icon === "error"
          ? "Error!"
          : icon === "warning"
          ? "Warning!"
          : "Info",
      text: message,
      icon,
      confirmButtonColor: "#1E4DD8",
    });
  };

  // Warn on refresh
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      e.returnValue = "Refreshing will clear OTP session.";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () =>
      window.removeEventListener("beforeunload", handleBeforeUnload);
  }, []);

  // Timer countdown
  useEffect(() => {
    if (timer > 0) {
      const interval = setInterval(() => setTimer((t) => t - 1), 1000);
      return () => clearInterval(interval);
    }
  }, [timer]);

  // Verify OTP
  const handleVerify = async () => {
    if (!otp.trim())
      return showAlert("Please enter the OTP", "warning");
    if (otp.length !== 6)
      return showAlert("Please enter a valid 6-digit OTP", "warning");
    if (!/^\d{6}$/.test(otp))
      return showAlert("OTP should contain only numbers", "warning");

    setLoading(true);
    try {
      const verificationId =
        sessionStorage.getItem("verificationId") ||
        localStorage.getItem("verificationId");

      if (!verificationId) {
        showAlert("Session expired. Please request a new OTP.", "error");
        setLoading(false);
        return;
      }

      const credential = PhoneAuthProvider.credential(
        verificationId,
        otp.trim()
      );
      const userCredential = await signInWithCredential(auth, credential);
      const firebaseToken = await userCredential.user.getIdToken();

      if (!firebaseToken) {
        showAlert("Failed to obtain Firebase token. Try again.", "error");
        setLoading(false);
        return;
      }

      const saved = sessionStorage.getItem("signupFormData");
      const profile = saved ? JSON.parse(saved) : null;
      let backendRes = null;

      if (profile && profile.fullName && profile.phone) {
        if (
          !profile.fullName ||
          /^\d+$/.test(String(profile.fullName).trim())
        ) {
          showAlert(
            "Please enter a valid full name in the signup form before verifying OTP.",
            "warning"
          );
          setLoading(false);
          navigate("/signup");
          return;
        }

        const signupPayload = {
          name: profile.fullName,
          phoneNumber: `+91${profile.phone
            .replace(/\D/g, "")
            .replace(/^91/, "")}`,
          email: profile.email,
          organization: profile.organisation,
          orgType: profile.orgType,
          role: profile.role,
          githubId: profile.githubId,
          githubUrl: profile.githubUrl,
          discordId: profile.discordId,     // match backend field name
          linkedInUrl: profile.linkedinId,  // match backend field name
          acceptedTerms: profile.termsAccepted,
          
          firebaseToken,
        };

        backendRes = await signupUser(signupPayload);
      } else {
        backendRes = await verifyOtp({
          firebaseToken,
          phoneNumber: phone,
        });
      }

      console.log("Backend response:", backendRes);
      showAlert("Signup successful! Redirecting to login.", "success");

      sessionStorage.removeItem("verificationId");
      localStorage.removeItem("verificationId");

      setTimeout(() => navigate("/signin"), 1500);
    } catch (err) {
      console.error("OTP Verification Error:", err);
      const friendlyMessage =
        err.code === "auth/code-expired"
          ? "OTP expired. Please request a new one."
          : err.code === "auth/invalid-verification-code"
          ? "Invalid OTP. Please try again."
          : err.code === "auth/too-many-requests"
          ? "Too many attempts. Try again later."
          : err?.message || "Unexpected error occurred. Please try again.";
      showAlert(friendlyMessage, "error");
    } finally {
      setLoading(false);
    }
  };

  // Resend OTP
  const handleResendOtp = async () => {
    if (resending || timer > 0) return;

    setResending(true);
    try {
      const e164Phone = phone.toString().startsWith("+")
        ? phone
        : `+91${phone}`;

      await setupRecaptcha(auth, "recaptcha-container-signup-otp");
      await new Promise((r) => setTimeout(r, 500));

      const confirmationResult = await signInWithPhoneNumber(
        auth,
        e164Phone,
        window.recaptchaVerifier
      );

      sessionStorage.setItem(
        "verificationId",
        confirmationResult.verificationId
      );

      Swal.fire({
        icon: "success",
        title: "OTP Resent!",
        text: "New OTP sent successfully",
        timer: 1500,
        showConfirmButton: false,
      });

      setTimer(30);
    } catch (err) {
      console.error("Resend failed:", err);
      Swal.fire({
        icon: "error",
        title: "Failed",
        text:
          err.code === "auth/too-many-requests"
            ? "Too many attempts. Try again later."
            : "Failed to resend OTP",
      });
    } finally {
      setResending(false);
    }
  };

  const handleOtpChange = (e) => {
    const value = e.target.value;
    const onlyNums = value.replace(/\D/g, "");
    if (onlyNums.length <= 6) setOtp(onlyNums);

    if (value && /\D/.test(value)) {
      Swal.fire({
        icon: "info",
        title: "Numbers Only",
        text: "Please enter digits only (0–9).",
        confirmButtonColor: "#1E4DD8",
        timer: 1200,
        showConfirmButton: false,
      });
    }
  };

  const handleBack = () => {
    sessionStorage.setItem("cameFromOtp", "true");
    navigate("/signup");
  };

  if (!phone)
    return (
      <Box
        sx={{
          height: "100vh",
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Typography>No phone number found. Please sign up again.</Typography>
      </Box>
    );

  return (
    <Box
      sx={{
        minHeight: "100vh",
        width: "100%",
        background: "linear-gradient(135deg, #1e3c72, #2a5298)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        p: 2,
      }}
    >
      <Paper
        elevation={8}
        sx={{
          width: "100%",
          maxWidth: 420,
          p: 4,
          borderRadius: 4,
          background: "rgba(255,255,255,0.96)",
          position: "relative",
        }}
      >
        {/* Back Button */}
        <IconButton
          onClick={handleBack}
          sx={{
            position: "absolute",
            top: 12,
            left: 12,
            color: "#333",
            backgroundColor: "#f1f1f1",
            "&:hover": { backgroundColor: "#e0e0e0" },
          }}
        >
          <ArrowBackIcon />
        </IconButton>

        <Typography
          variant="h5"
          align="center"
          fontWeight="bold"
          sx={{ mb: 1 }}
          color="#1E4DD8"
        >
          Verify OTP
        </Typography>

        <Typography
          variant="body2"
          color="text.secondary"
          align="center"
          sx={{ mb: 3 }}
        >
          Enter the 6-digit OTP sent to{" "}
          <strong>+91 {phone.toString().replace("+91", "")}</strong>
        </Typography>

        {/* OTP Field */}
        <TextField
          label="Enter 6-digit OTP"
          placeholder="123456"
          value={otp}
          onChange={handleOtpChange}
          fullWidth
          size="small"
          margin="normal"
          inputProps={{
            inputMode: "numeric",
            pattern: "[0-9]*",
            maxLength: 6,
          }}
          sx={{
            "& .MuiInputBase-input": {
              letterSpacing: "6px",
              textAlign: "center",
              fontSize: "18px",
              fontWeight: "bold",
            },
          }}
          helperText={
            otp.length > 0 && otp.length !== 6
              ? "OTP must be 6 digits"
              : ""
          }
          error={otp.length > 0 && otp.length !== 6}
        />

        {/* Verify Button */}
        <Button
          fullWidth
          variant="contained"
          disabled={loading}
          sx={{
            mt: 2,
            py: 1.2,
            borderRadius: "20px",
            backgroundColor: "#1E4DD8",
            fontWeight: "bold",
            "&:hover": {
              backgroundColor: loading ? "#1E4DD8" : "#1536A1",
            },
          }}
          onClick={handleVerify}
        >
          {loading ? (
            <CircularProgress size={20} sx={{ color: "white" }} />
          ) : (
            "Verify OTP"
          )}
        </Button>

        {/* Resend Button */}
        <Button
          fullWidth
          onClick={handleResendOtp}
          disabled={resending || timer > 0}
          sx={{
            mt: 2,
            borderRadius: "20px",
            color: "#1E4DD8",
            border: "1px solid #1E4DD8",
            textTransform: "none",
            py: 1,
          }}
        >
          {resending
            ? "Resending..."
            : timer > 0
            ? `Resend OTP in ${timer}s`
            : "Resend OTP"}
        </Button>

        <div id="recaptcha-container-signup-otp" />
      </Paper>
    </Box>
  );
};

export default OtpVerification;
