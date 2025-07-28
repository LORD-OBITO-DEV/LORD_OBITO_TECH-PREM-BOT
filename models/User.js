// models/User.js
import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  telegramId: { type: String, required: true, unique: true },
  username: String,
  expires: Date
});

export default mongoose.model('User', userSchema);
