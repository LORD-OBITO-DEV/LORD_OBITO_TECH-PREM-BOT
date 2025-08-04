// models/Admin.js
import mongoose from 'mongoose';

const AdminSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    unique: true
  }
});

export default mongoose.model('Admin', AdminSchema);
