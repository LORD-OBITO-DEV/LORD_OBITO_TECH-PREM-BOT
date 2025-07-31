// models/Subscriber.js
import mongoose from 'mongoose';

const subscriberSchema = new mongoose.Schema({
  userId: { type: String, required: true, unique: true },
  username: String,
  expires: String
});

export default mongoose.model('Subscriber', subscriberSchema);
