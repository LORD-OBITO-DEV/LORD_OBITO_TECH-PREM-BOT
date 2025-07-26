// bot.js import TelegramBot from 'node-telegram-bot-api'; import express from 'express'; import fs from 'fs'; import crypto from 'crypto';

const config = JSON.parse(fs.readFileSync('./config.json', 'utf8')); const bot = new TelegramBot(config.BOT_TOKEN, { webHook: true });

const app = express(); app.use(express.json());

// === Fichiers JSON === const subscribersPath = './subscribers.json'; const pendingPath = './pending.json'; const referralsPath = './referrals.json';

let subscribers = fs.existsSync(subscribersPath) ? JSON.parse(fs.readFileSync(subscribersPath)) : {}; let pending = fs.existsSync(pendingPath) ? JSON.parse(fs.readFileSync(pendingPath)) : {}; let referrals = fs.existsSync(referralsPath) ? JSON.parse(fs.readFileSync(referralsPath)) : {};

// === Fonctions sauvegarde === function saveSubscribers() { fs.writeFileSync(subscribersPath, JSON.stringify(subscribers, null, 2)); } function savePending() { fs.writeFileSync(pendingPath, JSON.stringify(pending, null, 2)); } function saveReferrals() { fs.writeFileSync(referralsPath, JSON.stringify(referrals, null, 2)); } function getExpirationDate(days = 30) { const now = new Date(); now.setDate(now.getDate() + days); return now.toISOString(); } function generateReferralCode() { return crypto.randomBytes(4).toString('hex').toUpperCase(); }

// === /start === bot.onText(//start(?: (.+))?/, (msg, match) => { const chatId = msg.chat.id; const userId = msg.from.id; const refCode = match ? match[1] : null;

if (refCode) { const parrains = Object.entries(referrals).filter(([uid, data]) => data.code === refCode); if (parrains.length > 0) { const [parrainId, parrainData] = parrains[0]; if (!parrainData.filleuls) parrainData.filleuls = []; if (!parrainData.filleuls.includes(String(userId)) && userId !== Number(parrainId)) { parrainData.filleuls.push(String(userId)); referrals[parrainId] = parrainData; saveReferrals(); } } }

if (!referrals[userId]) { referrals[userId] = { code: generateReferralCode(), filleuls: [] }; saveReferrals(); }

const image = 'https://files.catbox.moe/dsmhrq.jpg'; const menu = ╔════════════════════ ║—͟͟͞͞➝⃝LORD_OBITO_TECH_PREM_BOT✳️💀 ╠════════════════════ ║ ✮ /abonnement — Voir les moyens de paiement ║ ✮ /status — Vérifier ton abonnement ║ ✮ /promo — Gagne 1 mois gratuit ║ ✮ /codepromo — Ton code personnel ║ ✮ /mesfilleuls — Voir tes filleuls ║ ✮ /help — Liste des commandes ╚════════════════════════ © BY ✮ 𝙇𝙊𝙍𝘿 𝙊𝘽𝙄𝙏𝙊 𝘿𝙀𝙑 ✮; bot.sendPhoto(chatId, image, { caption: menu, parse_mode: "Markdown" }); });

bot.onText(//abonnement/, (msg) => { const message = ` 💳 Abonnement Premium — 1000 FCFA (~$1.60)

📎 Moyens de paiement : • PayPal : /paypal • Wave : /wave 🌊 • Orange Money : /om • MTN Money : /mtn

✅ Après paiement, utilise /preuve NOM NUMÉRO pour envoyer la preuve.`; bot.sendMessage(msg.chat.id, message, { parse_mode: 'Markdown' }); });

bot.onText(//paypal/, (msg) => { bot.sendMessage(msg.chat.id, 🔵 PayPal : ${config.PAYPAL_LINK}); });

bot.onText(//wave/, (msg) => { bot.sendMessage(msg.chat.id, 🌊 Wave : ${config.WAVE_NUMBER}); });

bot.onText(//om/, (msg) => { bot.sendMessage(msg.chat.id, 🟠 Orange Money : ${config.OM_NUMBER}); });

bot.onText(//mtn/, (msg) => { bot.sendMessage(msg.chat.id, 💛 MTN Money : ${config.MTN_NUMBER}); });

// === /preuve NOM NUMERO === bot.onText(//preuve (.+)/, (msg, match) => { const userId = msg.from.id; const username = msg.from.username || ID:${userId}; const preuve = match[1];

if (!preuve || preuve.length < 3) { return bot.sendMessage(msg.chat.id, '❌ Format incorrect. Exemple : /preuve Jean +2250700000000'); }

pending[userId] = { username, preuve, chatId: msg.chat.id }; savePending();

bot.sendMessage(msg.chat.id, '📩 Preuve reçue ! En attente de validation.'); if (config.ADMIN_ID) { bot.sendMessage(config.ADMIN_ID, `📥 Preuve de paiement reçue de @${username} (ID ${userId}) :

Nom + Numéro : ${preuve}

✅ Pour valider : /valider ${userId}`); } });

bot.onText(//valider (\d+)/, (msg, match) => { if (String(msg.from.id) !== String(config.ADMIN_ID)) { return bot.sendMessage(msg.chat.id, '⛔ Commande réservée à l’admin'); } const userId = match[1]; const data = pending[userId]; if (!data) return bot.sendMessage(msg.chat.id, '❌ Aucune preuve pour cet utilisateur.');

const exp = getExpirationDate(30); subscribers[userId] = { username: data.username, expires: exp }; saveSubscribers(); delete pending[userId]; savePending();

bot.sendMessage(data.chatId, ✅ Paiement confirmé ! Voici ton lien : ${config.CHANNEL_LINK}); bot.sendMessage(msg.chat.id, 👍 Validé pour ${data.username}); });

bot.onText(//status/, (msg) => { const userId = msg.from.id; const sub = subscribers[userId]; if (sub && new Date(sub.expires) > new Date()) { return bot.sendMessage(msg.chat.id, ✅ Abonnement actif jusqu’au : *${new Date(sub.expires).toLocaleDateString()}*, { parse_mode: 'Markdown' }); } return bot.sendMessage(msg.chat.id, '❌ Ton abonnement est expiré ou inexistant.'); });

// === Webhook config === const PORT = process.env.PORT || 3000; const HOST = process.env.RENDER_EXTERNAL_URL || config.WEBHOOK_URL;

bot.setWebHook(${HOST}/bot${config.BOT_TOKEN});

app.post(/bot${config.BOT_TOKEN}, (req, res) => { bot.processUpdate(req.body); res.sendStatus(200); });

app.listen(PORT, '0.0.0.0', () => { console.log(🚀 Bot actif sur le port ${PORT}); });

