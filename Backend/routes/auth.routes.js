// routes/auth.routes.js
import express from "express";
const router = express.Router();
// import {
//   requestOtp,
//   verifyOtpController,
//   signup,
//   signin,
// } from "../controllers/auth.controller.js";
// import authMiddleware from "../middleware/authMiddleware.js";

/**
 * 🔒 Protected route example
 * You can hit this after successful login/signup using JWT token.
 */
// router.get("/me", authMiddleware, async (req, res) => {
//   res.json({
//     message: "Authenticated route accessed!",
//     user: {
//       id: req.user._id,
//       fullName: req.user.fullName,
//       role: req.user.role,
//       phone: req.user.phone,
//     },
//   });
// });

/**
 * 🔹 Request OTP (optional pre-check)
 * Frontend uses Firebase for OTP sending.
 * This endpoint simply confirms user status (signup or signin mode).
 */
// router.post("/request-otp", requestOtp);

/**
 * 🔹 Verify OTP (Firebase)
 * Used for both signup and signin flow — verifies `firebaseToken`.
 */
// router.post("/verify-otp", verifyOtpController);

// router.post("/signup", signup);


// router.post("/signin", signin);

export default router;
