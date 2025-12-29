import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  phone: String,
  githubId: String,
  githubUrl: String,
  discordId: String,
  role: { type: String, default: "Self" },
  lastEmailSent: Date,
  emailSentCount: { type: Number, default: 0 },
  // inside user schema definition
  isOptedOut: { type: Boolean, default: false },
  optOutAt: { type: Date } // optional timestamp on user doc

});

const EmailUser = mongoose.model('mailUser', UserSchema);
export default EmailUser;
