// server/controllers/emailController.js
import EmailUser from "../models/EmailUsers.js";
import DeferredData from "../models/DeferredData.js";
import UpdatedData from "../models/UpdatedData.js";
import EmailLog from "../models/EmailLog.js";
import InactiveUser from "../models/InactiveUser.js";
import sendEmail from "../utils/nodemailer.js";
import { generateToken } from "../utils/tokenUtils.js";

// ------------------------------
// 1️⃣ Send initial email batch
// ------------------------------
const sendFormEmails = async (req, res) => {
  try {
    const onlyUnsent = req.query.onlyUnsent === 'true';
    console.log(`Batch mode: ${onlyUnsent ? 'Only unsent users' : 'All eligible users'}`);

    const usersQuery = onlyUnsent
      ? { lastEmailSent: null }
      : {};

    const users = await EmailUser.find(usersQuery).lean(); // fast, read-only
    console.log(`Found ${users.length} users to process`);

    // Immediate response — client doesn't wait
    res.status(202).json({
      message: "Email batch started in background",
      totalUsers: users.length,
      mode: onlyUnsent ? 'onlyUnsent' : 'all',
      startedAt: new Date().toISOString()
    });

    // Background task
    (async () => {
      try {
        let sentCount = 0;
        const delay = ms => new Promise(r => setTimeout(r, ms));

        const isValidEmail = (email) =>
          email && typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

        for (let i = 0; i < users.length; i++) {
          const user = users[i];

          if (user.isOptedOut) {
            console.log(`🚫 Skipping ${user.email || user._id} — opted out`);
            continue;
          }

          const updated = await UpdatedData.findOne({ user: user._id });
          if (updated) {
            console.log(`⏭️ Skipping ${user.email || user._id} — already submitted`);
            continue;
          }

          const deferred = await DeferredData.findOne({ user: user._id });
          if (deferred && deferred.attempts >= 3) {
            console.log(`🚫 Skipping ${user.email || user._id} — max attempts reached`);
            continue;
          }

          // Collect valid emails
          const emailsToSend = [];
          if (user.email && isValidEmail(user.email)) {
            emailsToSend.push(user.email);
          }
          if (user.alternateEmails?.length) {
            const uniqueValid = user.alternateEmails
              .filter(alt => isValidEmail(alt) && alt.trim() !== user.email)
              .map(alt => alt.trim());
            emailsToSend.push(...uniqueValid);
          }

          if (emailsToSend.length === 0) {
            console.warn(`⚠️ Skipping user ${user._id} - no valid emails`);
            continue;
          }

          const token = generateToken();
          const link = `${process.env.FRONTEND_URL}/update-form?token=${token}`;

          // Ensure role exists
          if (!user.role) {
            await EmailUser.updateOne({ _id: user._id }, { $set: { role: "Self" } });
          }

          // Your HTML template (unchanged)
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
              We are thrilled to introduce <a href="https://pl-app.iiit.ac.in/c4gt" style="color: #667eea; text-decoration: none; font-weight: bold;" target="_blank">Badal</a> - the new, all-in-one platform designed to be 
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

          console.log(`📧 Sending to ${emailsToSend.length} address(es) for user ${user.name || user._id}`);

          let emailsSentForUser = 0;
          for (const recipientEmail of emailsToSend) {
            try {
              const emailSent = await sendEmail(
                recipientEmail,
                "Introducing Badal: A new home for your C4GT journey!",
                html
              );

              if (emailSent) {
                await EmailLog.create({
                  user: user._id,
                  recipientEmail,
                  emailType: "initial_form",
                  sentAt: new Date(),
                  status: "sent",
                  linkToken: token,
                  verifiedPhone: null,
                });
                emailsSentForUser++;
                console.log(`✅ Sent to ${recipientEmail}`);
              } else {
                throw new Error("sendEmail returned false");
              }
            } catch (err) {
              console.error(`❌ Failed for ${recipientEmail}: ${err.message}`);
              await EmailLog.create({
                user: user._id,
                recipientEmail,
                emailType: "initial_form",
                sentAt: new Date(),
                status: "failed",
                linkToken: token,
                verifiedPhone: null,
              });
            }
          }

          if (emailsSentForUser > 0) {
            await EmailUser.updateOne(
              { _id: user._id },
              {
                $set: { lastEmailSent: new Date() },
                $inc: { emailSentCount: emailsSentForUser }
              }
            );
            sentCount += emailsSentForUser;
          } else {
            // Deferred logic
            const existingDeferred = await DeferredData.findOne({ user: user._id });
            if (existingDeferred) {
              await DeferredData.updateOne(
                { _id: existingDeferred._id },
                { $inc: { attempts: 1 }, $set: { deferredAt: new Date() } }
              );
            } else {
              await DeferredData.create({ user: user._id });
            }
          }

          // Rate limit: pause every 10 users
          if ((i + 1) % 10 === 0 && i < users.length - 1) {
            console.log(`⏸️ Pausing 1s after ${i + 1} users`);
            await delay(1000);
          }
        }

        console.log(`✅ Background batch complete: ${sentCount} emails sent`);

        // Admin notification (success)
        try {
          await sendEmail(
            process.env.ADMIN_EMAIL || 'sampathchowdarie@gmail.com',
            'C4GT Email Batch Complete',
            `<p>Batch finished: ${new Date().toISOString()}</p>
             <p>Users processed: ${users.length}</p>
             <p>Emails sent: ${sentCount}</p>
             <p>Mode: ${onlyUnsent ? 'Only unsent' : 'All eligible'}</p>`
          );
          console.log("📧 Admin success notification sent");
        } catch (notifyErr) {
          console.error("⚠️ Admin notification failed:", notifyErr.message);
        }

      } catch (backgroundErr) {
        console.error("❌ Background batch failed:", backgroundErr);

        // Admin failure notification
        try {
          await sendEmail(
            process.env.ADMIN_EMAIL || 'admin@codeforgovtech.in',
            'C4GT Email Batch FAILED',
            `<p>Error occurred: ${backgroundErr.message}</p>
             <p>Check server logs for details.</p>`
          );
        } catch (failNotifyErr) {
          console.error("⚠️ Failed to send failure notification:", failNotifyErr.message);
        }
      }
    })();

  } catch (err) {
    console.error("❌ Error starting batch:", err);
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

      // ✅ Check total reminder count to prevent infinite loop
      const reminderCount = await EmailLog.countDocuments({
        user: user._id,
        emailType: 'update_form_reminder'
      });
      
      if (reminderCount >= 3) {
        console.log(`🛑 Max reminders (${reminderCount}) already sent to ${user.email} - archiving and removing from deferred`);
        
        // ✅ Archive as inactive user before removing
        try {
          const emailsSent = await EmailLog.countDocuments({ 
            user: user._id, 
            emailType: { $in: ['initial_form', 'update_form_reminder'] }
          });
          
          const emailsOpened = await EmailLog.countDocuments({ 
            user: user._id, 
            activatedAt: { $ne: null }
          });
          
          const lastEmailLog = await EmailLog.findOne({ user: user._id })
            .sort('-sentAt')
            .select('sentAt')
            .lean();
          
          const lastOpenedLog = await EmailLog.findOne({ 
            user: user._id, 
            activatedAt: { $ne: null } 
          })
            .sort('-activatedAt')
            .select('activatedAt')
            .lean();
          
          await InactiveUser.findOneAndUpdate(
            { user: user._id },
            {
              $set: {
                email: user.email,
                reason: 'max_reminders',
                totalDeferrals: deferred.attempts,
                totalEmailsSent: emailsSent,
                totalEmailsOpened: emailsOpened,
                lastEmailSentAt: lastEmailLog?.sentAt,
                lastOpenedAt: lastOpenedLog?.activatedAt,
                markedInactiveAt: new Date(),
                source: 'update_form',
                canReengage: true,
                notes: `Received ${reminderCount} reminders, no submission. Deferred ${deferred.attempts} times.`
              }
            },
            { upsert: true, new: true }
          );
          
          console.log(`📦 Archived user with max reminders: ${user.email}`);
        } catch (archiveErr) {
          console.error(`❌ Failed to archive user ${user.email}:`, archiveErr.message);
        }
        
        await DeferredData.deleteOne({ _id: deferred._id });
        
        // ✅ Check if user actually submitted before marking tokens
        const submitted = await UpdatedData.findOne({ user: user._id });
        if (submitted) {
          // User completed form - mark all tokens as used
          await EmailLog.updateMany(
            { user: user._id, usedAt: null, status: { $nin: ['expired', 'used'] } },
            { $set: { usedAt: new Date(), status: 'used' } }
          );
          console.log('✅ User submitted - all tokens marked as used');
        } else {
          // User never submitted - just mark as expired (don't set usedAt)
          await EmailLog.updateMany(
            { user: user._id, usedAt: null, status: { $nin: ['expired', 'used'] } },
            { $set: { status: 'expired' } }
          );
          console.log('⚠️ User never submitted - tokens marked as expired');
        }
        continue;
      }

      // ✅ Collect all email addresses for this user (primary + alternates)
      const emailsToSend = [];
      if (user.email) {
        emailsToSend.push(user.email);
      }
      if (user.alternateEmails && user.alternateEmails.length > 0) {
        // Remove duplicates
        const uniqueAlternates = user.alternateEmails.filter(
          altEmail => altEmail && altEmail !== user.email
        );
        emailsToSend.push(...uniqueAlternates);
      }

      // ✅ Skip if no valid emails
      if (emailsToSend.length === 0) {
        console.warn(`⚠️ Skipping deferred user ${user._id} - no valid emails`);
        await DeferredData.deleteOne({ _id: deferred._id });
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
              We are thrilled to introduce <a href="https://pl-app.iiit.ac.in/c4gt" style="color: #667eea; text-decoration: none; font-weight: bold;" target="_blank">Badal</a> - the new, all-in-one platform designed to be 
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

      console.log(`📧 Sending reminder to ${emailsToSend.length} address(es) for user ${user.name || user._id}`);
      
      // ✅ Send to all email addresses for this user
      let remindersSentForUser = 0;
      for (const recipientEmail of emailsToSend) {
        const emailSent = await sendEmail(recipientEmail, "C4GT - Set up your Badal profile - Your journey awaits!", html);

        if (emailSent) {
          console.log(`✅ Reminder sent to ${recipientEmail}`);
          await EmailLog.create({
            user: user._id,
            recipientEmail: recipientEmail,
            emailType: "update_form_reminder",
            sentAt: new Date(),
            status: "sent",
            linkToken: token,
            verifiedPhone: null,
          });

          remindersSentForUser++;
        } else {
          console.log(`❌ Reminder failed for ${recipientEmail}`);
          await EmailLog.create({
            user: user._id,
            recipientEmail: recipientEmail,
            emailType: "update_form_reminder",
            sentAt: new Date(),
            status: "failed",
            linkToken: token,
            verifiedPhone: null,
          });
        }
      }

      // ✅ If at least one reminder was sent successfully
      if (remindersSentForUser > 0) {
        // ✅ Use atomic increment to prevent race conditions
        await DeferredData.updateOne(
          { _id: deferred._id, attempts: { $lt: 3 } },
          { 
            $inc: { attempts: 1 },
            $set: { deferredAt: new Date() }
          }
        );
      } else {
        // ❌ All reminders failed - still increment attempts
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

    // 🧹 Archive users who exceeded 3 attempts (DON'T DELETE without archiving)
    const maxedOut = await DeferredData.find({ attempts: { $gte: 3 } }).populate('user');
    if (maxedOut.length > 0) {
      console.log(`📦 Found ${maxedOut.length} users with max deferrals - archiving...`);
      
      for (const def of maxedOut) {
        const user = def.user;
        if (!user) {
          console.warn('⚠️ DeferredData missing user reference, skipping...');
          continue;
        }
        
        const submitted = await UpdatedData.findOne({ user: user._id });
        
        if (!submitted) {
          // ✅ Archive inactive user with full tracking data
          try {
            // Count emails for audit trail
            const emailsSent = await EmailLog.countDocuments({ 
              user: user._id, 
              emailType: { $in: ['initial_form', 'update_form_reminder'] }
            });
            
            const emailsOpened = await EmailLog.countDocuments({ 
              user: user._id, 
              activatedAt: { $ne: null }
            });
            
            const lastEmailLog = await EmailLog.findOne({ user: user._id })
              .sort('-sentAt')
              .select('sentAt')
              .lean();
            
            const lastOpenedLog = await EmailLog.findOne({ 
              user: user._id, 
              activatedAt: { $ne: null } 
            })
              .sort('-activatedAt')
              .select('activatedAt')
              .lean();
            
            await InactiveUser.findOneAndUpdate(
              { user: user._id },
              {
                $set: {
                  email: user.email,
                  reason: 'max_deferrals',
                  totalDeferrals: def.attempts,
                  totalEmailsSent: emailsSent,
                  totalEmailsOpened: emailsOpened,
                  lastEmailSentAt: lastEmailLog?.sentAt,
                  lastOpenedAt: lastOpenedLog?.activatedAt,
                  markedInactiveAt: new Date(),
                  source: 'update_form',
                  canReengage: true,  // Can send "final reminder" campaign later
                  notes: `User deferred ${def.attempts} times. Last deferred: ${def.deferredAt}`
                }
              },
              { upsert: true, new: true }
            );
            
            console.log(`📦 Archived max-deferred user: ${user.email} (${def.attempts} attempts, ${emailsOpened}/${emailsSent} opened)`);
          } catch (archiveErr) {
            console.error(`❌ Failed to archive user ${user.email}:`, archiveErr.message);
          }
          
          // Mark tokens as expired (not used)
          await EmailLog.updateMany(
            { user: user._id, usedAt: null, status: { $nin: ['expired', 'used'] } },
            { $set: { status: 'expired' } }
          );
        } else {
          // User submitted - mark as used
          await EmailLog.updateMany(
            { user: user._id, usedAt: null, status: { $nin: ['expired', 'used'] } },
            { $set: { usedAt: new Date(), status: 'used' } }
          );
        }
      }
      
      // NOW delete DeferredData (after archiving)
      const removed = await DeferredData.deleteMany({ attempts: { $gte: 3 } });
      console.log(`🧹 Removed ${removed.deletedCount} deferred records after archiving to InactiveUser.`);
    }

    console.log("✅ Deferred email resend process completed.");
  } catch (err) {
    console.error("❌ Error resending deferred emails:", err);
  }
};

export { sendFormEmails, resendDeferredEmails };
  
