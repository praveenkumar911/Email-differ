import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

// ========================================
// DATABASE CONNECTIONS
// ========================================

// Dev DB (mail_test) - Source
const devDbUri = process.env.DEV_MONGO_URI || 'mongodb://10.8.0.13:27017/mail_test';
const devConnection = mongoose.createConnection(devDbUri);

// Prod DB (badal_C4GT_latest) - Target
const prodDbUri = process.env.PROD_MONGO_URI || 'mongodb://10.8.0.13:27017/badal_C4GT_latest';
const prodConnection = mongoose.createConnection(prodDbUri);

// ========================================
// SCHEMAS & MODELS
// ========================================

// ActiveUser Schema (Dev DB)
const ActiveUserSchema = new mongoose.Schema({
  fullName: String,
  phone: String,
  email: String,
  gender: String,
  organisation: String,
  orgType: String,
  role: String,
  discordId: String,
  githubId: String,
  githubUrl: String,
  linkedinId: String,
  acceptedTerms: Boolean,
  isPhoneVerified: Boolean,
  source: String,
  createdAt: Date,
  updatedAt: Date,
}, { timestamps: true });

// User Schema (Prod DB)
const UserSchema = new mongoose.Schema({
  userId: String,
  name: String,
  phoneNumber: String,
  profile: String,
  type: String,
  primaryEmail: String,
  alternateEmails: [String],
  organization: String,
  orgType: String,
  isverified: Boolean,
  role: String,
  roleId: String,
  githubUrl: String,
  discordId: String,
  linkedInUrl: String,
  passwordHash: String,
  techStack: [String],
  completedTasks: String,
  prMerged: String,
  ranking: Number,
  rating: Number,
  source: String,
});

const ActiveUser = devConnection.model('ActiveUser', ActiveUserSchema);
const User = prodConnection.model('User', UserSchema);

// ========================================
// ROLE MAPPING
// ========================================

const ROLE_MAPPING = {
  "Student": { role: "Student", roleId: "R004", type: "Developer" },
  "Mentor": { role: "Mentor", roleId: "R005", type: "Mentor" },
  "Manager": { role: "Manager", roleId: "R003", type: "Organization Manager" },
  "Program Coordinator": { role: "ProgramCoordinator", roleId: "R002", type: "Program Coordinator" },
};

// ========================================
// ORGTYPE MAPPING (Optional)
// ========================================

const ORGTYPE_MAPPING = {
  "Government": "Government Organizations (Gov)",
  "Academic": "Academic & Research",
  "Corporate": "Corporate / Private Sector",
  "NGO": "Social Innovation",
  "Social Enterprise": "Social Innovation",
  "Intergovernmental / Multilateral": "Government Organizations (Gov)",
  "Community-Based": "Social Innovation",
  "Philanthropic Foundation / Trust": "Social Innovation",
  "Cooperative Society": "Social Innovation",
  "PSU": "Government Organizations (Gov)",
  "Think Tank / Policy Research": "Academic & Research",
  "Faith-Based Organization": "Social Innovation",
  "Professional Association": "Corporate / Private Sector",
  "Startup / Innovation Hub": "Corporate / Private Sector",
  "Media / Advocacy": "Social Innovation",
  "Self": "Self",
};

// ========================================
// HELPER FUNCTIONS
// ========================================

function normalizePhone(phone) {
  if (!phone) return null;
  const digits = String(phone).replace(/\D/g, '');
  
  // Remove +91 prefix if exists
  if (digits.startsWith('91') && digits.length === 12) {
    return digits.substring(2); // Return 10 digits
  }
  
  if (digits.length === 10) {
    return digits;
  }
  
  return null;
}

function generateAvatarUrl(name) {
  if (!name) return `https://avatar.iran.liara.run/public`;
  const cleanName = name.trim().replace(/\s+/g, '+');
  return `https://avatar.iran.liara.run/public?username=${cleanName}`;
}

async function getNextUserId(connection) {
  const lastUser = await connection.model('User', UserSchema)
    .findOne({}, { userId: 1 })
    .sort({ userId: -1 })
    .lean();
  
  let nextNumber = 1;
  if (lastUser && lastUser.userId) {
    const currentNumber = parseInt(lastUser.userId.replace('U', ''));
    if (!isNaN(currentNumber)) {
      nextNumber = currentNumber + 1;
    }
  }
  
  return `U${String(nextNumber).padStart(3, '0')}`;
}

