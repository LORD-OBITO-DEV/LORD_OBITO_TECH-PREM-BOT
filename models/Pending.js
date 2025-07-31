// models/Pending.js
import mongoose from 'mongoose';

const pendingSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  username: String,
  chatId: String,
  proof: String,
  requestedAt: String
});

export default mongoose.model('Pending', pendingSchema);
