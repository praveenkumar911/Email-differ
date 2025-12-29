import mongoose from 'mongoose';

const EmailLogSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'mailUser' },
  emailType: String,
  sentAt: { type: Date, default: Date.now },
  status: String,
  linkToken: { 
    type: String, 
    unique: true,
    index: true
  },
  activatedAt: { type: Date, default: null, index: true },
  usedAt: { type: Date, default: null, index: true },
  verifiedPhone: { type: String, default: null },
  phoneVerifiedAt: { type: Date, default: null }, // ✅ Track OTP verification time
  isOAuthInProgress: { type: Boolean, default: false }
});

// ✅ Compound indexes for common queries
EmailLogSchema.index({ usedAt: 1, activatedAt: 1 }); // For stale activation queries
EmailLogSchema.index({ user: 1, emailType: 1 }); // For user email history
EmailLogSchema.index({ sentAt: 1, usedAt: 1 }); // For cleanup queries

export default mongoose.model('EmailLog', EmailLogSchema);