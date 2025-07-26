import TelegramBot from 'node-telegram-bot-api'; import express from 'express'; import fs from 'fs';

const config = JSON.parse(fs.readFileSync('./config.json', 'utf8')); const bot = new TelegramBot(config.BOT_TOKEN, { webHook: true });

const app = express(); app.use(express.json());

// === fichiers JSON === const subscribersPath = './subscribers.json'; const pendingPath = './pending.json'; const codesPath = './codes.json'; const referralsPath = './referrals.json';

let subscribers = fs.existsSync(subscribersPath) ? JSON.parse(fs.readFileSync(subscribersPath)) : {}; let pending = fs.existsSync(pendingPath) ? JSON.parse(fs.readFileSync(pendingPath)) : {}; let codes = fs.existsSync(codesPath) ? JSON.parse(fs.readFileSync(codesPath)) : {}; let referrals = fs.existsSync(referralsPath) ? JSON.parse(fs.readFileSync(referralsPath)) : {};

function saveSubscribers() { fs.writeFileSync(subscribersPath, JSON.stringify(subscribers, null, 2)); } function savePending() { fs.writeFileSync(pendingPath, JSON.stringify(pending, null, 2)); } function saveCodes() { fs.writeFileSync(codesPath, JSON.stringify(codes, null, 2)); } function saveReferrals() { fs.writeFileSync(referralsPath, JSON.stringify(referrals, null, 2)); } function getExpirationDate(days = 30) { const now = new Date(); now.setDate(now.getDate() + days); return now.toISOString(); }

// === Commandes utilisateurs ===

bot.onText(//start(?:\s+(\S+))?/, (msg, match) => { const userId = msg.from.id; const firstName = msg.from.first_name; const chatId = msg.chat.id; const referralCode = match[1];

const image = 'https://files.catbox.moe/dsmhrq.jpg'; const menu = ` ╔════════════════════ ║—͟͟͞͞➸⃝LORD_OBITO_TECH_PREM_BOT⍣⃝💀 ╠════════════════════ ║ ✞︎ /abonnement — Voir les moyens de paiement ║ ✞︎ /status — Vérifier ton abonnement ║ ✞︎ /promo — Gagne 1 mois gratuit ║ ✞︎ /codepromo — Génère ton code ║ ✞︎ /mesfilleuls — Voir tes filleuls ╚════════════════════════

© BY ✞︎ 𝙇𝙊𝙍𝘿 𝙊𝘽𝙄𝙏𝙊 𝘿𝙀𝙑 ✞`;

bot.sendPhoto(chatId, image, { caption: menu, parse_mode: "Markdown" });

if (referralCode && referralCode.startsWith("OBITO-")) { if (!referrals[referralCode]) referrals[referralCode] = [];

if (!referrals[referralCode].includes(userId)) {
  referrals[referralCode].push(userId);
  saveReferrals();

  bot.sendMessage(chatId, `🎉 Tu as été invité par le code *${referralCode}*.`, { parse_mode: "Markdown" });

  if (referrals[referralCode].length === 3) {
    const refUserId = Object.keys(codes).find(uid => codes[uid].code === referralCode);
    if (refUserId) {
      if (subscribers[refUserId]) {
        let exp = new Date(subscribers[refUserId].expires);
        exp.setDate(exp.getDate() + 30);
        subscribers[refUserId].expires = exp.toISOString();
      } else {
        subscribers[refUserId] = { username: `ID:${refUserId}`, expires: getExpirationDate() };
      }
      saveSubscribers();
      bot.sendMessage(refUserId, `🎁 Tu as gagné 1 mois gratuit ! Voici ton accès :\n${config.CHANNEL_LINK}`);
    }
  }
}

} });

bot.onText(//codepromo/, (msg) => { const userId = msg.from.id; if (codes[userId]) { return bot.sendMessage(msg.chat.id, 🔁 Ton code existe déjà : *${codes[userId].code}*\nPartage ce lien :\nhttps://t.me/${config.BOT_USERNAME}?start=${codes[userId].code}, { parse_mode: "Markdown" }); }

const code = OBITO-${Math.random().toString(36).substring(2, 7).toUpperCase()}; codes[userId] = { code }; referrals[code] = []; saveCodes(); saveReferrals();

bot.sendMessage(msg.chat.id, ✅ Code généré : *${code}*\nPartage ce lien :\n👉 https://t.me/${config.BOT_USERNAME}?start=${code}, { parse_mode: "Markdown" }); });

bot.onText(//mesfilleuls/, (msg) => { const userId = msg.from.id; const userCode = codes[userId]?.code; if (!userCode) return bot.sendMessage(msg.chat.id, ❌ Tu n’as pas encore de code. Utilise /codepromo pour en générer un.);

const count = referrals[userCode]?.length || 0; bot.sendMessage(msg.chat.id, 👥 Tu as ${count} filleul(s) avec le code *${userCode}*, { parse_mode: "Markdown" }); });

bot.onText(//topfilleuls/, (msg) => { if (String(msg.from.id) !== String(config.ADMIN_ID)) return bot.sendMessage(msg.chat.id, '⛔ Réservé à l’admin');

const classement = Object.entries(referrals) .map(([code, filleuls]) => { const uid = Object.keys(codes).find(u => codes[u].code === code); return { uid, code, count: filleuls.length }; }) .filter(e => e.uid) .sort((a, b) => b.count - a.count) .slice(0, 10);

if (!classement.length) return bot.sendMessage(msg.chat.id, Aucun filleul encore.);

const msgClassement = classement.map((u, i) => *${i + 1}.* ID: ${u.uid} – Code: ${u.code} – Filleuls: ${u.count}).join('\n'); bot.sendMessage(msg.chat.id, 🏆 *Top Parrains :*\n\n${msgClassement}, { parse_mode: "Markdown" }); });

