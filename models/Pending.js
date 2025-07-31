// models/Pending.js
import mongoose from 'mongoose';

const pendingSchema = new mongoose.Schema({
  userId: String,
  username: String,
  chatId: String,
  proof: String,
  requestedAt: String
});

export default mongoose.model('Pending', pendingSchema);
