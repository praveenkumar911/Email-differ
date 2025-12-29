import mongoose from 'mongoose';

const DeferredDataSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'mailUser' },
  deferredAt: { type: Date, default: Date.now },
  attempts: { type: Number, default: 1 },
});

export default mongoose.model('DeferredData', DeferredDataSchema);
