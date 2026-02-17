import mongoose from 'mongoose';

const roleSchema = new mongoose.Schema({ 
  roleId: String,
  roleName: String,
});

const permissionSchema = new mongoose.Schema({
  permissionId: String,
  permissionName: String,
  description: String,
});

const rolePermissionSchema = new mongoose.Schema({
  roleId: String, 
  permissionId: [String],
});

const userSchema = new mongoose.Schema({
  userId: String,
  name: String,
  phoneNumber: String,
  profile: String,
  type: String,
  primaryEmail: { type: String, sparse: true },  
  alternateEmails: [{ type: String }],
  organization: {
    name: {
      type: String,
      required: true
    },
    ref: {
      type: {
        type: String,
        enum: ["orgs", "default", "custom"],
        required: true
      },
      id: {
        type: String,
        default: null
      }
    }
  },
  orgType: String,
  isverified: { type: Boolean, default: false },
  role: String,                                   
  roleId: String,                                 
  githubUrl: String,
  githubId: String,
  discordId: String,
  linkedInUrl: String,
  passwordHash: String,
  techStack: [{ type: String }],
  completedTasks: String,
  prMerged: String,
  ranking: Number,
  rating: Number,
  // assignedTasks: [{ type: String }],
  source: String,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

const permissionsExtraSchema = new mongoose.Schema({
  count: String, 
  permission: String,
  description: String,
});

const Role = mongoose.model('Role', roleSchema);
const Permission = mongoose.model('Permission', permissionSchema);
const RolePermission = mongoose.model('RolePermission', rolePermissionSchema);
const User = mongoose.model('User', userSchema);
const PermissionsExtra = mongoose.model('PermissionsExtra', permissionsExtraSchema);
/* ------------------------------------------------------------------ */
/*  CREATE INDEX – run once when the app starts                        */
/* ------------------------------------------------------------------ */
async function ensureIndexes() {
  await User.collection.createIndex(
    { primaryEmail: 1 },
    { unique: true, sparse: true }
  );
}

export { Role, Permission, RolePermission, User, PermissionsExtra };
