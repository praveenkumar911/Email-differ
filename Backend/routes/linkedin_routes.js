import express from 'express';
import { linkedinCallback } from '../controllers/linkedinAuth.controller.js';

const router = express.Router();

router.post('/callback', linkedinCallback);

export default router;
