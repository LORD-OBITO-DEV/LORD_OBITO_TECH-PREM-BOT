import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  userId: String,
  lang: String
});

export default mongoose.model('User', userSchema);
