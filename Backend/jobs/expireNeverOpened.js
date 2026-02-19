import EmailLog from '../models/EmailLog.js';
import InactiveUser from '../models/InactiveUser.js';
import UpdatedData from '../models/UpdatedData.js';
import DeferredData from '../models/DeferredData.js';
import handleDeferredUser from '../utils/deferHelper.js';

const expireNeverOpened = async () => {
  try {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
    
    // ✅ Use null instead of $exists for better query performance
    const neverOpened = await EmailLog.find({
      activatedAt: null, // Never opened (explicitly null)
      sentAt: { $lt: cutoff },
      usedAt: null,
      status: { $nin: ['expired', 'used'] } // Exclude already processed tokens
    }).populate('user');

    for (const log of neverOpened) {
      // ✅ Check if user opted out (defensive programming)
      if (log.user?.isOptedOut) {
        console.log(`🚫 Skipping ${log.user.email} - user opted out`);
        await EmailLog.updateOne({ _id: log._id }, { $set: { status: 'expired' } });
        continue;
      }

      // ✅ Check total reminder count to prevent infinite loop
      const reminderCount = await EmailLog.countDocuments({
        user: log.user._id,
        emailType: 'update_form_reminder'
      });
      
      if (reminderCount >= 3) {
        console.log(`🛑 Max reminders (${reminderCount}) sent to ${log.user.email} - archiving as never_opened`);
        
        // ✅ Archive user who never opened any email
        const submitted = await UpdatedData.findOne({ user: log.user._id });
        if (!submitted) {
          try {
            const emailsSent = await EmailLog.countDocuments({ 
              user: log.user._id, 
              emailType: { $in: ['initial_form', 'update_form_reminder'] }
            });
            
            const lastEmailLog = await EmailLog.findOne({ user: log.user._id })
              .sort('-sentAt')
              .select('sentAt')
              .lean();
            
            const deferred = await DeferredData.findOne({ user: log.user._id });
            
            await InactiveUser.findOneAndUpdate(
              { user: log.user._id },
              {
                $set: {
                  email: log.user.email,
                  reason: 'never_opened',
                  totalDeferrals: deferred?.attempts || 0,
                  totalEmailsSent: emailsSent,
                  totalEmailsOpened: 0, // Never opened
                  lastEmailSentAt: lastEmailLog?.sentAt,
                  lastOpenedAt: null,
                  markedInactiveAt: new Date(),
                  source: 'update_form',
                  canReengage: true,
                  notes: `Never opened any of ${emailsSent} emails sent. Possible inactive/invalid email address.`
                }
              },
              { upsert: true, new: true }
            );
            
            console.log(`📦 Archived never-opened user: ${log.user.email} (${emailsSent} emails sent, 0 opened)`);
            
            // Clean up deferred data if exists
            if (deferred) {
              await DeferredData.deleteOne({ _id: deferred._id });
            }
          } catch (archiveErr) {
            console.error(`❌ Failed to archive never-opened user ${log.user.email}:`, archiveErr.message);
          }
        }
        
        await EmailLog.updateOne({ _id: log._id }, { $set: { status: 'expired' } });
        continue;
      }

      await handleDeferredUser(log.user, log._id);
    }

    if (neverOpened.length > 0) {
      console.log(`📧 Expired ${neverOpened.length} never-opened tokens`);
    }
  } catch (err) {
    console.error('❌ Never-opened cleanup failed:', err);
  }
};

export default expireNeverOpened;
