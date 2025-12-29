

import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { sendRegistrationEmail } from './nodemailer.js';
import Orgs from '../models/orgs.js';
const router = express.Router();
const secretKey = "iedbwb67698$%$#@%^&ghgevhgfi";
import Project from '../models/projects.js';
import { Role, Permission, RolePermission, User, PermissionsExtra } from '../models/usercollection.js';
import bodyParser from 'body-parser';
import pgPool from '../config/postgresconf.js';
import { admin } from '../config/firebaseAdmin.js';
import logger from '../logger.js';
import { Logger } from 'winston';


// Postgres pool
router.use(bodyParser.json());

export function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Authorization header missing' });

  const token = authHeader.split(' ')[1];
  jwt.verify(token, secretKey, (err, decoded) => {
    
    if (err){ 
      
      logger.error("Token Expired",{
        endpoint:req.originalUrl,
        method:req.method,
        sourceIP: req.ip || req.headers['x-forwarded-for'],
        moreInfo:{
           userId: decoded ? decoded.userId : 'N/A',
        phoneNumber: decoded ? decoded.phoneNumber : 'N/A'
        }

      }

      )
      return res.status(401).json({ error: 'Invalid or expired token' });
  }
    req.user = decoded;
    next();
  });
}


// ========== INITIAL SEEDING ==========
async function createCollections() {
  try {
    const rolesCount = await Role.countDocuments();
    const permissionsCount = await Permission.countDocuments();
    const rolePermissionsCount = await RolePermission.countDocuments();
    const permissionsExtraCount = await PermissionsExtra.countDocuments();
    const usersCount = await User.countDocuments();

    if (rolesCount === 0 && permissionsCount === 0 && rolePermissionsCount === 0 && permissionsExtraCount === 0) {
      await Role.insertMany([
        { roleId: 'R001', roleName: 'Admin' },
        { roleId: 'R002', roleName: 'ProgramCoordinator' },
        { roleId: 'R003', roleName: 'OrgManager' },
        { roleId: 'R004', roleName: 'Developer' },
        { roleId: 'R005', roleName: 'Mentor' },
      ]);

      await Permission.insertMany([
        { permissionId: 'P001', permissionName: 'Create', description: 'Allows creation of Project, Module, Task, Team' },
        { permissionId: 'P002', permissionName: 'Read', description: 'Allows read access for Project, Module, Task, Team' },
        { permissionId: 'P003', permissionName: 'Update', description: 'Allows update for Project, Module, Task, Team' },
        { permissionId: 'P004', permissionName: 'Delete', description: 'Allows delete for Project, Module, Task, Team' },
        { permissionId: 'P005', permissionName: 'Admin', description: 'Allows admin-level permissions' },
      ]);

      await RolePermission.insertMany([
        { roleId: 'R001', permissionId: ['P005'] },
        { roleId: 'R002', permissionId: ['P005'] },
        { roleId: 'R003', permissionId: ['P002', 'P001'] },
        { roleId: 'R004', permissionId: ['P002'] },
        { roleId: 'R005', permissionId: ['P002'] },
      ]);

      await PermissionsExtra.insertMany([
        { count: '3', permission: 'modules', description: 'Allows a module to be picked by 3 teams' },
        { count: '1', permission: 'team', description: 'Allows a team to pick 1 module' },
        { count: '1', permission: 'user', description: 'Allows a user to join only 1 team' }
      ]);
    }

    if (usersCount === 0) {
      const basePassword = await bcrypt.hash('rcts', 10);
      const dummyUsers = [
        { username: 'admin', email: 'admin@gmail.com', phoneNumber: '9000000001', roleId: 'R001' },
        { username: 'coordinator', email: 'core@gmail.com', phoneNumber: '9000000002', roleId: 'R002' },
        { username: 'orgmanager', email: 'org@gmail.com', phoneNumber: '9000000003', roleId: 'R003' },
        { username: 'developer', email: 'dev@gmail.com', phoneNumber: '9000000004', roleId: 'R004' },
        { username: 'mentor', email: 'mentor@gmail.com', phoneNumber: '9000000005', roleId: 'R005' },
      ];

      for (const userData of dummyUsers) {
        const userCount = await User.countDocuments();
        const userID = `U${String(userCount + 1).padStart(3, '0')}`;
        await User.create({
          userId: userID,
          username: userData.username,
          email: userData.email,
          phoneNumber: userData.phoneNumber,
          password: basePassword,
          roleId: userData.roleId
        });
      }
    }

    console.log('Collections and dummy users created successfully.');
  } catch (error) {
    console.error('Error creating collections and initial data:', error);
    throw error;
  }
}

