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
    organisation: String,
    orgType: {
      type: String,
      enum: [
        "Government Organizations (Gov)",
        "Non-Governmental Organizations (NGO)",
        "Academic",
        "Corporate (For-Profit)",
        "Social Enterprises",
        "Intergovernmental / Multilateral Organizations",
        "Community-Based Organizations (CBOs)",
        "Philanthropic Foundations / Trusts",
        "Cooperative Societies",
        "Public Sector Undertakings (PSUs)",
        "Think Tanks / Policy Research Institutes",
        "Faith-Based Organizations (FBOs)",
        "Professional Associations / Bodies",
        "Startup / Innovation Hubs",
        "Media and Advocacy Organizations",
        "Self",
      ]
    },
    role: {
      type: String,
      enum: ["Student", "Self", "Mentor", "Manager", "Program Coordinator"]
    },
    githubId: String,
    githubUrl: String,
    discordId: String,
    linkedinId: String
  },
  submittedAt: { type: Date, default: Date.now },
});

export default mongoose.model('UpdatedData', UpdatedDataSchema);
