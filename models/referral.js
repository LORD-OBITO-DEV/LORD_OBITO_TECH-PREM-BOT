import mongoose from 'mongoose';

const referralSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  code: { type: String, required: true },
  filleuls: { type: [String], default: [] },
  username: { type: String }
});

export default mongoose.model('Referral', referralSchema);