async function syncContributors() {
  try {
    const res = await pgPool.query(`
      SELECT id, name, email, github_id, github_url, discord_id, discord_username, joined_at
      FROM contributors_registration
    `);

    const ops = [];

    for (const row of res.rows) {
      console.log(`Processing ID: ${row.id}, Raw email: "${row.email}"`);

      const emails = row.email
        ? row.email
          .split(',')
          .map(e => e.trim())
          .filter(e => e && e.includes('@'))
        : [];

      console.log(`→ Emails parsed:`, emails);

      const userId = row.id != null ? `U${String(row.id)}` : null;

      const doc = {
        userId,
        name: row.name ?? null,
        phoneNumber: null,
        primaryEmail: emails[0] || null,     // ← CORRECT FIELD
        alternateEmails: emails,
        organization: null,
        orgType: null,
        isverified: false,
        role: 'R004',
        githubUrl: row.github_url ? String(row.github_url) : null,
        discordId: row.discord_id ? String(row.discord_id) : null,
        passwordHash: null,
        techStack: [],
        completedTasks: '0',
        assignedTasks: [],
        prMerged: '0',
        ranking: 0,
        rating: 0,
        type: null,
      };

      // PRIORITY FILTER: githubUrl > discordId > primaryEmail > userId
      let filter;
      if (row.github_url) {
        filter = { githubUrl: String(row.github_url) };
      } else if (row.discord_id) {
        filter = { discordId: String(row.discord_id) };
      } else if (emails[0]) {
        filter = { primaryEmail: emails[0] }; // ← FIXED: Use primaryEmail
      } else {
        filter = { userId };
      }

      ops.push({
        updateOne: {
          filter,
          update: { $set: doc },
          upsert: true
        }
      });
    }

    // BULK WRITE — FAST & SAFE
    if (ops.length > 0) {
      const result = await User.bulkWrite(ops, { ordered: false });
      console.log(`Synced ${result.upsertedCount} users, ${result.modifiedCount} updated`);
    }

    return { success: true, message: 'All contributors synced with primaryEmail!' };

  } catch (error) {
    console.error('Sync failed:', error);
    return { success: false, error: error.message };
  }
}



const CLOSED_STATUSES = ['closed'];

