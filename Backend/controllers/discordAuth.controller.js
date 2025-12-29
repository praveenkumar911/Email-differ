// controllers/discord.controller.js

import axios from "axios";

// Discord API base instance
const discordApi = axios.create({
  baseURL: "https://discord.com/api",
  timeout: 7000,
}); 

const mask = (str) => (str ? str.slice(0, 6) + "...****" : "null");

const REQUIRED_ENV = [
  "DISCORD_CLIENT_ID",
  "DISCORD_CLIENT_SECRET",
  "DISCORD_REDIRECT_URI",
  "DISCORD_GUILD_ID",
  "DISCORD_BOT_TOKEN",
];

REQUIRED_ENV.forEach((key) => {
  if (!process.env[key]) {
    console.warn(`[Discord] Missing ENV: ${key}`);
  }
});

/**
 * Builds a safe complete avatar URL
 */
function buildAvatarUrl(user) {
  if (!user.avatar) {
    // Default Discord avatar (based on discriminator)
    return `https://cdn.discordapp.com/embed/avatars/${user.discriminator % 5}.png`;
  }

  return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=256`;
}

/**
 * POST /api/discord/callback
 * Body: { code }
 */
export const discordOAuthCallback = async (req, res) => {
  const code = req.body.code;

  if (!code) {
    return res.status(400).json({ success: false, message: "Missing OAuth code" });
  }

  try {
    const tokenResponse = await discordApi.post(
      "/oauth2/token",
      new URLSearchParams({
        client_id: process.env.DISCORD_CLIENT_ID,
        client_secret: process.env.DISCORD_CLIENT_SECRET,
        grant_type: "authorization_code",
        code,
        redirect_uri: process.env.DISCORD_REDIRECT_URI,
      }),
      {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      }
    );

    const accessToken = tokenResponse.data.access_token;

    const userResponse = await discordApi.get("/users/@me", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const user = userResponse.data;
    const discordId = user.id;
    const username = user.username;
    const discriminator = user.discriminator;
    const avatar = user.avatar;
    const avatarUrl = buildAvatarUrl(user);

    // Check guild membership
    let isMember = false;
    let membershipSource = null;

    try {
      await discordApi.get(
        `/guilds/${process.env.DISCORD_GUILD_ID}/members/${discordId}`,
        {
          headers: { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}` },
        }
      );

      isMember = true;
      membershipSource = "bot";
      console.log(`Discord: ${username} verified as member (bot)`);
    } catch (err) {
      if (err.response?.status === 404 || err.response?.status === 403) {
        isMember = false;
      } else {
        console.error("Discord bot check error:", err.message);
      }
    }

    // Fallback: Use user's OAuth token to check their guild list
    if (!isMember) {
      try {
        const guildsResp = await discordApi.get("/users/@me/guilds", {
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        const guilds = Array.isArray(guildsResp.data) ? guildsResp.data : [];
        const found = guilds.some((g) => g.id === process.env.DISCORD_GUILD_ID);

        if (found) {
          isMember = true;
          membershipSource = "oauth";
          console.log(`Discord: ${username} verified as member (OAuth)`);
        }
      } catch (oauthErr) {
        console.error("Discord OAuth fallback error:", oauthErr.message);
      }
    }

    return res.json({
      success: true,
      message: "Discord OAuth success",
      discordId,
      username,
      discriminator,
      avatar,
      avatarUrl,
      isMember,
      membershipSource,
    });

  } catch (error) {
    console.error("Discord OAuth error:", error.response?.data || error.message);

    return res.status(500).json({
      success: false,
      message: "OAuth failed while exchanging token or fetching user",
      error: error.response?.data || error.message,
    });
  }
};

/**
 * GET /api/discord/check-membership?discordId=123
 */
export const checkDiscordMembership = async (req, res) => {
  const { discordId } = req.query;

  if (!discordId) {
    return res.status(400).json({ joined: false, message: "Missing discordId query param" });
  }

  try {
    await discordApi.get(
      `/guilds/${process.env.DISCORD_GUILD_ID}/members/${discordId}`,
      {
        headers: { Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN}` },
      }
    );

    return res.json({ joined: true });
  } catch (err) {
    if (err.response?.status === 404 || err.response?.status === 403) {
      return res.json({ joined: false });
    }

    return res.json({
      joined: false,
      error: err.response?.data || err.message,
    });
  }
};
