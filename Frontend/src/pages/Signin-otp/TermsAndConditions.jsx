import React from "react";
import {
  Box,
  Button,
  Typography,
  Divider,
  Paper,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { useNavigate } from "react-router-dom"; // ✅ Import navigate hook
import logo1 from "../../assets/badal_logo.png";
import logo2 from "../../assets/c4gt_logo.png";

const TermsAndConditions = () => {
  const navigate = useNavigate(); // ✅ Initialize navigation

  return (
    <Box
      sx={{
        minHeight: "100vh",
        bgcolor: "#f8f9fa",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        p: 2,
      }}
    >
      <Paper
        elevation={4}
        sx={{
          width: "100%",
          maxWidth: 800,
          border: "4px solid black",
          borderRadius: 2,
          overflow: "hidden",
          bgcolor: "#fff",
        }}
      >
        {/* Header */}
        <Box
          sx={{
            borderBottom: "4px solid black",
            p: 2,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 2,
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <img
              src={logo1}
              alt="Logo1"
              style={{ width: 48, height: 48, objectFit: "contain" }}
            />
            <img
              src={logo2}
              alt="Logo2"
              style={{ height: 48, objectFit: "contain" }}
            />
          </Box>

          <Button
            onClick={() => navigate(-1)} // ✅ Go back to previous page (signup)
            variant="outlined"
            startIcon={<ArrowBackIcon />}
            sx={{
              border: "2px solid black",
              color: "black",
              "&:hover": { bgcolor: "black", color: "white" },
            }}
          >
            Back
          </Button>
        </Box>

        {/* Scrollable Content */}
        <Box sx={{ maxHeight: "70vh", overflowY: "auto", p: 4 }}>
          <Typography
            variant="h5"
            textAlign="center"
            fontWeight="bold"
            gutterBottom
          >
            Terms and Conditions
          </Typography>
          <Typography
            textAlign="center"
            variant="body2"
            color="text.secondary"
            gutterBottom
          >
            Last Updated: November 3, 2025
          </Typography>

          <Typography variant="h6" sx={{ mt: 3 }}>
            1. Introduction
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Welcome to CODE 4 GovTech ("Platform", "we", "us", or "our"). These
            Terms and Conditions govern your use of our platform and services.
            By accessing or using CODE 4 GovTech, you agree to be bound by these
            terms.
          </Typography>

          <Typography variant="h6">2. Eligibility</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            You must be at least 18 years old or have parental/guardian consent
            to use this platform. By registering, you confirm that you meet
            these requirements and that all information provided is accurate and
            truthful.
          </Typography>

          <Divider sx={{ my: 3 }} />

          <Typography
            variant="body2"
            textAlign="center"
            color="text.secondary"
          >
            By clicking "Accept Terms & Conditions" during registration, you
            acknowledge that you have read, understood, and agree to be bound by
            these terms.
          </Typography>
        </Box>

        {/* Footer */}
        <Box
          sx={{
            borderTop: "4px solid black",
            p: 2,
            textAlign: "center",
          }}
        >
          <Button
            onClick={() => navigate(-1)} // ✅ Same here, go back
            variant="outlined"
            sx={{
              border: "2px solid black",
              borderRadius: "50px",
              px: 5,
              "&:hover": { bgcolor: "black", color: "white" },
            }}
          >
            I Understand
          </Button>
        </Box>
      </Paper>
    </Box>
  );
};

export default TermsAndConditions;
