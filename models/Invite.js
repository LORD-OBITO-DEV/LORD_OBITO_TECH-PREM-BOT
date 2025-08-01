import mongoose from 'mongoose';

const inviteSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  inviteLink: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('Invite', inviteSchema);
