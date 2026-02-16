import mongoose from "mongoose";

const ActiveUserSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true },

    phone: {
      type: String,
      required: true,
      unique: true,
      validate: {
        validator: v => /^\+\d{8,15}$/.test(v),
        message: props => `${props.value} is not valid E.164 format`
      }
    },

    email: { type: String, trim: true },

    gender: { type: String, enum: ["Male", "Female", "Other"] },

    // ✅ Structured Organization
    organization: {
      name: {
        type: String,
        required: true,
        trim: true
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

    orgType: {
      type: String,
      trim: true
    },

    // ✅ Role ID (Single source of truth)
    roleId: {
      type: String,
      required: true
    },

    // Socials
    discordId: String,
    githubId: String,
    githubUrl: String,
    linkedinId: String,
    techStack: [{ type: String }],
    acceptedTerms: { type: Boolean, default: false },
    acceptedTermsAt: Date,

    isPhoneVerified: { type: Boolean, default: false },
    lastLogin: Date,

    source: {
      type: String,
      enum: ["signup", "updateform"],
      default: "signup"
    },
  },
  { timestamps: true }
);

export default mongoose.model("ActiveUser", ActiveUserSchema);
    