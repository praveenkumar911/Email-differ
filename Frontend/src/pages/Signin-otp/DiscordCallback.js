import { useEffect, useRef } from "react";
import axios from "axios";
import { useSearchParams, useNavigate } from "react-router-dom";

export default function DiscordCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const code = searchParams.get("code");
  const error = searchParams.get("error");
  const state = searchParams.get("state"); // ✅ Get state parameter
  const hasProcessed = useRef(false);

  useEffect(() => {
    // Prevent duplicate execution in React Strict Mode
    if (hasProcessed.current) {
      return;
    }

    // Mark as processing immediately to prevent duplicate calls
    hasProcessed.current = true;

    // Helper: Always preserve form data on Discord redirects
    const preserveState = () => {
      sessionStorage.setItem("activeStep", "2");
      sessionStorage.setItem("isNavigating", "true");
      sessionStorage.setItem("cameFromDiscord", "true");
    };

    // Determine return path (signup or update-form)
    const getReturnPath = () => {
      const savedPath = sessionStorage.getItem("oauthReturnPath");
      return savedPath || "/signup";
    };

    // User cancelled Discord authorization
    if (error === "access_denied") {
      preserveState();
      sessionStorage.setItem("discord_cancelled", "true");
      // ✅ Clear stale member flag on cancel
      sessionStorage.removeItem("discordNotMember");
      navigate(getReturnPath(), { replace: true });
      return;
    }

    // No code received → go back safely
    if (!code) {
      preserveState();
      navigate(getReturnPath(), { replace: true });
      return;
    }

    // ✅ Verify OAuth state to prevent CSRF
    const savedState = sessionStorage.getItem("discordOAuthState");
    if (savedState && state !== savedState) {
      console.error("OAuth state mismatch - possible CSRF attack");
      sessionStorage.setItem("discord_error", "Security validation failed. Please try again.");
      preserveState();
      navigate(getReturnPath(), { replace: true });
      return;
    }
    
    // ✅ Clear used state
    sessionStorage.removeItem("discordOAuthState");

    // SUCCESS PATH
    const verify = async () => {
      
      try {
        const res = await axios.post(
          "pl-api.iiit.ac.in/rcts/account-setup/api/discord/callback",
          { code }
        );

        const {
          discordId,
          username,
          discriminator,
          avatar,
          avatarUrl,
          isMember,
        } = res.data;

        sessionStorage.setItem("discord_verification_loading", "true");

        if (discordId) sessionStorage.setItem("discordId", discordId);

        if (username && discriminator)
          sessionStorage.setItem(
            "discordUsername",
            `${username}#${discriminator}`
          );

        sessionStorage.setItem("discordAvatar", avatar || "");
        sessionStorage.setItem("discordAvatarUrl", avatarUrl || "");

        if (isMember) {
          sessionStorage.setItem("discordVerified", "true");
          sessionStorage.removeItem("discordNotMember");
        } else {
          sessionStorage.setItem("discordNotMember", "true");
          sessionStorage.removeItem("discordVerified");
        }

        preserveState();
        navigate(getReturnPath());

      } catch (err) {
        console.error("Discord OAuth error:", err.response?.data || err.message);

        // ✅ Clear stale member flag on error
        sessionStorage.removeItem("discordNotMember");
        sessionStorage.removeItem("discordVerified");
        
        // Store user-friendly error info
        if (err.response?.data?.error === "invalid_grant") {
          sessionStorage.setItem("discord_error", "Code expired or already used. Please try again.");
        } else if (err.response?.status === 429) {
          sessionStorage.setItem("discord_error", "Too many attempts. Please wait a moment.");
        } else if (err.response?.data?.message) {
          // Show backend error message if available
          sessionStorage.setItem("discord_error", err.response.data.message);
        } else {
          sessionStorage.setItem("discord_error", "Verification failed. Please try again.");
        }

        sessionStorage.setItem("discord_verification_loading", "true");
        preserveState();
        navigate(getReturnPath());
      }
    };

    verify();

  }, [code, error, state, navigate]);

  return null;
}
