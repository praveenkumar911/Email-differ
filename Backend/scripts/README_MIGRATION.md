# ActiveUser to User Migration Script

This script migrates ActiveUser documents from the dev database (`mail_test`) to the prod User collection (`badal_C4GT_latest`).

## Features

✅ **Dual Database Connection** - Connects to both dev and prod DBs simultaneously  
✅ **Sequential UserId Generation** - Finds highest userId and increments (U010, U011, etc.)  
✅ **Role Mapping** - Maps ActiveUser roles to User role + roleId + type  
✅ **Duplicate Detection** - Checks by email, phone, and GitHub URL  
✅ **Dry-Run Mode** - Preview changes without inserting data  
✅ **Detailed Logging** - Shows progress, errors, and summary  
✅ **Source Field Tracking** - Sets source as "updateform" or "mail"  

---

## Prerequisites

1. **Environment Variables** (create `.env` file in Backend folder):

```bash
# Dev Database (Source)
DEV_MONGO_URI=mongodb://10.8.0.13:27017/mail_test

# Prod Database (Target)
PROD_MONGO_URI=mongodb://10.8.0.13:27017/badal_C4GT_latest
```

2. **Install Dependencies**:

```bash
cd Backend
npm install mongoose dotenv
```

---

## Usage

### 1. **Dry-Run Mode (Preview Only - Recommended First)**

```bash
cd Backend
node scripts/migrateActiveUsers.js
```

This will:
- ✅ Connect to both databases
- ✅ Show what **would** be inserted
- ✅ Detect duplicates
- ✅ Show errors
- ❌ **NOT insert any data**

### 2. **Live Mode (Actual Migration)**

```bash
node scripts/migrateActiveUsers.js --live
```

OR

```bash
node scripts/migrateActiveUsers.js -l
```

This will:
- ✅ Connect to both databases
- ✅ Insert new users into prod DB
- ✅ Skip duplicates
- ✅ Log detailed results

---

## Field Mapping

| **ActiveUser (Dev)** | **User (Prod)** | **Notes** |
|---------------------|-----------------|-----------|
| `fullName` | `name` | Direct copy |
| `phone` (+91XXXXXXXXXX) | `phoneNumber` (10 digits) | Removes +91 prefix |
| `email` | `primaryEmail` | Lowercased and trimmed |
| - | `alternateEmails` | Array with email |
| `role` ("Student") | `role` + `roleId` + `type` | Mapped via ROLE_MAPPING |
| `organisation` | `organization` | Direct copy |
| `orgType` | `orgType` | Optional mapping via ORGTYPE_MAPPING |
| `githubUrl` | `githubUrl` | Direct copy |
| `discordId` | `discordId` | Direct copy |
| `linkedinId` | `linkedInUrl` | Field name change |
| `isPhoneVerified` | `isverified` | Direct copy |
| `source` ("updateform") | `source` | Keeps original or defaults to "updateform" |
| - | `userId` | Auto-generated (U010, U011, etc.) |
| - | `profile` | Generated avatar URL |
| - | `passwordHash` | Set to null (OTP login) |
| - | `techStack` | Empty array |
| - | `completedTasks` | "0" |
| - | `prMerged` | "0" |
| - | `ranking` | 0 |
| - | `rating` | 0 |

---

## Role Mapping

```javascript
"Student"             → role: "Student",         roleId: "R004", type: "Developer"
"Mentor"              → role: "Mentor",          roleId: "R005", type: "Mentor"
"Manager"             → role: "Manager",         roleId: "R003", type: "Organization Manager"
"Program Coordinator" → role: "ProgramCoordinator", roleId: "R002", type: "Program Coordinator"
```

---

## OrgType Mapping (Optional)

```javascript
"Government" → "Government Organizations (Gov)"
"Academic" → "Academic & Research"
"Corporate" → "Corporate / Private Sector"
"NGO" → "Social Innovation"
// ... etc.
```

---

## Duplicate Detection

The script checks for existing users by:
1. **Email** (primaryEmail)
2. **Phone Number** (phoneNumber)
3. **GitHub URL** (githubUrl)

If any match is found, the user is **SKIPPED** and logged.

---

## Example Output

### Dry-Run Mode:
```
🚀 Starting Migration Script...

📌 Mode: DRY-RUN (Preview Only)

📂 Source DB: mongodb://10.8.0.13:27017/mail_test
📂 Target DB: mongodb://10.8.0.13:27017/badal_C4GT_latest

✅ Connected to both databases

📊 Found 15 ActiveUsers in dev DB

================================================================================
MIGRATION PROGRESS
================================================================================

[1/15] 👁️  PREVIEW - U010 - Sampath Chowdari
          Email: sampathchowdarie@gmail.com
          Phone: 9398534935
          Role: Mentor → R005 (Mentor)
          Source: updateform

[2/15] ⏭️  SKIP - John Doe
          Email: john@example.com
          Phone: 9876543210
          Reason: Already exists as U005

[3/15] ❌ ERROR - Jane Smith
          Reason: Invalid phone number - +91abc123

================================================================================
MIGRATION SUMMARY
================================================================================

📊 Total ActiveUsers: 15
✅ Successfully Previewed: 12
⏭️  Skipped (Duplicates): 2
❌ Errors: 1

💡 This was a DRY-RUN. No data was inserted.
💡 To perform actual migration, run: node migrateActiveUsers.js --live
```

---

## Troubleshooting

### Error: "Cannot connect to database"
- Check MongoDB is running: `systemctl status mongod`
- Verify connection strings in `.env`
- Check firewall/network access

### Error: "Invalid phone number"
- ActiveUser has malformed phone field
- Script will skip and log error
- Review error details in summary

### Error: "Duplicate key error"
- User with same email/phone already exists
- Script detects this and skips automatically

---

## Safety Features

✅ **No Data Loss** - Only inserts new records, never updates/deletes existing  
✅ **Idempotent** - Can be run multiple times safely  
✅ **Rollback Safe** - Dry-run mode prevents accidental insertions  
✅ **Detailed Logs** - All operations logged for audit trail  

---

## Post-Migration Verification

After running in `--live` mode, verify:

```bash
# Check total user count
mongo badal_C4GT_latest --eval "db.users.count()"

# Check users with source = "updateform"
mongo badal_C4GT_latest --eval "db.users.count({ source: 'updateform' })"

# Check latest userId
mongo badal_C4GT_latest --eval "db.users.findOne({}, { userId: 1 }).sort({ userId: -1 })"
```

---

## Need Help?

If you encounter issues:
1. Check error logs in terminal output
2. Review duplicate/error details in summary
3. Verify database connectivity
4. Run in dry-run mode first to preview changes

---

## Author

Migration script created for C4GT Badal project - December 2025
