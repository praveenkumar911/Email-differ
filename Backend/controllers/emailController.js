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
      //const optOutLink = `${process.env.FRONTEND_URL}/opt-out?token=${token}`;

      // ✅ Assign default role
      if (!user.role) {
        user.role = "Self";
        await user.save();
      }

      // ✅ Email content with unsubscribe link
      const html = `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 650px; margin: 0 auto; color: #333; line-height: 1.6;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 600;">Introducing Badal</h1>
            <p style="color: #f0f0f0; margin: 10px 0 0 0; font-size: 16px;">A new home for your C4GT journey!</p>
          </div>
          
          <div style="background-color: #ffffff; padding: 40px 35px; border: 1px solid #e0e0e0; border-top: none;">
            <p style="font-size: 16px; margin-bottom: 20px;">Dear <strong>${user.name || "C4GT Community Member"}</strong>,</p>
            
            <p style="font-size: 15px; margin-bottom: 16px;">
              From the very first line of code to every milestone reached, your energy has been the heartbeat of Code for GovTech. 
              You've navigated Discord, GitHub, and our website to make an impact - and now, we've built something to make that journey 
              smoother, more rewarding, and uniquely yours.
            </p>
            
            <p style="font-size: 15px; margin-bottom: 20px;">
              We are thrilled to introduce <a href="https://pl-app.iiit.ac.in/rcts/codeforgovtech/home" style="color: #667eea; text-decoration: none; font-weight: bold;" target="_blank">Badal</a> - the new, all-in-one platform designed to be 
              the single home for everything C4GT.
            </p>
            
            <h2 style="color: #667eea; font-size: 20px; margin: 30px 0 16px 0; font-weight: 600;">Why Badal?</h2>
            
            <div style="margin: 20px 0;">
              <p style="margin: 12px 0; font-size: 15px;">
                <strong style="color: #764ba2;">🔑 One-Stop Access:</strong> A single sign-on using your GitHub and Discord IDs. Connect them once, and you're set!
              </p>
              <p style="margin: 12px 0; font-size: 15px;">
                <strong style="color: #764ba2;">🔍 Smart Project Discovery:</strong> Find the perfect project in seconds. Filter by tech stack, domain, or organization 
                to find work that matches your passion. Not only projects, browse entire repositories with a single click.
              </p>
              <p style="margin: 12px 0; font-size: 15px;">
                <strong style="color: #764ba2;">👤 Your Personal Contributor Profile:</strong> A dedicated space that captures your entire journey - your contributions, 
                your role (whether you're a Mentor, Contributor, or NGO partner), and your growth over time.
              </p>
              <p style="margin: 12px 0; font-size: 15px;">
                <strong style="color: #764ba2;">📊 Unified Visibility:</strong> Beyond the leaderboard, you can now see the overall metrics of the C4GT ecosystem 
                and track your impact in real-time.
              </p>
            </div>
            
            <h2 style="color: #667eea; font-size: 20px; margin: 30px 0 16px 0; font-weight: 600;">Ready to move in? 🏠</h2>
            
            <p style="font-size: 15px; margin-bottom: 16px;">Getting started on Badal is easy.</p>
            
            <div style="background-color: #f8f9ff; border-left: 4px solid #667eea; padding: 20px; margin: 25px 0;">
              <p style="margin: 0 0 15px 0; font-size: 15px; font-weight: 600; color: #333;">
                Fill in your details to help us create your profile. Just make sure to complete the form before signing in.
              </p>
              <p style="text-align: center; margin: 20px 0;">
                <a href="${link}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);">Complete Your Profile</a>
              </p>
              <p style="text-align: center; margin: 15px 0 5px 0; font-size: 14px; color: #666;">
                Or copy this link: <a href="${link}" style="color: #667eea; text-decoration: none; word-break: break-all;">${link}</a>
              </p>
              <p style="text-align: center; margin: 5px 0 0 0; font-size: 12px; color: #888;">
                ⏱️ This personalized link will expire in 24 hours.
              </p>
            </div>
            
            <p style="font-size: 14px; color: #666; background-color: #fff8e1; padding: 15px; border-radius: 6px; margin: 25px 0;">
              <strong>Note:</strong> While our community remains active on Discord for conversations, Badal is now your primary dashboard 
              for projects, metrics, and profiles.
            </p>
            
            <p style="font-size: 15px; margin: 25px 0 10px 0;">
              Thank you for being a part of this evolution. We can't wait to see your journey unfold on Badal!
            </p>
            
            <p style="font-size: 15px; margin-top: 20px;">
              <strong>Warmly,</strong><br>
              <span style="color: #667eea; font-weight: 600;">The C4GT Team</span>
            </p>
          </div>
          
         
        </div>
      `;

      console.log(`📧 Sending email to ${user.email}`);

      const emailSent = await sendEmail(user.email, "Introducing Badal: A new home for your C4GT journey!", html);

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

      // ✅ Rate limiting: pause every 10 emails to prevent SMTP throttling
      if ((i + 1) % 10 === 0 && i < users.length - 1) {
        console.log(`⏸️  Pausing for 1 second after ${i + 1} emails...`);
        await delay(1000);
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
      //const optOutLink = `${process.env.FRONTEND_URL}/opt-out?token=${token}`;

      const html = `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 650px; margin: 0 auto; color: #333; line-height: 1.6;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 600;">Introducing Badal</h1>
            <p style="color: #f0f0f0; margin: 10px 0 0 0; font-size: 16px;">A new home for your C4GT journey!</p>
          </div>
          
          <div style="background-color: #ffffff; padding: 40px 35px; border: 1px solid #e0e0e0; border-top: none;">
            <div style="background-color: #fff8e1; border-left: 4px solid #ffc107; padding: 15px 20px; margin-bottom: 25px; border-radius: 4px;">
              <p style="margin: 0; font-size: 15px; color: #856404;">
                <strong>⏰ C4GT Reminder:</strong> We noticed you haven't set up your Badal profile yet. Your contributions are waiting to be showcased!
              </p>
            </div>
            
            <p style="font-size: 16px; margin-bottom: 20px;">Dear <strong>${user.name || "C4GT Community Member"}</strong>,</p>
            
            <p style="font-size: 15px; margin-bottom: 16px;">
              From the very first line of code to every milestone reached, your energy has been the heartbeat of Code for GovTech. 
              You've navigated Discord, GitHub, and our website to make an impact - and now, we've built something to make that journey 
              smoother, more rewarding, and uniquely yours.
            </p>
            
            <p style="font-size: 15px; margin-bottom: 20px;">
              We are thrilled to introduce <a href="https://pl-app.iiit.ac.in/rcts/codeforgovtech/home" style="color: #667eea; text-decoration: none; font-weight: bold;" target="_blank">Badal</a> - the new, all-in-one platform designed to be 
              the single home for everything C4GT.
            </p>
            
            <h2 style="color: #667eea; font-size: 20px; margin: 30px 0 16px 0; font-weight: 600;">Why Badal?</h2>
            
            <div style="margin: 20px 0;">
              <p style="margin: 12px 0; font-size: 15px;">
                <strong style="color: #764ba2;">🔑 One-Stop Access:</strong> A single sign-on using your GitHub and Discord IDs. Connect them once, and you're set!
              </p>
              <p style="margin: 12px 0; font-size: 15px;">
                <strong style="color: #764ba2;">🔍 Smart Project Discovery:</strong> Find the perfect project in seconds. Filter by tech stack, domain, or organization 
                to find work that matches your passion. Not only projects, browse entire repositories with a single click.
              </p>
              <p style="margin: 12px 0; font-size: 15px;">
                <strong style="color: #764ba2;">👤 Your Personal Contributor Profile:</strong> A dedicated space that captures your entire journey - your contributions, 
                your role (whether you're a Mentor, Contributor, or NGO partner), and your growth over time.
              </p>
              <p style="margin: 12px 0; font-size: 15px;">
                <strong style="color: #764ba2;">📊 Unified Visibility:</strong> Beyond the leaderboard, you can now see the overall metrics of the C4GT ecosystem 
                and track your impact in real-time.
              </p>
            </div>
            
            <h2 style="color: #667eea; font-size: 20px; margin: 30px 0 16px 0; font-weight: 600;">Ready to move in? 🏠</h2>
            
            <p style="font-size: 15px; margin-bottom: 16px;">Getting started on Badal is easy.</p>
            
            <div style="background-color: #f8f9ff; border-left: 4px solid #667eea; padding: 20px; margin: 25px 0;">
              <p style="margin: 0 0 15px 0; font-size: 15px; font-weight: 600; color: #333;">
                Fill in your details to help us create your profile. Just make sure to complete the form before signing in.
              </p>
              <p style="text-align: center; margin: 20px 0;">
                <a href="${link}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);">Complete Your Profile</a>
              </p>
              <p style="text-align: center; margin: 15px 0 5px 0; font-size: 14px; color: #666;">
                Or copy this link: <a href="${link}" style="color: #667eea; text-decoration: none; word-break: break-all;">${link}</a>
              </p>
              <p style="text-align: center; margin: 8px 0 0 0; font-size: 12px; color: #888; font-style: italic;">
                ⏱️ Your personalized profile link expires in 24 hours
              </p>
            </div>
            
            <p style="font-size: 14px; color: #666; background-color: #fff8e1; padding: 15px; border-radius: 6px; margin: 25px 0;">
              <strong>Note:</strong> While our community remains active on Discord for conversations, Badal is now your primary dashboard 
              for projects, metrics, and profiles.
            </p>
            
            <p style="font-size: 15px; margin: 25px 0 10px 0;">
              Thank you for being a part of this evolution. We can't wait to see your journey unfold on Badal!
            </p>
            
            <p style="font-size: 15px; margin-top: 20px;">
              <strong>Warmly,</strong><br>
              <span style="color: #667eea; font-weight: 600;">The C4GT Team</span>
            </p>
          </div>
          
          
        </div>
      `;

      console.log(`📧 Sending reminder to ${user.email}`);
      const emailSent = await sendEmail(user.email, "C4GT - Set up your Badal profile - Your journey awaits!", html);

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
  