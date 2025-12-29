import { discordOAuthCallback } from "../controllers/discordAuth.controller.js";

import express from "express";
const router = express.Router();
router.post("/callback", discordOAuthCallback);


export default router;