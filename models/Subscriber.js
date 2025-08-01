// models/Subscriber.js
import mongoose from 'mongoose';

const subscriberSchema = new mongoose.Schema({
  userId: String,
  username: String,
  expires: Date
});

const Subscriber = mongoose.model('Subscriber', subscriberSchema);
export default Subscriber;
