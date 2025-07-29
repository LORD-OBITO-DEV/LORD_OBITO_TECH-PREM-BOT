import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';

const dbFile = path.resolve('./data.sqlite');
let db;

async function initDB() {
  db = await open({
    filename: dbFile,
    driver: sqlite3.Database
  });

  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY,
      username TEXT,
      referral_code TEXT UNIQUE,
      referred_by TEXT,
      filleuls TEXT,
      proof TEXT,
      subscription_expires TEXT
    )
  `);
}

// === UTILS ===
function generateReferralCode() {
  return Math.random().toString(36).substring(2, 10).toUpperCase();
}

async function getUser(id) {
  const user = await db.get('SELECT * FROM users WHERE id = ?', id);
  return user;
}

async function createUser(id, username) {
  const referralCode = generateReferralCode();
  await db.run(
    'INSERT OR IGNORE INTO users (id, username, referral_code, filleuls) VALUES (?, ?, ?, ?)',
    id,
    username || `ID:${id}`,
    referralCode,
    JSON.stringify([])
  );
  return getUser(id);
}

async function setReferral(id, referredBy) {
  const user = await getUser(id);
  if (!user.referred_by && referredBy && referredBy !== String(id)) {
    await db.run('UPDATE users SET referred_by = ? WHERE id = ?', referredBy, id);

    const refUser = await db.get('SELECT * FROM users WHERE referral_code = ?', referredBy);
    if (refUser) {
      const filleuls = JSON.parse(refUser.filleuls || '[]');
      if (!filleuls.includes(String(id))) {
        filleuls.push(String(id));
        await db.run('UPDATE users SET filleuls = ? WHERE id = ?', JSON.stringify(filleuls), refUser.id);
      }
    }
  }
}

async function setProof(id, proofText) {
  await db.run('UPDATE users SET proof = ? WHERE id = ?', proofText, id);
}

async function setPremium(id, days = 30) {
  const now = new Date();
  now.setDate(now.getDate() + days);
  await db.run('UPDATE users SET subscription_expires = ? WHERE id = ?', now.toISOString(), id);
}

async function removePremium(id) {
  await db.run('UPDATE users SET subscription_expires = NULL WHERE id = ?', id);
}

async function isPremium(id, adminId) {
  if (String(id) === String(adminId)) return true;
  const user = await getUser(id);
  if (!user || !user.subscription_expires) return false;
  return new Date(user.subscription_expires) > new Date();
}

async function getFilleuls(id) {
  const user = await getUser(id);
  return user?.filleuls ? JSON.parse(user.filleuls) : [];
}

async function getReferralCode(id) {
  const user = await getUser(id);
  return user?.referral_code || null;
}

async function getAllUsers() {
  return db.all('SELECT * FROM users');
}

export default {
  initDB,
  createUser,
  getUser,
  setReferral,
  setProof,
  setPremium,
  removePremium,
  isPremium,
  getFilleuls,
  getReferralCode,
  getAllUsers,
  generateReferralCode
};
