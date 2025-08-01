import mongoose from 'mongoose';

const whitelistSchema = new mongoose.Schema({
  userId: String
});

const Whitelist = mongoose.model('Whitelist', whitelistSchema);
export default Whitelist;