async function checkDuplicate(activeUser) {
  // Check email (most reliable identifier)
  if (activeUser.email) {
    const emailMatch = await User.findOne({ 
      primaryEmail: activeUser.email.toLowerCase().trim() 
    }).lean();
    if (emailMatch) {
      return { user: emailMatch, matchedBy: 'email' };
    }
  }
  
  // Check phone (secondary identifier)
  if (activeUser.phone) {
    const normalized = normalizePhone(activeUser.phone);
    if (normalized) {
      const phoneMatch = await User.findOne({ phoneNumber: normalized }).lean();
      if (phoneMatch) {
        return { user: phoneMatch, matchedBy: 'phone' };
      }
    }
  }
  
  // Check GitHub URL (tertiary identifier - can be shared if misconfigured)
  if (activeUser.githubUrl) {
    const githubMatch = await User.findOne({ 
      githubUrl: activeUser.githubUrl.trim() 
    }).lean();
    if (githubMatch) {
      return { user: githubMatch, matchedBy: 'githubUrl' };
    }
  }
  
  return null;
}

// ========================================
// MIGRATION LOGIC
// ========================================

async function migrateActiveUsers(dryRun = true) {
  console.log('\n🚀 Starting Migration Script...\n');
  console.log(`📌 Mode: ${dryRun ? 'DRY-RUN (Preview Only)' : 'LIVE (Will Insert Data)'}\n`);
  console.log(`📂 Source DB: ${devDbUri}`);
  console.log(`📂 Target DB: ${prodDbUri}\n`);
  
  try {
    // Wait for connections
    await Promise.all([
      devConnection.asPromise(),
      prodConnection.asPromise()
    ]);
    
    console.log('✅ Connected to both databases\n');
    
    // Fetch all ActiveUsers
    const activeUsers = await ActiveUser.find({}).lean();
    console.log(`📊 Found ${activeUsers.length} ActiveUsers in dev DB\n`);
    
    if (activeUsers.length === 0) {
      console.log('⚠️  No ActiveUsers found to migrate.');
      return;
    }
    
    // Statistics
    const stats = {
      total: activeUsers.length,
      inserted: 0,
      skipped: 0,
      errors: 0,
      duplicates: [],
      errorDetails: [],
    };
    
    console.log('=' .repeat(80));
    console.log('MIGRATION PROGRESS');
    console.log('=' .repeat(80) + '\n');
    
    // Process each ActiveUser
    for (let i = 0; i < activeUsers.length; i++) {
      const activeUser = activeUsers[i];
      const progress = `[${i + 1}/${activeUsers.length}]`;
      
      try {
        // Check for duplicates
        const duplicateResult = await checkDuplicate(activeUser);
        
        if (duplicateResult) {
          const existing = duplicateResult.user;
          const matchedBy = duplicateResult.matchedBy;
          
          stats.skipped++;
          stats.duplicates.push({
            email: activeUser.email,
            phone: activeUser.phone,
            name: activeUser.fullName,
            existingUserId: existing.userId,
            reason: `Duplicate found (matched by ${matchedBy})`
          });
          
          console.log(`${progress} ⏭️  SKIP - ${activeUser.fullName || 'Unknown'}`);
          console.log(`          Email: ${activeUser.email || 'N/A'}`);
          console.log(`          Phone: ${activeUser.phone || 'N/A'}`);
          console.log(`          Reason: Already exists as ${existing.userId} (matched by ${matchedBy})`);
          console.log(`          Existing: ${existing.name} (${existing.primaryEmail || 'no email'})\n`);
          continue;
        }
        
        // Generate userId
        const userId = await getNextUserId(prodConnection);
        
        // Map role
        const mappedRole = ROLE_MAPPING[activeUser.role] || {
          role: "Student",
          roleId: "R004",
          type: "Developer"
        };
        
        // Map orgType (optional)
        const mappedOrgType = ORGTYPE_MAPPING[activeUser.orgType] || activeUser.orgType;
        
        // Normalize phone
        const normalizedPhone = normalizePhone(activeUser.phone);
        
        if (!normalizedPhone) {
          stats.errors++;
          stats.errorDetails.push({
            name: activeUser.fullName,
            email: activeUser.email,
            error: 'Invalid phone number'
          });
          
          console.log(`${progress} ❌ ERROR - ${activeUser.fullName || 'Unknown'}`);
          console.log(`          Reason: Invalid phone number - ${activeUser.phone}\n`);
          continue;
        }
        
        // Create new user document
        const newUserDoc = {
          userId,
          name: activeUser.fullName || 'Unknown',
          phoneNumber: normalizedPhone,
          
          primaryEmail: activeUser.email ? activeUser.email.toLowerCase().trim() : null,
          alternateEmails: activeUser.email ? [activeUser.email.toLowerCase().trim()] : [],
          
          profile: generateAvatarUrl(activeUser.fullName),
          type: mappedRole.type,
          
          organization: activeUser.organisation || null,
          orgType: mappedOrgType || null,
          
          isverified: activeUser.isPhoneVerified || false,
          
          role: mappedRole.role,
          roleId: mappedRole.roleId,
          
          githubUrl: activeUser.githubUrl || null,
          discordId: activeUser.discordId || null,
          linkedInUrl: activeUser.linkedinId || null,
          
          passwordHash: null,
          techStack: [],
          completedTasks: "0",
          prMerged: "0",
          ranking: 0,
          rating: 0,
          
          source: activeUser.source || "updateform",
        };
        
        // Insert or preview
        if (!dryRun) {
          await User.create(newUserDoc);
          stats.inserted++;
          console.log(`${progress} ✅ INSERTED - ${userId} - ${activeUser.fullName}`);
        } else {
          stats.inserted++;
          console.log(`${progress} 👁️  PREVIEW - ${userId} - ${activeUser.fullName}`);
        }
        
        console.log(`          Email: ${activeUser.email || 'N/A'}`);
        console.log(`          Phone: ${normalizedPhone}`);
        console.log(`          Role: ${activeUser.role} → ${mappedRole.roleId} (${mappedRole.type})`);
        console.log(`          Source: ${newUserDoc.source}\n`);
        
      } catch (err) {
        stats.errors++;
        stats.errorDetails.push({
          name: activeUser.fullName,
          email: activeUser.email,
          error: err.message
        });
        
        console.log(`${progress} ❌ ERROR - ${activeUser.fullName || 'Unknown'}`);
        console.log(`          Error: ${err.message}\n`);
      }
    }
    
    // Final Summary
    console.log('\n' + '='.repeat(80));
    console.log('MIGRATION SUMMARY');
    console.log('='.repeat(80) + '\n');
    
    console.log(`📊 Total ActiveUsers: ${stats.total}`);
    console.log(`✅ Successfully ${dryRun ? 'Previewed' : 'Inserted'}: ${stats.inserted}`);
    console.log(`⏭️  Skipped (Duplicates): ${stats.skipped}`);
    console.log(`❌ Errors: ${stats.errors}\n`);
    
    if (stats.duplicates.length > 0) {
      console.log('📋 DUPLICATE DETAILS:');
      console.log('-'.repeat(80));
      stats.duplicates.forEach((dup, idx) => {
        console.log(`${idx + 1}. ${dup.name || 'Unknown'}`);
        console.log(`   Email: ${dup.email || 'N/A'}`);
        console.log(`   Phone: ${dup.phone || 'N/A'}`);
        console.log(`   Existing User: ${dup.existingUserId}`);
        console.log('');
      });
    }
    
    if (stats.errorDetails.length > 0) {
      console.log('🚨 ERROR DETAILS:');
      console.log('-'.repeat(80));
      stats.errorDetails.forEach((err, idx) => {
        console.log(`${idx + 1}. ${err.name || 'Unknown'}`);
        console.log(`   Email: ${err.email || 'N/A'}`);
        console.log(`   Error: ${err.error}`);
        console.log('');
      });
    }
    
    if (dryRun) {
      console.log('\n💡 This was a DRY-RUN. No data was inserted.');
      console.log('💡 To perform actual migration, run: node migrateActiveUsers.js --live\n');
    } else {
      console.log('\n✅ Migration completed successfully!\n');
    }
    
  } catch (err) {
    console.error('\n❌ Fatal Error:', err.message);
    console.error(err.stack);
    process.exit(1);
  } finally {
    // Close connections
    await devConnection.close();
    await prodConnection.close();
    console.log('🔌 Database connections closed.\n');
  }
}

// ========================================
// SCRIPT EXECUTION
// ========================================

const args = process.argv.slice(2);
const isLive = args.includes('--live') || args.includes('-l');

migrateActiveUsers(!isLive)
  .then(() => {
    console.log('✅ Script completed successfully.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Script failed:', err);
    process.exit(1);
  });
