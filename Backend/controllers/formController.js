import UpdatedData from '../models/UpdatedData.js';
import DeferredData from '../models/DeferredData.js';
import EmailLog from '../models/EmailLog.js';
import EmailUser from '../models/EmailUsers.js';
import ActiveUser from '../models/ActiveUser.js'; // ✅ Added for real-time sync
import { generateToken } from '../utils/tokenUtils.js';
import OptOutUser from '../models/OptOutUser.js';
import PartialUpdateData from '../models/PartialUpdateData.js';
import { verifyFirebaseOtp } from '../utils/otpHelper.js';
import { auth, admin } from '../config/firebaseAdmin.js';
import mongoose from 'mongoose';
import { User } from '../models/usercollection.js'; // ✅ Import User for prod DB


// ✅ Production DB Connection (for User collection)
const PROD_MONGO_URI = process.env.PROD_MONGO_URI || process.env.MONGO_URI;
let prodConnection = null;

// Initialize prod connection
const getProdConnection = async () => {
  if (prodConnection && prodConnection.readyState === 1) {
    return prodConnection;
  }
  
  try {
    prodConnection = mongoose.createConnection(PROD_MONGO_URI);
    await prodConnection.asPromise();
    console.log('✅ Prod DB connected for direct user creation');
    return prodConnection;
  } catch (err) {
    console.error('❌ Prod DB connection failed:', err);
    throw new Error('Failed to connect to production database');
  }
};

// Get User model with prod connection
const getProdUserModel = async () => {
  const conn = await getProdConnection();
  return conn.model('User', User.schema);
};

// ✅ Global phone normalization - consistent across all functions
const normalizePhone = (num) => {
  if (!num) return '';
  const cleaned = num.replace(/\D/g, '').replace(/^91/, '');
  return cleaned.length === 10 ? `+91${cleaned}` : '';
};

// ✅ Field validation constants
const FIELD_LIMITS = {
  fullName: 100,
  email: 255,
  organisation: 200,
  githubUrl: 255,
  discordId: 100,
  linkedinId: 255,
};

// ✅ OTP expiry time (1 hour)
const OTP_EXPIRY_MS = 60 * 60 * 1000; 

// ✅ Phone normalization for User schema (10 digits only)
const normalizePhoneForUser = (num) => {
  if (!num) return null;
  let digits = String(num).replace(/\D/g, '');
  if (digits.startsWith('91') && digits.length === 12) {
    return digits.substring(2); // Return 10 digits only
  }
  if (digits.length === 10) {
    return digits;
  }
  return null;
};

