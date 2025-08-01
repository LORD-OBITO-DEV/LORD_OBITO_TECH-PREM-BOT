import mongoose from 'mongoose';

const referralSchema = new mongoose.Schema({
  userId: String,
  username: String,
  code: String,
  filleuls: [String]
});

const Referral = mongoose.model('Referral', referralSchema);
export default Referral;
