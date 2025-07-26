import TelegramBot from 'node-telegram-bot-api'; import express from 'express'; import fs from 'fs'; import crypto from 'crypto';

const config = JSON.parse(fs.readFileSync('./config.json', 'utf8')); const bot = new TelegramBot(config.BOT_TOKEN, { webHook: true });

const app = express(); app.use(express.json());

const subscribersPath = './subscribers.json'; const pendingPath = './pending.json'; const referralsPath = './referrals.json';

let subscribers = fs.existsSync(subscribersPath) ? JSON.parse(fs.readFileSync(subscribersPath)) : {}; let pending = fs.existsSync(pendingPath) ? JSON.parse(fs.readFileSync(pendingPath)) : {}; let referrals = fs.existsSync(referralsPath) ? JSON.parse(fs.readFileSync(referralsPath)) : {};

function saveSubscribers() { fs.writeFileSync(subscribersPath, JSON.stringify(subscribers, null, 2)); } function savePending() { fs.writeFileSync(pendingPath, JSON.stringify(pending, null, 2)); } function saveReferrals() { fs.writeFileSync(referralsPath, JSON.stringify(referrals, null, 2)); }

function getExpirationDate(days = 30) { const now = new Date(); now.setDate(now.getDate() + days); return now.toISOString(); }

function generateReferralCode() { return crypto.randomBytes(4).toString('hex').toUpperCase(); }

bot.onText(//start(?: (.+))?/, (msg, match) => { const chatId = msg.chat.id; const userId = msg.from.id; const refCode = match ? match[1] : null;

if (refCode) { const parrains = Object.entries(referrals).filter(([uid, data]) => data.code === refCode); if (parrains.length > 0) { const [parrainId, parrainData] = parrains[0]; if (!parrainData.filleuls) parrainData.filleuls = []; if (!parrainData.filleuls.includes(String(userId)) && userId !== Number(parrainId)) { parrainData.filleuls.push(String(userId)); referrals[parrainId] = parrainData; saveReferrals(); } } }

if (!referrals[userId]) { referrals[userId] = { code: generateReferralCode(), filleuls: [] }; saveReferrals(); }

const image = 'https://files.catbox.moe/dsmhrq.jpg'; const menu = ╔════════════════════ ║—͟͟͞͞➸⃝LORD_OBITO_TECH_PREM_BOT⍣⃝💀 ╠════════════════════ ║ ✞︎ /abonnement — Voir les moyens de paiement ║ ✞︎ /status — Vérifier ton abonnement ║ ✞︎ /promo — Gagne 1 mois gratuit ║ ✞︎ /codepromo — Ton code personnel ║ ✞︎ /mesfilleuls — Voir tes filleuls ║ ✞︎ /help — Liste des commandes ╚════════════════════════ © BY ✞︎ 𝙇𝙊𝙍𝘿 𝙊𝘽𝙄𝙏𝙊 𝘿𝙀𝙑 ✞; bot.sendPhoto(chatId, image, { caption: menu, parse_mode: "Markdown" }); });

bot.onText(//codepromo/, (msg) => { const userId = msg.from.id; if (!referrals[userId]) { referrals[userId] = { code: generateReferralCode(), filleuls: [] }; saveReferrals(); } const code = referrals[userId].code; bot.sendMessage(msg.chat.id, 🎫 Ton code promo : *${code}*\nPartage-le avec /start ${code}, { parse_mode: "Markdown" }); });

bot.onText(//mesfilleuls/, (msg) => { const userId = msg.from.id; const data = referrals[userId]; if (!data || !data.filleuls || data.filleuls.length === 0) { return bot.sendMessage(msg.chat.id, 😔 Tu n'as pas encore de filleuls.); } const filleulsList = data.filleuls.map(id => - ID: ${id}).join('\n'); bot.sendMessage(msg.chat.id, 👥 Tu as ${data.filleuls.length} filleuls :\n${filleulsList}); });

bot.onText(//promo/, (msg) => { const userId = msg.from.id; const username = msg.from.username || null; const data = referrals[userId];

if (!data || !data.code) { return bot.sendMessage(msg.chat.id, ❌ Tu n’as pas encore de code promo. Utilise /start pour en générer un.); }

const code = data.code; const nbFilleuls = data.filleuls?.length || 0; const bonus = nbFilleuls >= 3 ? "🎁 Tu es éligible à un mois gratuit (3 filleuls ou +) !" : "💡 Invite 3 amis avec ton lien pour obtenir 1 mois gratuit."; const botUsername = config.BOT_USERNAME || "MonBot"; const link = https://t.me/${botUsername}?start=${code};

const message = 🎉 *Programme de Parrainage Premium !*\n\n🔑 Ton code promo : *${code}*\n👥 Nombre de filleuls : *${nbFilleuls}*\n\n${bonus}\n\n✅ Partage ce lien à tes amis :\n👉 [Clique ici pour inviter](${link})\nOu copie ce lien : \${link}``;

bot.sendMessage(msg.chat.id, message, { parse_mode: "Markdown", disable_web_page_preview: true }); });

bot.onText(//help/, (msg) => { const help = `🆘 Liste des commandes disponibles :

📌 /start — Lancer le bot 🎁 /promo — Gagne 1 mois en parrainant 🔗 /codepromo — Ton code de parrainage 👥 /mesfilleuls — Voir tes filleuls 💳 /abonnement — Voir les moyens de paiement 🟢 /status — Vérifie ton abonnement 🔓 /acces — Demande d’accès après paiement 👑 /valider [ID] — Valide un utilisateur (admin)`;

bot.sendMessage(msg.chat.id, help, { parse_mode: 'Markdown' }); });

