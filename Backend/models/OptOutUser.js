import mongoose from 'mongoose';

const OptOutUserSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'mailUser', required: true },
  email: { type: String, required: true },
  reason: { type: String },
  optedOutAt: { type: Date, default: Date.now },
  linkToken: { type: String }, // from EmailLog for traceability
  source: { type: String, default: 'update_form' }
}, { timestamps: true });

export default mongoose.model('OptOutUser', OptOutUserSchema);
