import mongoose from 'mongoose';

const inviteSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  inviteLink: { type: String, required: true },
  chatId: { type: Number, required: true },
  messageId: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true } // → date d’expiration du lien
});

export default mongoose.model('Invite', inviteSchema);
