// models/Pending.js
import mongoose from 'mongoose';

const pendingSchema = new mongoose.Schema({
  userId: String,
  username: String,
  chatId: Number,
  proof: String,
  requestedAt: Date
});

const Pending = mongoose.model('Pending', pendingSchema);
export default Pending;
