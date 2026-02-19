import mongoose from 'mongoose';

const InactiveUserSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'mailUser', required: true },
  email: { type: String, required: true },
  
  // Reason for inactivity
  reason: { 
    type: String, 
    enum: [
      'max_deferrals',      // Clicked "defer" 3 times
      'never_opened',       // Never opened any email (24h+ expired)
      'opened_abandoned',   // Opened form but never submitted
      'max_reminders',      // Received 3 reminders, no action
      'token_expired'       // All tokens expired without action
    ],
    required: true 
  },
  
  // Tracking data
  totalDeferrals: { type: Number, default: 0 },      // How many times deferred
  totalEmailsSent: { type: Number, default: 0 },     // Total emails sent
  totalEmailsOpened: { type: Number, default: 0 },   // How many opened
  lastEmailSentAt: { type: Date },                   // Last email timestamp
  lastOpenedAt: { type: Date },                      // Last opened timestamp
  markedInactiveAt: { type: Date, default: Date.now },
  
  // Metadata
  source: { type: String, default: 'update_form' },
  notes: { type: String },                           // Additional context
  
  // Re-engagement
  canReengage: { type: Boolean, default: true },     // Can we contact again?
  reengagementAttempts: { type: Number, default: 0 }
}, { timestamps: true });

// Indexes for querying
InactiveUserSchema.index({ user: 1 });
InactiveUserSchema.index({ email: 1 });
InactiveUserSchema.index({ reason: 1 });
InactiveUserSchema.index({ markedInactiveAt: 1 });

export default mongoose.model('InactiveUser', InactiveUserSchema);
