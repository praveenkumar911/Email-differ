// models/PartialUpdateData.js
import mongoose from 'mongoose';

const PartialUpdateDataSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'mailUser', required: true },
  data: { type: Object, default: {} },
  lastSavedAt: { type: Date, default: Date.now },
}, { timestamps: true });

export default mongoose.model('PartialUpdateData', PartialUpdateDataSchema);
