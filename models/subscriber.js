import mongoose from 'mongoose';

const subscriberSchema = new mongoose.Schema({
  userId: String,
  username: String,
  expires: String
});

export default mongoose.model('Subscriber', subscriberSchema);