// ------------------------------
// Activate token on first open
// ------------------------------
const activateToken = async (req, res) => {
  try {
    const token = req.body.token || req.query.token;
    // ✅ Check for empty string or null
    if (!token || token.trim() === '') {
      return res.status(400).json({ message: 'Valid token required' });
    }

    const log = await EmailLog.findOne({ linkToken: token });
    if (!log) return res.status(400).json({ message: 'Invalid token' });

    // ✅ Check if token was marked as used
    if (log.usedAt) {
      // Check if user actually submitted the form
      const submitted = await UpdatedData.findOne({ user: log.user });
      if (submitted) {
        return res.status(400).json({ message: 'Form already submitted' });
      }

      // ✅ Check if user intentionally deferred - don't allow reopening
      const deferred = await DeferredData.findOne({ user: log.user });
      if (deferred) {
        return res.status(400).json({ 
          message: 'This link has been closed. Please check your email for a new link.' 
        });
      }

      // ✅ Check if user opted out - don't allow reopening
      const optedOut = await OptOutUser.findOne({ user: log.user });
      if (optedOut) {
        return res.status(400).json({ 
          message: 'You have unsubscribed. This link is no longer valid.' 
        });
      }

      // ✅ Allow reopening within expiry window (accidental close only)
      const now = new Date();
      const expiryWindow = log.isOAuthInProgress ? 30 * 60 * 1000 : 10 * 60 * 1000;
      const expiryTime = log.activatedAt
        ? new Date(log.activatedAt.getTime() + expiryWindow)
        : new Date(log.sentAt.getTime() + 24 * 60 * 60 * 1000);

      if (now > expiryTime) {
        return res.status(400).json({ message: 'Link expired' });
      }

      // ✅ Clear stale flags and reset activation time (accidental close only)
      log.usedAt = null;
      log.activatedAt = new Date(); // Reset timer on reopen
      console.log(`🔄 Allowing token reopen for user (accidental close, within ${expiryWindow / 60000} min window)`);
    } else if (!log.activatedAt) {
      // Set activatedAt only on first open
      log.activatedAt = new Date();
    }

    await log.save();
    res.status(200).json({ 
      success: true,
      activatedAt: log.activatedAt,
      expiryTime: new Date(log.activatedAt.getTime() + (log.isOAuthInProgress ? 30 : 10) * 60 * 1000)
    });
  } catch (err) {
    console.error('Activation error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};


// ------------------------------
// Validate token with dual expiry logic
// ------------------------------
const validateToken = async (req, res) => {
  try {
    const { token } = req.params;
    // ✅ Check for empty string
    if (!token || token.trim() === '') {
      return res.status(200).json({ valid: false, message: 'Invalid token' });
    }
    
    const log = await EmailLog.findOne({ linkToken: token });
    if (!log) return res.status(200).json({ valid: false, message: 'Invalid token' });

    if (log.usedAt)
      return res.status(200).json({ valid: false, message: 'Link already used' });

    const now = new Date();
    const expiryTime = log.activatedAt
      ? new Date(log.activatedAt.getTime() + 10 * 60 * 1000)
      : new Date(log.sentAt.getTime() + 24 * 60 * 60 * 1000);

    if (now > expiryTime)
      return res.status(200).json({ valid: false, message: 'Token expired' });

    const alreadySubmitted = await UpdatedData.findOne({ user: log.user });
    if (alreadySubmitted)
      return res.status(200).json({ valid: false, message: 'Already submitted' });

    res.status(200).json({ valid: true, message: 'Token valid' });
  } catch (err) {
    console.error('Validation error:', err);
    res.status(500).json({ valid: false, message: 'Server error' });
  }
};


// ------------------------------
// Verify Phone OTP for form
// ------------------------------

const verifyPhoneOtp = async (req, res) => {
  try {
    const { token, phone, firebaseToken } = req.body;
    if (!token || !phone || !firebaseToken) {
      return res.status(400).json({ message: "Token, phone, and Firebase token required" });
    }

    // 🔹 Verify Firebase token
    const decoded = await auth.verifyIdToken(firebaseToken);
    
    const firebasePhone = decoded.phone_number; // should include +91 prefix

    // 🔹 Use standardized normalization
    const normalizedBackend = normalizePhone(phone);
    const normalizedFirebase = normalizePhone(firebasePhone || "");

    if (normalizedBackend !== normalizedFirebase) {
      return res.status(400).json({ message: "Phone number verification mismatch. Please try again." });
    }

    // 🔹 Mark verified phone in EmailLog with timestamp
    const updated = await EmailLog.findOneAndUpdate(
      { linkToken: token },
      { 
        verifiedPhone: normalizedBackend,
        phoneVerifiedAt: new Date() // ✅ Add timestamp for expiry check
      },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ message: "Invalid or expired token" });
    }

    console.log(`✅ Phone verified successfully for ${updated.email || "unknown user"}: ${normalizedBackend}`);

    return res.status(200).json({ 
      message: "Phone verified successfully",
      verifiedAt: updated.phoneVerifiedAt
    });
  } catch (err) {
    console.error("❌ Phone verification error:", err);
    return res.status(500).json({ message: "Phone verification failed. Please try again." });
  }
};



// ------------------------------
// Submit form (mark as used + sync to ActiveUsers)
// ------------------------------
const submitForm = async (req, res) => {
  try {
    const { token, firebaseToken, ...formData } = req.body;

    // ✅ Validate token and firebaseToken
    if (!token || token.trim() === '') {
      return res.status(400).json({ message: 'Valid token required' });
    }
    
    if (!firebaseToken || firebaseToken.trim() === '') {
      return res.status(400).json({ message: 'Firebase token required' });
    }

    // ✅ Validate field lengths
    for (const [field, limit] of Object.entries(FIELD_LIMITS)) {
      if (formData[field] && formData[field].length > limit) {
        return res.status(400).json({ 
          message: `${field} exceeds maximum length of ${limit} characters` 
        });
      }
    }

    // Find and validate log
    const log = await EmailLog.findOne({ linkToken: token }).populate('user');
    if (!log) return res.status(400).json({ message: 'Invalid or expired token' });
    if (log.usedAt) return res.status(400).json({ message: 'This form has already been submitted' });

    // Check expiry (with OAuth consideration)
    const now = new Date();
    const expiryWindow = log.isOAuthInProgress ? 30 * 60 * 1000 : 10 * 60 * 1000;
    const expiryTime = log.activatedAt
      ? new Date(log.activatedAt.getTime() + expiryWindow)
      : new Date(log.sentAt.getTime() + 24 * 60 * 60 * 1000);
    
    if (now > expiryTime) {
      return res.status(400).json({ message: 'Your session has expired. Please request a new link.' });
    }

    // Check if already submitted
    const alreadySubmitted = await UpdatedData.findOne({ user: log.user });
    if (alreadySubmitted) {
      return res.status(400).json({ message: 'You have already submitted this form' });
    }

    // ✅ Use standardized phone normalization
    const normalizedFormPhone = normalizePhone(formData.phone);
    const normalizedVerifiedPhone = log.verifiedPhone || '';

    if (!normalizedFormPhone) {
      return res.status(400).json({ message: 'Invalid phone number format' });
    }

    // ✅ Check OTP expiry (1 hour from verification)
    if (log.phoneVerifiedAt) {
      const otpAge = now - new Date(log.phoneVerifiedAt);
      if (otpAge > OTP_EXPIRY_MS) {
        return res.status(400).json({ 
          message: 'Phone verification has expired. Please verify your phone again.' 
        });
      }
    }

    // ✅ Check if verified (EmailLog is primary source of truth)
    const isPhoneVerifiedInEmailLog = normalizedFormPhone === normalizedVerifiedPhone;
    
    if (!isPhoneVerifiedInEmailLog) {
      return res.status(400).json({ 
        message: 'Phone number not verified. Please verify your phone before submitting.' 
      });
    }

    // ✅ Check if phone belongs to another user in PRODUCTION DB
    const ProdUser = await getProdUserModel();
    
    // Normalize phone for User schema (10 digits only)
    const phoneForUserSchema = normalizePhoneForUser(normalizedFormPhone);
    
    const existingProdUser = await ProdUser.findOne({ 
      phoneNumber: phoneForUserSchema
    });
    
    if (existingProdUser) {
      return res.status(400).json({ 
        message: 'This phone number is already registered to another account.',
        userId: existingProdUser.userId
      });
    }

    // Organization Type mapping
    const ORG_TYPE_LABELS = {
      Government: "Government Organizations (Gov)",
      NGO: "Non-Governmental Organizations (NGO)",
      Academic: "Academic",
      Corporate: "Corporate (For-Profit)",
      Self: "Self",
    };

    // Role mapping (consistent with SignUpPage)
    const ROLE_MAP = {
      "R004": "Developer",
      "R005": "Mentor",
    };

    // ✅ Clean up empty OAuth fields
    const cleanedData = {
      fullName: formData.fullName?.trim(),
      email: formData.email?.trim(),
      phone: normalizedFormPhone,
      gender: formData.gender,
      organisation: formData.organisation?.trim(),
      orgType: ORG_TYPE_LABELS[formData.orgType] || formData.orgType,
      role: ROLE_MAP[formData.role] || formData.role,
      githubId: formData.githubId?.trim() || null,
      githubUrl: formData.githubUrl?.trim() || null,
      discordId: formData.discordId?.trim() || null,
      linkedinId: formData.linkedinId?.trim() || null,
    };

    // ✅ Step 1: Create UpdatedData record (for audit trail)
    console.log(`📝 Creating UpdatedData record for ${cleanedData.email || cleanedData.phone}...`);
    const updatedData = await UpdatedData.create({
      user: log.user,
      updatedData: cleanedData,
      submittedAt: new Date(),
    });
    console.log(`✅ UpdatedData record created with ID: ${updatedData._id}`);

    // ✅ Step 2: Create user directly in production database
    console.log(`🚀 Creating user directly in production DB...`);
    try {
      const result = await createUserInProduction(cleanedData, firebaseToken);
      
      if (!result.success) {
        // User already exists - return 409 Conflict with details
        return res.status(409).json({ 
          message: `User already exists: ${result.reason}`,
          userId: result.userId,
          existingUser: true
        });
      }
      
      console.log(`✅ User created in production DB: ${result.userId}`);
      
      // Store the created userId for reference
      updatedData.productionUserId = result.userId;
      await updatedData.save();
      
    } catch (prodErr) {
      console.error('❌ Production user creation failed:', prodErr);
      // Fail the submission if we can't create in production
      return res.status(500).json({ 
        message: "Unable to create user account. Please try again or contact support.",
        error: prodErr.message
      });
    }

    // ✅ Mark token as used
    log.usedAt = new Date();
    await log.save();

    // ✅ Clean up partial/deferred data
    await DeferredData.deleteMany({ user: log.user });
    await PartialUpdateData.deleteMany({ user: log.user });

    return res.status(200).json({ 
      message: "Form submitted successfully! Your information has been updated.",
      success: true
    });
  } catch (err) {
    console.error("Submit error:", err);
    res.status(500).json({ 
      message: "Unable to submit form. Please try again or contact support if the problem persists." 
    });
  }
};


// ------------------------------
// Defer form (mark as used)
// ------------------------------
const deferForm = async (req, res) => {
  try {
    const { token } = req.body;

    const log = await EmailLog.findOne({ linkToken: token });
    if (!log) return res.status(400).json({ message: 'Invalid or expired token' });
    if (log.usedAt) return res.status(400).json({ message: 'This link has already been used' });

    const now = new Date();
    const expiryTime = log.activatedAt
      ? new Date(log.activatedAt.getTime() + 10 * 60 * 1000)
      : new Date(log.sentAt.getTime() + 24 * 60 * 60 * 1000);

    if (now > expiryTime) return res.status(400).json({ message: 'Token expired' });

    const alreadySubmitted = await UpdatedData.findOne({ user: log.user });
    if (alreadySubmitted) return res.status(400).json({ message: 'Already submitted' });

    let deferred = await DeferredData.findOne({ user: log.user });
    if (deferred) {
      if (deferred.attempts >= 3)
        return res.status(400).json({ message: 'Max attempts exceeded' });

      deferred.attempts += 1;
      deferred.deferredAt = new Date();
      await deferred.save();
    } else {
      await DeferredData.create({ user: log.user });
    }

    log.usedAt = new Date();
    await log.save();

    res.status(200).json({ message: 'Form deferred successfully' });
  } catch (err) {
    console.error('Defer error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};


// ------------------------------
// Handle user closing form without submitting
// ------------------------------
const handleFormClose = async (req, res) => {
  try {
    let token;
    if (req.is('application/json')) ({ token } = req.body);
    else token = JSON.parse(req.body).token;

    if (!token) return res.status(400).json({ message: 'Token required' });

    const log = await EmailLog.findOne({ linkToken: token }).populate('user');
    if (!log) return res.status(200).end();

    console.log(`🧠 User closed form: ${log.user?.email || 'unknown'}`);
    // ✅ Don't mark token as used - allow user to reopen
    // ✅ Don't create DeferredData - let expireStaleActivations cron handle it
    return res.status(200).end();
  } catch (err) {
    console.error('❌ Error in handleFormClose:', err);
    return res.status(500).end();
  }
};


// ------------------------------
// Handle Opt-Out
// ------------------------------
const handleOptOut = async (req, res) => {
  try {
    const { token, reason } = req.body;
    if (!token) return res.status(400).json({ message: 'Token required' });

    const log = await EmailLog.findOne({ linkToken: token }).populate('user');
    if (!log) return res.status(404).json({ message: 'Invalid or unknown token' });

    const user = log.user;
    if (!user) return res.status(404).json({ message: 'User not found for token' });

    if (log.usedAt) return res.status(400).json({ message: 'Token already used' });

    log.usedAt = new Date();
    await log.save();

    const existing = await OptOutUser.findOne({ user: user._id });
    if (!existing) {
      await OptOutUser.create({
        user: user._id,
        email: user.email,
        reason: reason || '',
        linkToken: token,
        source: 'update_form',
      });
      console.log(`🛑 User ${user.email} opted out.`);
    } else {
      existing.reason = (existing.reason || '') + (reason ? `\n${reason}` : '');
      existing.linkToken = token;
      existing.optedOutAt = new Date();
      await existing.save();
      console.log(`🔁 Updated existing opt-out record for ${user.email}`);
    }

    await EmailUser.findByIdAndUpdate(user._id, {
      isOptedOut: true,
      optOutAt: new Date(),
    });

    const deferredDeleted = await DeferredData.deleteMany({ user: user._id });
    if (deferredDeleted.deletedCount > 0)
      console.log(`🧹 Removed ${deferredDeleted.deletedCount} deferred entries for ${user.email}`);

    const partialDeleted = await PartialUpdateData.deleteMany({ user: user._id });
    if (partialDeleted.deletedCount > 0)
      console.log(`🗑️ Removed ${partialDeleted.deletedCount} partial form data entries for ${user.email}`);

    return res.status(200).json({ message: 'Successfully opted out. You will not receive further emails.' });
  } catch (err) {
    console.error('❌ Error in handleOptOut:', err);
    return res.status(500).json({ message: 'Server error' });
  }
};


// ------------------------------
// Partial Save / Fetch / Delete
// ------------------------------
const savePartialForm = async (req, res) => {
  try {
    const { token, data } = req.body;
    if (!token) return res.status(400).json({ message: 'Token required' });

    const log = await EmailLog.findOne({ linkToken: token }).populate('user');
    if (!log || !log.user) return res.status(404).json({ message: 'Invalid token' });

    await PartialUpdateData.findOneAndUpdate(
      { user: log.user._id },
      { data, lastSavedAt: new Date() },
      { upsert: true, new: true }
    );

    return res.status(200).json({ message: 'Partial data saved' });
  } catch (err) {
    console.error('Error saving partial form:', err);
    return res.status(500).json({ message: 'Server error' });
  }
};

const getPartialForm = async (req, res) => {
  try {
    const { token } = req.params;
    const log = await EmailLog.findOne({ linkToken: token }).populate('user');
    if (!log || !log.user) return res.status(404).json({ message: 'Invalid token' });

    const partial = await PartialUpdateData.findOne({ user: log.user._id });
    return res.status(200).json({ data: partial ? partial.data : {} });
  } catch (err) {
    console.error('Error fetching partial form:', err);
    return res.status(500).json({ message: 'Server error' });
  }
};

const deletePartialForm = async (req, res) => {
  try {
    const { token } = req.params;
    if (!token) return res.status(400).json({ message: "Token required" });

    await PartialUpdateData.deleteOne({ token });
    return res.status(200).json({ message: "Partial form deleted" });
  } catch (err) {
    console.error("Error deleting partial form:", err);
    return res.status(500).json({ message: "Server error" });
  }
};
// ------------------------------
// 🔍 Check if user synced (UpdatedData → ActiveUser)
// ------------------------------
const checkSyncStatus = async (req, res) => {
  try {
    const { email, phone } = req.query;

    if (!email && !phone) {
      return res.status(400).json({ message: "Provide either email or phone" });
    }

    // Look up in UpdatedData
    const updated = await UpdatedData.findOne({
      $or: [
        { "updatedData.email": email },
        { "updatedData.phone": phone }
      ]
    }).populate("user");

    // Look up in ActiveUsers
    const active = await ActiveUser.findOne({
      $or: [{ email }, { phone }]
    });

    return res.status(200).json({
      existsInUpdatedData: !!updated,
      existsInActiveUsers: !!active,
      updatedData: updated ? updated.updatedData : null,
      activeUser: active || null,
      message: !updated
        ? "User not found in UpdatedData"
        : !active
        ? "Not yet synced to ActiveUsers"
        : "✅ User synced successfully"
    });
  } catch (err) {
    console.error("Error checking sync status:", err);
    return res.status(500).json({ message: "Server error" });
  }
};
// ------------------------------
// 🔄 Force Sync: UpdatedData → ActiveUsers
// ------------------------------
const forceSyncUpdatedData = async (req, res) => {
  try {
    const updatedEntries = await UpdatedData.find().populate("user");
    if (updatedEntries.length === 0) {
      return res.status(200).json({ message: "No UpdatedData entries found to sync." });
    }

    let syncedCount = 0;
    let failedCount = 0;

    for (const entry of updatedEntries) {
      const data = entry.updatedData;
      if (!data || (!data.email && !data.phone)) {
        failedCount++;
        continue;
      }

      try {
        await ActiveUser.findOneAndUpdate(
          {
            $or: [
              { phone: data.phone },
              { email: data.email }
            ]
          },
          {
            $set: {
              fullName: data.name || data.fullName || "Unknown User",
              phone: data.phone || null,
              email: data.email || null,
              githubId: data.githubId || null,
              githubUrl: data.githubUrl || null,
              discordId: data.discordId || null,
              organisation: data.organisation || null,
              orgType: data.orgType || null,
              role: entry.user?.role || "Self",
              isPhoneVerified: true,
              updatedAt: new Date()
            }
          },
          { upsert: true, new: true }
        );
        syncedCount++;
      } catch (err) {
        console.error(`❌ Sync failed for ${data.email || data.phone}:`, err.message);
        failedCount++;
      }
    }

    return res.status(200).json({
      message: "Sync completed",
      total: updatedEntries.length,
      syncedCount,
      failedCount,
    });
  } catch (err) {
    console.error("Error during force sync:", err);
    return res.status(500).json({ message: "Server error" });
  }
};
// ------------------------------
// 🚀 NEW: Create user directly in production DB
// ------------------------------
const createUserInProduction = async (formData, firebaseToken) => {
  try {
    console.log(`\n🚀 Creating user directly in production DB...`);
    
    // Verify Firebase token
    const decoded = await admin.auth().verifyIdToken(firebaseToken);
    const firebasePhone = decoded.phone_number;
    
    if (!firebasePhone) {
      throw new Error('Invalid Firebase token: phone number missing');
    }
    
    // Normalize and verify phones
    const formPhone = normalizePhoneForUser(formData.phone);
    const tokenPhone = normalizePhoneForUser(firebasePhone);
    
    // Verify phone matches
    if (formPhone !== tokenPhone) {
      throw new Error('Phone number does not match Firebase token');
    }
    
    // Get prod User model
    const ProdUser = await getProdUserModel();
    
    // Check for duplicates
    const existingByEmail = formData.email ? await ProdUser.findOne({ 
      primaryEmail: formData.email.toLowerCase().trim() 
    }).lean() : null;
    
    if (existingByEmail) {
      console.log(`⚠️  User already exists with email: ${formData.email}`);
      return { success: false, userId: existingByEmail.userId, reason: 'duplicate_email' };
    }
    
    const existingByPhone = await ProdUser.findOne({ 
      phoneNumber: formPhone 
    }).lean();
    
    if (existingByPhone) {
      console.log(`⚠️  User already exists with phone: ${formPhone}`);
      return { success: false, userId: existingByPhone.userId, reason: 'duplicate_phone' };
    }
    
    if (formData.githubUrl) {
      const existingByGithub = await ProdUser.findOne({ 
        githubUrl: formData.githubUrl.trim() 
      }).lean();
      
      if (existingByGithub) {
        console.log(`⚠️  User already exists with GitHub: ${formData.githubUrl}`);
        return { success: false, userId: existingByGithub.userId, reason: 'duplicate_github' };
      }
    }
    
    // Generate sequential userId
    const lastUser = await ProdUser.findOne({}, { userId: 1 })
      .sort({ userId: -1 })
      .lean();
    
    let nextNumber = 1;
    if (lastUser && lastUser.userId) {
      const currentNumber = parseInt(lastUser.userId.replace('U', ''));
      if (!isNaN(currentNumber)) {
        nextNumber = currentNumber + 1;
      }
    }
    
    const userId = `U${String(nextNumber).padStart(3, '0')}`;
    
    // Role mapping - store roleId in both role and roleId fields (matches signup format)
    const ROLE_MAPPING = {
      "R004": { role: "R004", roleId: "R004", type: "Developer" },
      "R005": { role: "R005", roleId: "R005", type: "Mentor" },
    };
    
    const mappedRole = ROLE_MAPPING[formData.role] || {
      role: "R004",
      roleId: "R004",
      type: "Developer"
    };
    
    // Create user document
    const newUser = await ProdUser.create({
      userId,
      name: formData.fullName || 'Unknown',
      phoneNumber: formPhone,
      
      primaryEmail: formData.email ? formData.email.toLowerCase().trim() : null,
      alternateEmails: formData.email ? [formData.email.toLowerCase().trim()] : [],
      
      profile: formData.fullName ? `https://avatar.iran.liara.run/public?username=${formData.fullName.trim().replace(/\s+/g, '+')}` : null,
      type: mappedRole.type,
      
      organization: formData.organisation || null,
      orgType: formData.orgType || null,
      
      isverified: true, // Phone verified via Firebase
      
      role: mappedRole.role,
      roleId: mappedRole.roleId,
      
      githubUrl: formData.githubUrl || null,
      discordId: formData.discordId || null,
      linkedInUrl: formData.linkedinId || null,
      
      passwordHash: null, // OTP login only
      techStack: [],
      completedTasks: "0",
      prMerged: "0",
      ranking: 0,
      rating: 0,
      
      source: "updateform", // Mark as updateform source
    });
    
    console.log(`✅ User created in production DB: ${userId} - ${newUser.name}`);
    
    return { 
      success: true, 
      userId: newUser.userId, 
      user: newUser 
    };
    
  } catch (err) {
    console.error('❌ createUserInProduction failed:', err);
    throw err;
  }
};

// ------------------------------
// 🧩 Helper: Smart Merge UpdatedData → ActiveUser
// ------------------------------
const syncToActiveUsers = async (updatedEntry) => {
  try {
    console.log(`\n🔍 Starting syncToActiveUsers...`);
    const data = updatedEntry.updatedData;
    if (!data) {
      console.log(`❌ No updatedData found in entry`);
      return;
    }

    // First find existing user (if any)
    console.log(`🔍 Looking for existing ActiveUser with phone: ${data.phone} or email: ${data.email}`);
    const existingUser = await ActiveUser.findOne({
      $or: [
        { phone: data.phone },
        { email: data.email },
      ],
    });
    
    if (existingUser) {
      console.log(`✓ Found existing ActiveUser: ${existingUser._id}`);
    } else {
      console.log(`ℹ️ No existing ActiveUser found - will create new`);
    }

    // Build update with smart merge logic
    const updateFields = {
      updatedAt: new Date(),
      isPhoneVerified: true,
      source: "updateform",
    };

    // Define field merge rules
    const fieldRules = {
      // Required fields: Always update if new data present
      fullName: data.fullName || (existingUser?.fullName || "Unknown User"),
      phone: data.phone || existingUser?.phone,
      role: data.role || updatedEntry.user?.role || existingUser?.role || "Self",

      // Optional fields: Keep existing if present, otherwise use new
      email: existingUser?.email || data.email || null,
      gender: existingUser?.gender || data.gender || null,
      organisation: existingUser?.organisation || data.organisation || null,
      orgType: existingUser?.orgType || data.orgType || null,

      // Social fields: Keep non-null values from both
      githubId: data.githubId || existingUser?.githubId || null,
      githubUrl: data.githubUrl || existingUser?.githubUrl || null,
      discordId: data.discordId || existingUser?.discordId || null,
      linkedinId: data.linkedinId || existingUser?.linkedinId || null,
    };

    // Add non-null fields to update
    Object.entries(fieldRules).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        updateFields[key] = value;
      }
    });

    // Perform upsert with merged data
    const result = await ActiveUser.findOneAndUpdate(
      {
        $or: [
          { phone: data.phone },
          { email: data.email },
        ],
      },
      { $set: updateFields },
      { upsert: true, new: true }
    );

    console.log(`✅ Smart merged changes into ActiveUser:`, {
      id: result._id,
      phone: result.phone,
      email: result.email,
      wasNew: !existingUser,
      fieldsUpdated: Object.keys(updateFields)
    });
  } catch (err) {
    console.error(`❌ Failed to sync entry to ActiveUsers:`, err.message);
  }
};


// ------------------------------
// Mark OAuth in progress (extends token expiry)
// ------------------------------
const markOAuthInProgress = async (req, res) => {
  try {
    const { token, inProgress } = req.body;
    if (!token) return res.status(400).json({ message: 'Token required' });

    const log = await EmailLog.findOne({ linkToken: token });
    if (!log) return res.status(400).json({ message: 'Invalid token' });

    log.isOAuthInProgress = inProgress !== false;
    await log.save();

    console.log(`${inProgress ? '🔒' : '🔓'} OAuth status for token: ${inProgress ? 'IN PROGRESS (30 min expiry)' : 'COMPLETED (10 min expiry)'}`);

    res.status(200).json({ 
      success: true, 
      message: 'OAuth status updated',
      isOAuthInProgress: log.isOAuthInProgress
    });
  } catch (err) {
    console.error('Mark OAuth error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

export {
  activateToken,
  validateToken,
  submitForm,
  deferForm,
  handleFormClose,
  handleOptOut,
  savePartialForm,
  getPartialForm,
  deletePartialForm,
  checkSyncStatus,
  forceSyncUpdatedData,
  syncToActiveUsers,
  verifyPhoneOtp,
  markOAuthInProgress
};
