// server/controllers/emailController.js
import EmailUser from "../models/EmailUsers.js";
import DeferredData from "../models/DeferredData.js";
import UpdatedData from "../models/UpdatedData.js";
import EmailLog from "../models/EmailLog.js";
import sendEmail from "../utils/nodemailer.js";
import { generateToken } from "../utils/tokenUtils.js";

// ------------------------------
// 1️⃣ Send initial email batch
// ------------------------------
const sendFormEmails = async (req, res) => {
  try {
    const users = await EmailUser.find();
    let sentCount = 0;

    // ✅ Rate limiting helper
    const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

    for (let i = 0; i < users.length; i++) {
      const user = users[i];
      // ✅ Skip if user opted out
      if (user.isOptedOut) {
        console.log(`🚫 Skipping ${user.email} — user opted out`);
        continue;
      }

      // ✅ Skip if already updated
      const updated = await UpdatedData.findOne({ user: user._id });
      if (updated) {
        console.log(`⏭️  Skipping ${user.email} — already submitted`);
        continue;
      }

      // ✅ Check if deferred - send email if under 3 attempts
      const deferred = await DeferredData.findOne({ user: user._id });
      if (deferred) {
        if (deferred.attempts >= 3) {
          console.log(`🚫 Skipping ${user.email} — max attempts reached`);
          continue;
        }
        // ✅ Allow sending to deferred users (they'll get reminder logic)
        console.log(`🔄 Sending to deferred user ${user.email} (attempt ${deferred.attempts + 1}/3)`);
      }

      // ✅ Skip users without an email
      if (!user.email) {
        console.warn(`Skipping user ${user._id} - no email`);
        continue;
      }

      // ✅ Generate unique token and link
      const token = generateToken();
      const link = `${process.env.FRONTEND_URL}/update-form?token=${token}`;
      const optOutLink = `${process.env.FRONTEND_URL}/opt-out?token=${token}`;

      // ✅ Assign default role
      if (!user.role) {
        user.role = "Self";
        await user.save();
      }

      // ✅ Email content with unsubscribe link
      const html = `
        <h3>Hello ${user.name || "User"},</h3>
        <p>Please update your data by clicking the secure link below:</p>
        <p><a href="${link}" target="_blank">Update Your Data</a></p>
        <p>This link will expire in 24 hours.</p>
        <hr style="margin-top: 30px; border: none; border-top: 1px solid #ddd;" />
        <p style="font-size: 12px; color: #666;">
          If you no longer wish to receive these emails, 
          <a href="${optOutLink}" style="color: #666;">unsubscribe here</a>.
        </p>
      `;

      console.log(`📧 Sending email to ${user.email}`);

      const emailSent = await sendEmail(user.email, "Update Your Data", html);

      if (emailSent) {
        // ✅ Log sent email
        await EmailLog.create({
          user: user._id,
          emailType: "update_form",
          sentAt: new Date(),
          status: "sent",
          linkToken: token,
          verifiedPhone: null, // 🔹 placeholder for Firebase verification
        });

        // ✅ Update user record
        user.lastEmailSent = new Date();
        user.emailSentCount = (user.emailSentCount || 0) + 1;
        await user.save();

        sentCount++;
      } else {
        // ❌ Email failed
        await EmailLog.create({
          user: user._id,
          emailType: "update_form",
          sentAt: new Date(),
          status: "failed",
          linkToken: token,
          verifiedPhone: null,
        });

        // ✅ Add to DeferredData for retry
        const existingDeferred = await DeferredData.findOne({ user: user._id });
        if (existingDeferred) {
          existingDeferred.attempts += 1;
          existingDeferred.deferredAt = new Date();
          await existingDeferred.save();
        } else {
          await DeferredData.create({ user: user._id });
        }
      }

      // ✅ Rate limiting: pause after every email to prevent SMTP throttling
      // Configurable via EMAIL_DELAY_MS environment variable (default: 1500ms)
      if (i < users.length - 1) {
        const delayMs = parseInt(process.env.EMAIL_DELAY_MS) || 1500;
        if ((i + 1) % 10 === 0) {
          console.log(`⏸️  Progress: ${i + 1}/${users.length} emails sent...`);
        }
        await delay(delayMs);
      }
    }

    console.log(`✅ ${sentCount} emails sent successfully.`);
    res.status(200).json({ message: "Emails sent successfully", sentCount });
  } catch (err) {
    console.error("❌ Error sending form emails:", err);
    res.status(500).json({ error: "Server error" });
  }
};
if (!process.env.FRONTEND_URL) {
  throw new Error('FRONTEND_URL is not set in environment variables');
}
// ------------------------------
// 2️⃣ Resend deferred emails (cron)
// ------------------------------
const resendDeferredEmails = async () => {
  try {
    console.log("🔍 Starting deferred email resend check...");

    const deferredUsers = await DeferredData.find({ attempts: { $lt: 3 } }).populate("user");
    console.log(`📋 Found ${deferredUsers.length} deferred users to process.`);

    for (const deferred of deferredUsers) {
      const user = deferred.user;
      if (!user) {
        console.warn("⚠️ Deferred entry missing user reference, removing...");
        await DeferredData.deleteOne({ _id: deferred._id });
        continue;
      }

      if (user.isOptedOut) {
        console.log(`🚫 Skipping deferred ${user.email} — opted out`);
        await DeferredData.deleteOne({ _id: deferred._id });
        continue;
      }

      const updated = await UpdatedData.findOne({ user: user._id });
      if (updated) {
        console.log(`⏭️ Skipping ${user.email} — already updated`);
        await DeferredData.deleteOne({ _id: deferred._id });
        continue;
      }

      // ✅ Additional safety: Check total reminder count to prevent infinite loop
      const reminderCount = await EmailLog.countDocuments({
        user: user._id,
        emailType: 'update_form_reminder'
      });
      
      if (reminderCount >= 3) {
        console.log(`🛑 Max reminders (${reminderCount}) already sent to ${user.email} - removing from deferred`);
        await DeferredData.deleteOne({ _id: deferred._id });
        await EmailLog.updateMany({ user: user._id, usedAt: null }, { usedAt: new Date() });
        continue;
      }

      const token = generateToken();
      const link = `${process.env.FRONTEND_URL}/update-form?token=${token}`;
      const optOutLink = `${process.env.FRONTEND_URL}/opt-out?token=${token}`;

      const html = `
        <h3>Hello ${user.name || "User"},</h3>
        <p>This is a friendly reminder to update your data:</p>
        <p><a href="${link}" target="_blank">Update Your Data</a></p>
        <p>This link will expire in 24 hours.</p>
        <hr style="margin-top: 30px; border: none; border-top: 1px solid #ddd;" />
        <p style="font-size: 12px; color: #666;">
          If you no longer wish to receive these emails, 
          <a href="${optOutLink}" style="color: #666;">unsubscribe here</a>.
        </p>
      `;

      console.log(`📧 Sending reminder to ${user.email}`);
      const emailSent = await sendEmail(user.email, "Reminder: Update Your Data", html);

      if (emailSent) {
        console.log(`✅ Reminder sent to ${user.email}`);
        await EmailLog.create({
          user: user._id,
          emailType: "update_form_reminder",
          sentAt: new Date(),
          status: "sent",
          linkToken: token,
          verifiedPhone: null,
        });

        // ✅ Use atomic increment to prevent race conditions
        await DeferredData.updateOne(
          { _id: deferred._id, attempts: { $lt: 3 } },
          { 
            $inc: { attempts: 1 },
            $set: { deferredAt: new Date() }
          }
        );
      } else {
        console.log(`❌ Reminder failed for ${user.email}`);
        await EmailLog.create({
          user: user._id,
          emailType: "update_form_reminder",
          sentAt: new Date(),
          status: "failed",
          linkToken: token,
          verifiedPhone: null,
        });

        // ✅ Use atomic increment even on failure
        await DeferredData.updateOne(
          { _id: deferred._id, attempts: { $lt: 3 } },
          { 
            $inc: { attempts: 1 },
            $set: { deferredAt: new Date() }
          }
        );
      }
    }

    // 🧹 Cleanup users who have already updated
    const updatedUsers = await UpdatedData.find().select("user");
    const updatedUserIds = updatedUsers.map((u) => u.user);
    await DeferredData.deleteMany({ user: { $in: updatedUserIds } });

    // 🧹 Remove users who exceeded 3 attempts AND mark their tokens as used
    const maxedOut = await DeferredData.find({ attempts: { $gte: 3 } }).select('user');
    if (maxedOut.length > 0) {
      // Mark all their open tokens as used to prevent re-adding to deferred
      for (const def of maxedOut) {
        await EmailLog.updateMany(
          { user: def.user, usedAt: null },
          { usedAt: new Date() }
        );
      }
      
      const removed = await DeferredData.deleteMany({ attempts: { $gte: 3 } });
      console.log(`🧹 Removed ${removed.deletedCount} deferred users after max attempts (tokens marked as used).`);
    }

    console.log("✅ Deferred email resend process completed.");
  } catch (err) {
    console.error("❌ Error resending deferred emails:", err);
  }
};

export { sendFormEmails, resendDeferredEmails };
