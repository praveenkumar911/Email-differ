import EmailLog from '../models/EmailLog.js';
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
        await EmailLog.updateOne({ _id: log._id }, { usedAt: new Date() });
        continue;
      }

      // ✅ Check total reminder count to prevent infinite loop
      const reminderCount = await EmailLog.countDocuments({
        user: log.user._id,
        emailType: 'update_form_reminder'
      });
      
      if (reminderCount >= 3) {
        console.log(`🛑 Max reminders (${reminderCount}) already sent to ${log.user.email} - marking token as used`);
        await EmailLog.updateOne({ _id: log._id }, { usedAt: new Date() });
        await DeferredData.deleteOne({ user: log.user._id });
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
          console.log(`🛑 Max deferred attempts for ${log.user.email} - marking token as used`);
          await EmailLog.updateOne({ _id: log._id }, { usedAt: new Date() });
        }
      } else {
        await DeferredData.create({
          user: log.user._id,
          emailType: log.emailType,
          reason: 'User opened form but did not submit within 10 minutes',
          createdAt: new Date(),
        });
        console.log(`🆕 Created deferred record for ${log.user.email}`);
      }

      console.log(`🧹 Marked stale activation for ${log.user.email} (can still reopen)`);
    }

    console.log(`🧹 Expired ${staleLogs.length} stale activation(s).`);
  } catch (error) {
    console.error('❌ Error in expireStaleActivations:', error.message);
  }
}


