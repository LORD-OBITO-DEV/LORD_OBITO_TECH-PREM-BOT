import mongoose from 'mongoose';

const inviteSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  inviteLink: { type: String, required: true },
  messageId: { type: Number, required: true }, // Ajouté
  chatId: { type: Number, required: true },    // Ajouté
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model('Invite', inviteSchema);
