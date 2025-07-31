import mongoose from 'mongoose';

const referralSchema = new mongoose.Schema({
  userId: String,
  code: String,
  username: String,
  filleuls: [String]
});

export default mongoose.model('Referral', referralSchema);
