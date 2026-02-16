import mongoose from 'mongoose';

const UpdatedDataSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'mailUser' },

  updatedData: {
    fullName: String,
    email: String,
    phone: String,

    gender: {
      type: String,
      enum: ["Male", "Female", "Other", "Prefer not to say"]
    },

    // ✅ Structured organization (same as ActiveUser)
    organization: {
      name: { type: String, trim: true },
      ref: {
        type: {
          type: String,
          enum: ["orgs", "default", "custom"]
        },
        id: { type: String }
      }
    },

    // ✅ No enum restriction
    orgType: {
      type: String,
      trim: true
    },

    role: {
      type: String,
      enum: ["Developer"]
    },

    githubId: String,
    githubUrl: String,
    discordId: String,
    linkedinId: String,

    // ✅ Tech skills
    techStack: {
      type: [String],
      default: []
    }
  },

  submittedAt: { type: Date, default: Date.now },

  status: {
    type: String,
    enum: ['pending', 'completed', 'failed'],
    default: 'pending'
  },

  productionUserId: {
    type: String,
    default: null
  }

}, { timestamps: true });

export default mongoose.model('UpdatedData', UpdatedDataSchema);
