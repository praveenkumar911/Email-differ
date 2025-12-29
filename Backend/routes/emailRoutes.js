import express from 'express';
const router = express.Router();
import { sendFormEmails, resendDeferredEmails } from '../controllers/emailController.js';

router.post('/send', sendFormEmails);
router.post('/resend', resendDeferredEmails); // triggered by cron job

export default router;
