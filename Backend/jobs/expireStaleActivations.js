import EmailLog from '../models/EmailLog.js';
import InactiveUser from '../models/InactiveUser.js';
import UpdatedData from '../models/UpdatedData.js';
import handleDeferredUser from '../utils/deferHelper.js';
import DeferredData from '../models/DeferredData.js';

export default async function expireStaleActivations() {
  console.log('🧹 Checking for stale activations...');
  try {
    // 10 minutes threshold
    const cutoff = new Date(Date.now() - 10 * 60 * 1000);

    // find activations opened more than 10 min ago but not completed
    // ✅ Exclude tokens with OAuth in progress (extended to 30 min)
    const staleLogs = await EmailLog.find({
      activatedAt: { $lte: cutoff },
      usedAt: null,
      status: { $nin: ['expired', 'used'] }, // Exclude already processed
      isOAuthInProgress: { $ne: true }, // Don't expire during OAuth
    }).populate('user');

    if (staleLogs.length === 0) {
      console.log('🧹 No stale activations found.');
      return;
    }

    for (const log of staleLogs) {
      // ✅ Check if user opted out (defensive programming)
      if (log.user.isOptedOut) {
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
        console.log(`🛑 Max reminders (${reminderCount}) sent to ${log.user.email} - archiving as opened_abandoned`);
        
        // ✅ Archive user who opened but never submitted
        const submitted = await UpdatedData.findOne({ user: log.user._id });
        if (!submitted) {
          try {
            const emailsSent = await EmailLog.countDocuments({ 
              user: log.user._id, 
              emailType: { $in: ['initial_form', 'update_form_reminder'] }
            });
            
            const emailsOpened = await EmailLog.countDocuments({ 
              user: log.user._id, 
              activatedAt: { $ne: null }
            });
            
            const lastEmailLog = await EmailLog.findOne({ user: log.user._id })
              .sort('-sentAt')
              .select('sentAt')
              .lean();
            
            const lastOpenedLog = await EmailLog.findOne({ 
              user: log.user._id, 
              activatedAt: { $ne: null } 
            })
              .sort('-activatedAt')
              .select('activatedAt')
              .lean();
            
            const deferred = await DeferredData.findOne({ user: log.user._id });
            
            await InactiveUser.findOneAndUpdate(
              { user: log.user._id },
              {
                $set: {
                  email: log.user.email,
                  reason: 'opened_abandoned',
                  totalDeferrals: deferred?.attempts || 0,
                  totalEmailsSent: emailsSent,
                  totalEmailsOpened: emailsOpened,
                  lastEmailSentAt: lastEmailLog?.sentAt,
                  lastOpenedAt: lastOpenedLog?.activatedAt,
                  markedInactiveAt: new Date(),
                  source: 'update_form',
                  canReengage: true,
                  notes: `Opened ${emailsOpened}/${emailsSent} emails but never submitted. Abandoned after opening.`
                }
              },
              { upsert: true, new: true }
            );
            
            console.log(`📦 Archived opened-but-abandoned user: ${log.user.email} (opened ${emailsOpened}, never submitted)`);
            
            // Clean up deferred data if exists
            if (deferred) {
              await DeferredData.deleteOne({ _id: deferred._id });
            }
          } catch (archiveErr) {
            console.error(`❌ Failed to archive opened-abandoned user ${log.user.email}:`, archiveErr.message);
          }
        }
        
        await EmailLog.updateOne({ _id: log._id }, { $set: { status: 'expired' } });
        continue;
      }
      
      // ✅ Use upsert logic to avoid duplicates
      let deferred = await DeferredData.findOne({ user: log.user._id });
      if (deferred) {
        if (deferred.attempts < 3) {
          deferred.attempts += 1;
          deferred.deferredAt = new Date();
          await deferred.save();
          console.log(`🔄 Updated deferred record for ${log.user.email} (attempt ${deferred.attempts})`);
        } else {
          console.log(`🛑 Max deferred attempts for ${log.user.email} - marking token as expired`);
          await EmailLog.updateOne({ _id: log._id }, { $set: { status: 'expired' } });
        }
      } else {
        await DeferredData.create({
          user: log.user._id,
          attempts: 1,
          deferredAt: new Date(),
        });
        console.log(`🆕 Created deferred record for ${log.user.email}`);
      }
      
      // Mark token as expired after creating/updating DeferredData
      await EmailLog.updateOne({ _id: log._id }, { $set: { status: 'expired' } });
      console.log(`🧹 Marked stale activation for ${log.user.email} as expired`);
    }

    console.log(`🧹 Expired ${staleLogs.length} stale activation(s).`);
  } catch (error) {
    console.error('❌ Error in expireStaleActivations:', error.message);
  }
}



