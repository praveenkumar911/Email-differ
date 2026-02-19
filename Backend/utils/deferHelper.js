import DeferredData from '../models/DeferredData.js';
import EmailLog from '../models/EmailLog.js';
import { generateToken } from './tokenUtils.js';
import sendEmail from './nodemailer.js';

// Fail fast when FRONTEND_URL is not set to avoid sending broken links
if (!process.env.FRONTEND_URL) {
  throw new Error('FRONTEND_URL is not set in environment variables');
}

const handleDeferredUser = async (user, emailLogId) => {
  try {
    console.log('🔍 Processing deferred user:', user?._id);
    
    if (!user || !user.email) {
      console.log('❌ Skipping user - no email');
      return;
    }

    // Add/update DeferredData
    let deferred = await DeferredData.findOne({ user: user._id });
    if (deferred) {
      if (deferred.attempts >= 3) {
        console.log('❌ Skipping - max attempts');
        return;
      }
      deferred.attempts += 1;
      deferred.deferredAt = new Date();
      await deferred.save();
      console.log('🔄 Updated deferred record:', deferred.attempts);
    } else {
      await DeferredData.create({ user: user._id });
      console.log('🆕 Created deferred record');
    }

    // Expire the original token (system action - only set status, not usedAt)
    await EmailLog.updateOne({ _id: emailLogId }, { 
      status: 'expired'
    });
    console.log('⏰ Expired token:', emailLogId);

    // Note: Reminder emails will be sent by resendDeferredEmails cron job
    // This prevents duplicate emails for users with multiple email addresses

  } catch (err) {
    console.error('💥 Error in handleDeferredUser:', err);
  }
};
export default handleDeferredUser;
