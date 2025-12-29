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

    // Add to DeferredData
    let deferred = await DeferredData.findOne({ user: user._id });
    if (deferred) {
      if (deferred.attempts >= 3) {
        console.log('❌ Skipping user - max attempts reached');
        return;
      }
      deferred.attempts += 1;
      deferred.deferredAt = new Date();
      await deferred.save();
      console.log('🔄 Updated deferred record:', deferred.attempts);
    } else {
      const newDeferred = await DeferredData.create({ user: user._id });
      console.log('🆕 Created deferred record:', newDeferred._id);
    }

    // Expire original token
    await EmailLog.updateOne({ _id: emailLogId }, { usedAt: new Date() });
    console.log('⏰ Expired token:', emailLogId);

    // Send reminder email
    const newToken = generateToken();
    const link = `${process.env.FRONTEND_URL}/update-form?token=${newToken}`;
    const optOutLink = `${process.env.FRONTEND_URL}/opt-out?token=${newToken}`;
    
    const html = `
      <h3>Hello ${user.name || "User"},</h3>
      <p>We noticed you haven't completed your data update form yet.</p>
      <p>Please take a moment to update your information:</p>
      <p>
        <a href="${link}" target="_blank" 
           style="background-color: #4CAF50; color: white; padding: 14px 20px; 
                  text-decoration: none; border-radius: 4px; display: inline-block;">
          Update Your Data
        </a>
      </p>
      <p>This link will expire in 24 hours.</p>
      <hr style="margin-top: 30px; border: none; border-top: 1px solid #ddd;" />
      <p style="font-size: 12px; color: #666;">
        If you no longer wish to receive these emails, 
        <a href="${optOutLink}" style="color: #666;">unsubscribe here</a>.
      </p>
    `;
    
    const emailSent = await sendEmail(user.email, 'Reminder: Update Your Data', html);
    console.log('📧 Email sent:', emailSent);
    
    if (emailSent) {
      await EmailLog.create({
        user: user._id,
        emailType: 'auto_defer_reminder',
        sentAt: new Date(),
        status: 'sent',
        linkToken: newToken,
      });
      console.log('📝 Created reminder email log');
    }
  } catch (err) {
    console.error('💥 Error in handleDeferredUser:', err);
  }
};
export default handleDeferredUser;