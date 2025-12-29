import EmailLog from '../models/EmailLog.js';
import handleDeferredUser from '../utils/deferHelper.js';

const expireNeverOpened = async () => {
  try {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
    
    // ✅ Use null instead of $exists for better query performance
    const neverOpened = await EmailLog.find({
      activatedAt: null, // Never opened (explicitly null)
      sentAt: { $lt: cutoff },
      usedAt: null
    }).populate('user');

    for (const log of neverOpened) {
      // ✅ Check if user opted out (defensive programming)
      if (log.user?.isOptedOut) {
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
        console.log(`🛑 Max reminders (${reminderCount}) already sent to ${log.user.email}`);
        await EmailLog.updateOne({ _id: log._id }, { usedAt: new Date() });
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