// GET ALL CONTRIBUTORS
export const getAllContributors = async (req, res) => {
  try {
    // Pagination
    let page = parseInt(req.query.page) || 1;
    let limit = parseInt(req.query.limit) || 20;

    if (page < 1) page = 1;
    if (limit < 1) limit = 10;

    const skip = (page - 1) * limit;

    const totalUsers = await User.countDocuments();

    const users = await User.find({})
      .skip(skip)
      .limit(limit)
      .lean();

    if (!users.length) {
      return res.json({
        success: true,
        totalContributors: 0,
        contributors: [],
        techSkills: {},
        currentPage: page,
        totalPages: 0,
        limit
      });
    }

    // CLEAN TECH FUNCTION
    const cleanTech = (value) => {
      if (!value) return [];
      if (Array.isArray(value)) value = value.join(",");
      if (typeof value !== "string") return [];

      return value
        .replace(/[\[\]"']/g, "")
        .replace(/\\n|\n/g, ",")
        .replace(/\\/g, "")
        .split(/[,;]+/)
        .map(t => t.trim().toLowerCase())
        .filter(t =>
          t &&
          t.length > 1 &&
          !["other", "feature", "required technical skills for the project"].includes(t)
        );
    };

    // GLOBAL USERS (for skills grouping)
    const allUsers = await User.find({}).select("techStack source").lean();

    // -------------------------------
    // GROUP TECH SKILLS BY SOURCE
    // -------------------------------
    const techSkills = {
      DMP: { skills: new Set() },
      Community: { skills: new Set() }
    };

    allUsers.forEach(u => {
      const userSource = (u.source || "Community").trim(); // default Community

      const cleanedSkills = cleanTech(u.techStack);

      cleanedSkills.forEach(skill => {
        if (userSource === "DMP") techSkills.DMP.skills.add(skill);
        else techSkills.Community.skills.add(skill);
      });
    });

    // Convert Sets → Arrays
    techSkills.DMP.skills = [...techSkills.DMP.skills];
    techSkills.Community.skills = [...techSkills.Community.skills];

    // -------------------------------
    // ENRICH THE CURRENT PAGE USERS
    // -------------------------------
    const enriched = await Promise.all(
      users.map(async (u) => {
        const total = await Project.countDocuments({ assignedTo: u.userId });

        const completed = await Project.countDocuments({
          assignedTo: u.userId,
          status: { $in: ["closed", "completed"] }
        });

        return {
          ...u,
          stats: {
            totalAssigned: total,
            completedTasks: completed,
            completionRate: total ? Math.round((completed / total) * 100) : 0
          }
        };
      })
    );

    // -------------------------------
    // FINAL RESPONSE
    // -------------------------------
    res.json({
      success: true,
      totalContributors: totalUsers,
      techSkills, // <<  NEW STRUCTURE
      contributors: enriched,
      currentPage: page,
      totalPages: Math.ceil(totalUsers / limit),
      limit
    });

  } catch (err) {
    console.error("getAllContributors error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};



//search
export const searchContributors = async (req, res) => {
  try {
    const q = req.query.q?.trim();
    let page = parseInt(req.query.page) || 1;
    let limit = parseInt(req.query.limit) || 20;

    if (!q || q.length < 2) {
      return res.status(400).json({
        success: false,
        error: "Search query must be at least 2 characters"
      });
    }

    if (page < 1) page = 1;
    if (limit < 1) limit = 10;

    const skip = (page - 1) * limit;

    // Create regex (case insensitive)
    const regex = new RegExp(q, "i");

    // Search conditions
    const searchFilter = {
      $or: [
        { name: regex },
        { userId: regex },
        { primaryEmail: regex },
        { alternateEmails: regex },
        { githubUrl: regex },
        { githubId: regex },
        { discordId: regex },
        { phoneNumber: regex },
        { techStack: regex }
      ]
    };

    const totalMatches = await User.countDocuments(searchFilter);

    const users = await User.find(searchFilter)
      .skip(skip)
      .limit(limit)
      .lean();

    if (!users.length) {
      return res.json({
        success: true,
        message: "No matching contributors found",
        totalResults: 0,
        contributors: []
      });
    }

    // Enrich users with stats
    const CLOSED_STATUSES = ["closed", "completed", "done"];

    const enriched = await Promise.all(
      users.map(async (user) => {
        const total = await Project.countDocuments({ assignedTo: user.userId });
        const completed = await Project.countDocuments({
          assignedTo: user.userId,
          status: { $in: CLOSED_STATUSES }
        });

        return {
          ...user,
          stats: {
            totalAssigned: total,
            completedTasks: completed,
            completionRate: total
              ? Math.round((completed / total) * 100)
              : 0
          }
        };
      })
    );

    return res.json({
      success: true,
      totalResults: totalMatches,
      currentPage: page,
      totalPages: Math.ceil(totalMatches / limit),
      limit,
      contributors: enriched
    });

  } catch (err) {
    console.error("searchContributors error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
};




// GET ONE CONTRIBUTOR
export const getContributorById = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId || !userId.startsWith("U")) {
      return res.status(400).json({
        success: false,
        error: "Invalid userId. Use U123"
      });
    }

    const user = await User.findOne({ userId }).lean();
    if (!user) {
      return res.status(404).json({
        success: false,
        message: `User ${userId} not found`
      });
    }

    // -------- FETCH ALL PROJECTS ASSIGNED TO THIS USER --------
    const assignedProjects = await Project.find({
      $or: [
        { assignedTo: userId },
        { project_id: { $in: user.assignedTasks || [] } }
      ]
    }).lean();

    // -------- COUNT STATUSES --------
    const completedTasks = assignedProjects.filter(
      p => p.status === "completed"
    ).length;

    const prMerged = assignedProjects.filter(
      p => p.status === "prMerged"
    ).length;

    const ongoing = assignedProjects.filter(
      p => p.status === "ongoing"
    ).length;

    const totalAssigned = assignedProjects.length;

    // -------- FETCH ORG DETAILS --------
    const org = user.organization
      ? await Orgs.findOne({ org_id: user.organization }).lean()
      : null;

    return res.json({
      success: true,

      user,

      organization: org
        ? {
          orgId: org.org_id,
          name: org.orgName,
          contact: org.contact,
          techStack: org.techStack,
          rating: org.rating,
          type: org.orgtype,
        }
        : null,

      // -------- INDIVIDUAL FIELDS (NO stats object) --------
      totalAssigned,
      completedTasks,
      prMerged,
      ongoing,

      projects: assignedProjects
    });

  } catch (err) {
    console.error("getContributorById error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
};




// ========== SIGNUP WITH FIREBASE OTP ==========
export const signup = async (req, res) => {
  try {
    
    const {
      name,
      phoneNumber,
      email,
      organization,
      orgType,
      role,                // incoming roleId
      firebaseToken,
      githubUrl,
      discordId,
      linkedInUrl,         // updated field
      techStack,
      profile,
      type
    } = req.body;

    // --- Required validation ---
    if (!name || !phoneNumber || !role || !firebaseToken) {
      return res.status(400).json({
        success: false,
        message: "Name, phone number, role, and Firebase token are required",
      });
    }

    // --- Normalize Phone ---
    const normalizePhone = (num) => {
      if (!num) return null;
      let digits = String(num).replace(/\D/g, "");

      if (digits.startsWith("91") && digits.length === 12) return `+${digits}`;
      if (digits.length === 10) return `+91${digits}`;
      if (String(num).startsWith("+91") && digits.length === 12) return `+${digits}`;

      return null;
    };

    const normalizedPhone = normalizePhone(phoneNumber);

    // --- Firebase Token Verification ---
    const decoded = await admin.auth().verifyIdToken(firebaseToken);
    console.log(decoded);
    const firebasePhone = decoded.phone_number
    const normalizedFirebasePhone = normalizePhone(firebasePhone);

    if (!firebasePhone) {
      logger.error('Signup failed: Invalid Firebase token. Phone missing.', {
        endpoint: req.originalUrl,
        phoneNumber: phoneNumber
      });
      return res.status(400).json({ success: false, message: "Invalid Firebase token. Phone missing." });
    }
    if (normalizedPhone !== normalizedFirebasePhone) {
      logger.warn('Signup failed: Phone numbers do not match with Firebase token', {
        phoneNumber,
        endpoint: req.originalUrl,
        sourceIP: req.ip || req.headers['x-forwarded-for'], // Optional: Add source IP if needed
        moreInfo: {
          errorType: "Phone Number Mismatch",
          providedPhoneNumber: phoneNumber,
          firebasePhoneNumber: firebasePhone,

        }
      });


      return res.status(400).json({
        success: false,
        message: "Phone numbers do not match with Firebase token",
      });
    }

    // --- Check Duplicate Phone ---
    const existingPhone = await User.findOne({
      phoneNumber: normalizedPhone.replace("+91", ""),
    });

    if (existingPhone)
      return res.status(400).json({ success: false, message: "Phone number already registered." });

    // --- Check Duplicate Email ---
    if (email) {
      const existingEmail = await User.findOne({ primaryEmail: email });
      if (existingEmail)
        return res.status(400).json({ success: false, message: "Email already registered." });
    }

    // --- Validate LinkedIn URL (store only profile URL) ---
    let storedLinkedInUrl = null;
    if (linkedInUrl) {
      const linkedinRegex = /^https:\/\/(www\.)?linkedin\.com\/in\/[A-Za-z0-9_-]+\/?$/;
      if (!linkedinRegex.test(String(linkedInUrl).trim())) {
        return res.status(400).json({ success: false, message: "Provide a valid LinkedIn profile URL (e.g. https://linkedin.com/in/username)." });
      }
      storedLinkedInUrl = String(linkedInUrl).trim();
    }

    // ============================================================
    // ✅ SAFEST UNIQUE USER ID GENERATOR (Prevents duplicates)
    // ============================================================
    const lastUser = await User.findOne({}, { userId: 1 })
      .sort({ userId: -1 })   // sort descending to get highest ID
      .lean();
    console.table(lastUser);
    let nextNumber = 1;

    if (lastUser && lastUser.userId) {
      nextNumber = parseInt(lastUser.userId.replace("U", "")) + 1;
    }
    console.log(`The next number is ${nextNumber}`);

    // Change padding as per your requirement: 3 → U001, 8 → U00000001
    const userId = `U${String(nextNumber).padStart(3, "0")}`;
    // ============================================================
    console.log(`The userId is ${userId}`);
    // --- Create User Document ---
    const newUser = await User.create({
      userId,
      name,
      profile: profile || null,
      type: type || null,

      primaryEmail: email || null,
      alternateEmails: email ? [email] : [],

      phoneNumber: normalizedPhone.replace("+91", ""), // store 10 digits only

      organization: organization || null,
      orgType: orgType || null,
      isverified: true,
      role,                 // actual role name
      roleId: role,         // roleId stored same (R001, R002 etc.)
      githubUrl: githubUrl || null,
      discordId: discordId || null,
      linkedInUrl: storedLinkedInUrl || null,
      techStack: techStack || [],
      completedTasks: "0",
      prMerged: "0",
      ranking: 0,
      rating: 0,
      source: "signup",
    });


    // --- Create JWT Token ---
    const jwtToken = jwt.sign(
      {
        id: newUser._id,
        userId: newUser.userId,
        phoneNumber: newUser.phoneNumber,
        role: newUser.roleId,
      },
      secretKey,
      { expiresIn: "24h" }
    );

    // --- Fetch Permissions ---
    const rolePermissions = await RolePermission.findOne({ roleId: newUser.roleId });
    logger.info('Signup successful', {
      phoneNumber: newUser.phoneNumber,
      endpoint: req.originalUrl,
      method:req.method,
      moreInfo: {
        userId: newUser.userId,
        email: newUser.primaryEmail,
        role: newUser.roleId,
      }
    });
    return res.status(200).json({
      success: true,
      message: "Signup successful",
      token: jwtToken,
      user: {
        id: newUser._id,
        userId: newUser.userId,
        name: newUser.name,
        phone: newUser.phoneNumber,
        email: newUser.primaryEmail,
        roleId: newUser.roleId,
        permissions: rolePermissions?.permissionId || [],
        orgId: newUser.organization || null,
      }
    });

  } catch (err) {
    logger.error('Error during signup', {
       method:req.method,
      error: err.message,
      stack: err.stack,
      endpoint: req.originalUrl,
     
      sourceIP: req.ip || req.headers['x-forwarded-for'] || 'unknown',
    });
    console.error("❌ signup error:", err);
    return res.status(500).json({ success: false, message: "Server error during signup" });
  }
};





// ========== LOGIN BY PHONE ==========
export const loginWithOtp = async (req, res) => {
  try {

    const { firebaseToken } = req.body;
    const phoneRaw = req.body.phoneNumber || req.body.phone;
    logger.warn("Login request is recieved ", { sourceIP: req.ip, endpoint: req.originalUrl, phoneNumber: phoneRaw })

    if (!phoneRaw || !firebaseToken) {
      logger.warn("Phone Number and Firebase token are required", { sourceIP: req.ip, endpoint: req.originalUrl, phoneNumber: phoneRaw })
      return res.status(400).json({
        success: false,
        message: "Phone number and Firebase token are required",
      });
    }

    // --- Normalize Phone Function (Final Correct Version) ---
    const normalizePhone = (num) => {
      if (!num) return null;
      let digits = String(num).replace(/\D/g, "");

      // If starts with 91XXXXXXXXXX (12 digits)
      if (digits.startsWith("91") && digits.length === 12) {
        return `+${digits}`;
      }
      // If 10 digits
      if (digits.length === 10) {
        return `+91${digits}`;
      }
      // If already +91XXXXXXXXXX
      if (String(num).startsWith("+91") && digits.length === 12) {
        return `+${digits}`;
      }

      return null;
    };

    const normalizedPhone = normalizePhone(phoneRaw);

    // --- Decode Firebase Token ---
    const decoded = await admin.auth().verifyIdToken(firebaseToken);

    const firebasePhone = decoded.phone_number;
    const normalizedFirebasePhone = normalizePhone(firebasePhone);

    if (!firebasePhone) {
      return res.status(400).json({
        success: false,
        message: "Invalid Firebase token. Phone missing.",
      });
    }

    if (normalizedPhone !== normalizedFirebasePhone) {
      return res.status(400).json({
        success: false,
        message: "Phone numbers do not match with Firebase token",
      });
    }

    // --- DB User Lookup (supports both +91 and raw number formats) ---
    let user = await User.findOne({
      $or: [
        { phoneNumber: normalizedPhone },                   // +919110791397
        { phoneNumber: phoneRaw },                          // +919110791397
        { phoneNumber: normalizedPhone.replace("+91", "") }, // 9110791397
        { phoneNumber: phoneRaw.replace("+91", "") },        // 9110791397
      ]
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found. Please signup first.",
      });
    }

    // Update last login
    user.isPhoneVerified = true;
    user.lastLogin = new Date();
    await user.save();

    // Fetch Role Permissions
    const rolePermissions = await RolePermission.findOne({ roleId: user.roleId });
    const role = await Role.findOne({ roleId: user.roleId });

    if (!rolePermissions) {
      return res.status(404).json({ success: false, message: "Permissions not found for role" });
    }

    // --- Generate JWT Token ---
    const token = jwt.sign(
      {
        id: user._id,
        userId: user.userId,
        phoneNumber: user.phoneNumber,
        role: user.roleId,
      },
      secretKey,
      { expiresIn: "24h" }
    );
    logger.info(`User Logged In`, {
      Endpoint: req.originalUrl,
      method: req.method,
      phoneNumber: user.phoneNumber,
      sourceIP: req.ip,
      moreInfo: {
        userId: user.userId,
        role: role?.roleId || user.roleId,
      }
    });

    // --- Final Response With ALL Required Data ---
    return res.json({
      success: true,
      message: "OTP verified. Login successful.",
      token,
      userId: user.userId,
      roleId: role?.roleId || user.roleId,
      permissions: rolePermissions.permissionId,
      orgId: user.organization || null,
      profilePhoto: user.profile || null,
      phone: user.phoneNumber,
      name: user.name || null,
    });

  } catch (err) {

    logger.error("Error while Logging ", {
      error: err.message,
      stack: err.stack,
      method:req.method,
      endpoint:req.originalUrl

    })
    console.error("loginWithOtp error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error while verifying OTP",
    });
  }
};



export const requestOtp = async (req, res) => {
  try {
    const { phone, email } = req.body;
    logger.info('OTP request received', {
      endpoint: req.originalUrl,
      sourceIP: req.ip || req.headers['x-forwarded-for'] || 'unknown',
      phoneNumber: req.body.phone,
      email: req.body.email,
      method:req.method,

    });
    if (!phone) return res.status(400).json({ message: "Phone number required" });

    const normalizePhone = (num) => {
      if (!num) return null;
      const digits = String(num).replace(/\D/g, "");
      return `+91${digits.replace(/^91/, "")}`;
    };

    const normalizedPhone = normalizePhone(phone);

    // Check DB for phone number
    const userByPhone = await User.findOne({
      $or: [
        { phoneNumber: normalizedPhone }, // +91 format
        { phoneNumber: phone }            // raw DB format "9000000001"
      ]
    });

    // Check DB for email (only if email is provided)
    let userByEmail = null;
    if (email) {
      const emailLower = email.toLowerCase().trim();
      userByEmail = await User.findOne({
        $or: [
          { primaryEmail: emailLower },
          { alternateEmails: emailLower }
        ]
      });
    }

    // Determine response based on what exists
    if (userByPhone && userByEmail) {
      logger.info('User exists with both phone and email', {
        phoneNumber: phone,
        email: email,
        endpoint: req.originalUrl,
        sourceIP: req.ip
      });

      return res.status(200).json({
        message: "Phone and email already registered. Please sign in.",
        mode: "signin",
        exists: true,
        reason: "both",
        sourceIp: req.ip
      });
    }

    if (userByPhone) {
      logger.info('User exists with phone number', {
        phoneNumber: phone,
        endpoint: req.originalUrl,
        sourceIP: req.ip
      });

      return res.status(200).json({
        message: "Phone number already registered. Please sign in.",
        mode: "signin",
        exists: true,
        reason: "phone",
        sourceIp: req.ip
      });
    }

    if (userByEmail) {
      logger.info('User exists with email', {
        email: email,
        endpoint: req.originalUrl,
        sourceIP: req.ip
      });

      return res.status(200).json({
        message: "Email already registered. Please sign in or use a different email.",
        mode: "signin",
        exists: true,
        reason: "email",
        sourceIp: req.ip
      });
    }

    logger.info('User not found. Proceeding with signup and Firebase OTP verification.', {
      phoneNumber: phone,
      email: email,
      endpoint: req.originalUrl
    });

    return res.status(200).json({
      message: "User not found. Proceed with signup and Firebase OTP verification.",
      mode: "signup",
      exists: false
    });

  } catch (err) {
    logger.error('Error processing OTP request', {
      error: err.message,
      stack: err.stack,
      phoneNumber: req.body.phone,
      endpoint: req.originalUrl,
      method:req.method

    });
    console.error("requestOtp:", err);
    return res.status(500).json({ message: "Server error" });
  }
};



// ========== PERMISSIONS ==========
async function getPermissions(req, res) {
  try {
    const { id, userType } = req.user;
    if (userType !== 'user') return res.status(401).json({ error: 'Invalid user type' });

    const user = await User.findById(id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const rolePermissions = await RolePermission.findOne({ roleId: user.roleId });
    const role = await Role.findOne({ roleId: user.roleId });

    if (!rolePermissions) return res.status(404).json({ error: 'Permissions not found for role' });

    res.json({
      userId: user.userId,
      roleId: role?.roleId || user.roleId,
      permissions: rolePermissions.permissionId,
      orgId: user.organization || null,
      profilePhoto: user.profile || null,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).send('Internal Server Error');
  }
}


// ========== EXTRA PERMISSIONS ==========
async function getExtraPermissions(req, res) {
  try {
    const allPermissions = await PermissionsExtra.find();
    return res.json({ permissions: allPermissions });
  } catch (error) {
    console.error(error);
    return res.status(500).send('Internal Server Error');
  }
}
export const editProfile = async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: "userId is required"
      });
    }

    const updates = req.body;

    // CLEAN INPUTS
    if (updates.alternateEmails) {
      updates.alternateEmails = Array.isArray(updates.alternateEmails)
        ? updates.alternateEmails.filter(e => e && e.includes("@"))
        : [];
    }

    if (updates.techStack) {
      updates.techStack = Array.isArray(updates.techStack)
        ? updates.techStack.map(t => t.trim().toLowerCase())
        : [];
    }

    if (updates.primaryEmail && !updates.primaryEmail.includes("@")) {
      return res.status(400).json({
        success: false,
        error: "Invalid primaryEmail"
      });
    }

    // UPDATE USER
    const updatedUser = await User.findOneAndUpdate(
      { userId },
      { $set: updates },
      { new: true }
    ).lean();

    if (!updatedUser) {
      return res.status(404).json({
        success: false,
        error: `User ${userId} not found`
      });
    }
    logger.info('Profile Updated successfully', {
      endpoint: req.originalUrl,
      method:req.method,
      moreInfo: {
        userId: req.userId,
        updatedInfo: updates
      }
    });
    return res.json({
      success: true,
      message: "Profile updated successfully",
      user: updatedUser
    });

  } catch (err) {
    logger.error("Error while editing profile", {
      method:req.method,
      error: err.message,
      stack: err.stack,
      moreInfo: {
        userId: req.userId,
      }
    })
    console.error("editProfile error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
};
// ========== GET ONLY DEVELOPERS (R004) WITH PAGINATION ==========
// export const getDevelopers = async (req, res) => {
//   try {
//     // Pagination Setup
//     let page = parseInt(req.query.page) || 1;
//     let limit = parseInt(req.query.limit) || 20;

//     if (page < 1) page = 1;
//     if (limit < 1) limit = 10;

//     const skip = (page - 1) * limit;

//     // Count total developers
//     const totalDevCount = await User.countDocuments({ roleId: "R004" });

//     // Fetch developer users only
//     const devUsers = await User.find({ roleId: "R004" })
//       .skip(skip)
//       .limit(limit)
//       .lean();

//     if (!devUsers.length) {
//       return res.json({
//         success: true,
//         totalDevelopers: 0,
//         developers: [],
//         currentPage: page,
//         totalPages: 0,
//         limit
//       });
//     }

//     // TECH CLEANER FUNCTION (same logic as contributors)
//     const cleanTech = (value) => {
//       if (!value) return [];
//       if (Array.isArray(value)) value = value.join(",");
//       if (typeof value !== "string") return [];

//       return value
//         .replace(/[\[\]"']/g, "")
//         .replace(/\\n|\n/g, ",")
//         .replace(/\\/g, "")
//         .split(/[,;]+/)
//         .map((t) => t.trim().toLowerCase())
//         .filter(
//           (t) =>
//             t &&
//             t.length > 1 &&
//             !["other", "feature", "required technical skills for the project"].includes(t)
//         );
//     };

//     // Fetch all developers for global skills grouping
//     const allDevelopers = await User.find({ roleId: "R004" })
//       .select("techStack source")
//       .lean();

//     // GROUP DEV SKILLS BY SOURCE
//     const techSkills = {
//       DMP: { skills: new Set() },
//       Community: { skills: new Set() },
//     };

//     allDevelopers.forEach((dev) => {
//       const source = (dev.source || "Community").trim(); // default community
//       const cleaned = cleanTech(dev.techStack);

//       cleaned.forEach((s) => {
//         if (source === "DMP") techSkills.DMP.skills.add(s);
//         else techSkills.Community.skills.add(s);
//       });
//     });

//     techSkills.DMP.skills = [...techSkills.DMP.skills];
//     techSkills.Community.skills = [...techSkills.Community.skills];

//     // ENRICH DEVELOPERS WITH PROJECT STATS
//     const enriched = await Promise.all(
//       devUsers.map(async (dev) => {
//         const totalAssigned = await Project.countDocuments({
//           assignedTo: dev.userId,
//         });

//         const completedTasks = await Project.countDocuments({
//           assignedTo: dev.userId,
//           status: { $in: ["closed", "completed"] },
//         });

//         return {
//           ...dev,
//           stats: {
//             totalAssigned,
//             completedTasks,
//             completionRate: totalAssigned
//               ? Math.round((completedTasks / totalAssigned) * 100)
//               : 0,
//           },
//         };
//       })
//     );

//     return res.json({
//       success: true,
//       totalDevelopers: totalDevCount,
//       developers: enriched,
//       techSkills,
//       currentPage: page,
//       totalPages: Math.ceil(totalDevCount / limit),
//       limit,
//     });
//   } catch (err) {
//     console.error("getDevelopers error:", err);
//     return res.status(500).json({ success: false, error: err.message });
//   }
// };

// ========== GET ONLY DEVELOPERS (R004) WITH PAGINATION ==========
export const getDevelopers = async (req, res) => {
  try {
    // Pagination Setup
    let page = parseInt(req.query.page) || 1;
    let limit = parseInt(req.query.limit) || 20;

    if (page < 1) page = 1;
    if (limit < 1) limit = 10;

    const skip = (page - 1) * limit;

    // FIX: Support both `roleId` and `role`
    const roleFilter = {
      $or: [
        { roleId: "R004" },
        { role: "R004" }
      ]
    };

    // Count total developers
    const totalDevCount = await User.countDocuments(roleFilter);

    // Fetch developer users only
    const devUsers = await User.find(roleFilter)
      .skip(skip)
      .limit(limit)
      .lean();

    if (!devUsers.length) {
      return res.json({
        success: true,
        totalDevelopers: 0,
        developers: [],
        currentPage: page,
        totalPages: 0,
        limit
      });
    }

    // TECH CLEANER FUNCTION (same logic as contributors)
    const cleanTech = (value) => {
      if (!value) return [];
      if (Array.isArray(value)) value = value.join(",");
      if (typeof value !== "string") return [];

      return value
        .replace(/[\[\]"']/g, "")
        .replace(/\\n|\n/g, ",")
        .replace(/\\/g, "")
        .split(/[,;]+/)
        .map((t) => t.trim().toLowerCase())
        .filter(
          (t) =>
            t &&
            t.length > 1 &&
            !["other", "feature", "required technical skills for the project"].includes(t)
        );
    };

    // Fetch all developers for global skills grouping
    const allDevelopers = await User.find(roleFilter)
      .select("techStack source")
      .lean();

    // GROUP DEV SKILLS BY SOURCE
    const techSkills = {
      DMP: { skills: new Set() },
      Community: { skills: new Set() },
    };

    allDevelopers.forEach((dev) => {
      const source = (dev.source || "Community").trim(); // default community
      const cleaned = cleanTech(dev.techStack);

      cleaned.forEach((s) => {
        if (source === "DMP") techSkills.DMP.skills.add(s);
        else techSkills.Community.skills.add(s);
      });
    });

    techSkills.DMP.skills = [...techSkills.DMP.skills];
    techSkills.Community.skills = [...techSkills.Community.skills];

    // ENRICH DEVELOPERS WITH PROJECT STATS
    const enriched = await Promise.all(
      devUsers.map(async (dev) => {
        const totalAssigned = await Project.countDocuments({
          assignedTo: dev.userId,
        });

        const completedTasks = await Project.countDocuments({
          assignedTo: dev.userId,
          status: { $in: ["closed", "completed"] },
        });

        return {
          ...dev,
          stats: {
            totalAssigned,
            completedTasks,
            completionRate: totalAssigned
              ? Math.round((completedTasks / totalAssigned) * 100)
              : 0,
          },
        };
      })
    );

    return res.json({
      success: true,
      totalDevelopers: totalDevCount,
      developers: enriched,
      techSkills,
      currentPage: page,
      totalPages: Math.ceil(totalDevCount / limit),
      limit,
    });
  } catch (err) {
    console.error("getDevelopers error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
};

// ========== SEARCH DEVELOPERS WITHOUT PAGINATION ==========
export const searchDevelopers = async (req, res) => {
  try {
    const q = req.query.q?.trim();

    if (!q || q.length < 2) {
      return res.status(400).json({
        success: false,
        error: "Search query must be at least 2 characters",
      });
    }

    // Regex for search
    const regex = new RegExp(q, "i");

    // -------- FILTER ONLY DEVELOPERS (roleId = R004) --------
    const searchFilter = {
      roleId: "R004",
      $or: [
        { name: regex },
        { userId: regex },
        { primaryEmail: regex },
        { alternateEmails: regex },
        { githubId: regex },
        { githubUrl: regex },
        { discordId: regex },
        { phoneNumber: regex },
        { techStack: regex },
      ],
    };

    const devs = await User.find(searchFilter).lean();

    if (!devs.length) {
      return res.json({
        success: true,
        totalResults: 0,
        developers: [],
        message: "No matching developers found",
      });
    }

    // Clean tech stack function
    const cleanTech = (value) => {
      if (!value) return [];
      if (Array.isArray(value)) value = value.join(",");
      if (typeof value !== "string") return [];

      return value
        .replace(/[\[\]"']/g, "")
        .replace(/\\n|\n/g, ",")
        .replace(/\\/g, "")
        .split(/[,;]+/)
        .map((t) => t.trim().toLowerCase())
        .filter(
          (t) =>
            t &&
            t.length > 1 &&
            ![
              "other",
              "feature",
              "required technical skills for the project",
            ].includes(t)
        );
    };

    // Enrich developers with task stats
    const enriched = await Promise.all(
      devs.map(async (dev) => {
        const total = await Project.countDocuments({
          assignedTo: dev.userId,
        });

        const completed = await Project.countDocuments({
          assignedTo: dev.userId,
          status: { $in: ["closed", "completed"] },
        });

        return {
          ...dev,
          techStack: cleanTech(dev.techStack),
          stats: {
            totalAssigned: total,
            completedTasks: completed,
            completionRate: total
              ? Math.round((completed / total) * 100)
              : 0,
          },
        };
      })
    );

    return res.json({
      success: true,
      totalResults: enriched.length,
      developers: enriched,
    });
  } catch (err) {
    console.error("searchDevelopers error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
};



// ========== EXPORT ==========
createCollections();


export default {
  syncContributors,
  createCollections,
  signup,
  loginWithOtp,
  getPermissions,
  getExtraPermissions,
  getAllContributors,
  searchContributors,
  editProfile,
  requestOtp,
  getDevelopers,
  searchDevelopers,  // << ADD THIS
  getContributorById,
};
