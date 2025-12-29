import mongoose from "mongoose";

const ActiveUserSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true },
    phone: { type: String, required: true, unique: true },
    email: { type: String, trim: true },
    gender: { type: String, enum: ["Male", "Female", "Other"] },

    organisation: { type: String, trim: true },
    orgType: {
      type: String,
      enum: [
        "Government",
        "NGO",
        "Academic",
        "Corporate",
        "Social Enterprise",
        "Intergovernmental / Multilateral",
        "Community-Based",
        "Philanthropic Foundation / Trust",
        "Cooperative Society",
        "PSU",
        "Think Tank / Policy Research",
        "Faith-Based Organization",
        "Professional Association",
        "Startup / Innovation Hub",
        "Media / Advocacy",
        "Self",
      ],
    },

    role: {
      type: String,
      enum: ["Student", "Self", "Mentor", "Manager", "Program Coordinator"],
      required: true,
    },

    // Socials
    discordId: { type: String },
    githubId: { type: String },
    githubUrl: { type: String },
    linkedinId: { type: String },

    // Persisted consent
    acceptedTerms: { type: Boolean, default: false },
    acceptedTermsAt: { type: Date },

    // Verification and login
    isPhoneVerified: { type: Boolean, default: false },
    lastLogin: { type: Date },

    // Source tracking
    source: {
      type: String,
      enum: ["signup", "updateform"],
      default: "signup"
    },

    // JWT & Audit
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// Pre-save hook to normalize phone to +91XXXXXXXXXX format
ActiveUserSchema.pre("save", function (next) {
  try {
    if (this.phone) {
      const digits = String(this.phone).replace(/\D/g, "");
      this.phone = `+91${digits.replace(/^91/, "")}`;
    }
  } catch (e) {
    // ignore and proceed
  }
  next();
});

export default mongoose.model("ActiveUser", ActiveUserSchema);
    