import TelegramBot from 'node-telegram-bot-api'; import express from 'express'; import fs from 'fs'; import crypto from 'crypto';

const config = JSON.parse(fs.readFileSync('./config.json', 'utf8')); const bot = new TelegramBot(config.BOT_TOKEN, { webHook: true });

const app = express(); app.use(express.json());

// === Fichiers JSON === const subscribersPath = './subscribers.json'; const pendingPath = './pending.json'; const referralsPath = './referrals.json'; const preuvesPath = './preuves.json';

let subscribers = fs.existsSync(subscribersPath) ? JSON.parse(fs.readFileSync(subscribersPath)) : {}; let pending = fs.existsSync(pendingPath) ? JSON.parse(fs.readFileSync(pendingPath)) : {}; let referrals = fs.existsSync(referralsPath) ? JSON.parse(fs.readFileSync(referralsPath)) : {}; let preuves = fs.existsSync(preuvesPath) ? JSON.parse(fs.readFileSync(preuvesPath)) : {};

// === Fonctions sauvegarde === function saveSubscribers() { fs.writeFileSync(subscribersPath, JSON.stringify(subscribers, null, 2)); } function savePending() { fs.writeFileSync(pendingPath, JSON.stringify(pending, null, 2)); } function saveReferrals() { fs.writeFileSync(referralsPath, JSON.stringify(referrals, null, 2)); } function savePreuves() { fs.writeFileSync(preuvesPath, JSON.stringify(preuves, null, 2)); } function getExpirationDate(days = 30) { const now = new Date(); now.setDate(now.getDate() + days); return now.toISOString(); } function generateReferralCode() { return crypto.randomBytes(4).toString('hex').toUpperCase(); }

// === /start === bot.onText(//start(?: (.+))?/, (msg, match) => { const chatId = msg.chat.id; const userId = msg.from.id; const refCode = match ? match[1] : null;

if (refCode) { const parrains = Object.entries(referrals).filter(([uid, data]) => data.code === refCode); if (parrains.length > 0) { const [parrainId, parrainData] = parrains[0]; if (!parrainData.filleuls) parrainData.filleuls = []; if (!parrainData.filleuls.includes(String(userId)) && userId !== Number(parrainId)) { parrainData.filleuls.push(String(userId)); referrals[parrainId] = parrainData; saveReferrals(); } } }

if (!referrals[userId]) { referrals[userId] = { code: generateReferralCode(), filleuls: [] }; saveReferrals(); }

const image = 'https://files.catbox.moe/dsmhrq.jpg'; const menu =  ╔════════════════════ ║—͟͟͞͞➸⃝LORD_OBITO_TECH_PREM_BOT⍣⃝💀 ╠════════════════════ ║ ✞︎ /abonnement — Voir les moyens de paiement ║ ✞︎ /status — Vérifier ton abonnement ║ ✞︎ /promo — Gagne 1 mois gratuit ║ ✞︎ /codepromo — Ton code personnel ║ ✞︎ /mesfilleuls — Voir tes filleuls ║ ✞︎ /preuve NOM NUMERO — Envoyer preuve ║ ✞︎ /help — Liste des commandes ╚════════════════════════ © BY ✞︎ 𝙇𝙊𝙍𝘿 𝙊𝘽𝙄𝙏𝙊 𝘿𝙀𝙑 ✞;

bot.sendPhoto(chatId, image, { caption: menu, parse_mode: "Markdown" }); });

// === /abonnement === bot.onText(//abonnement/, (msg) => { const message = ` 💳 Abonnement Premium — 1000 FCFA (~$1.60)

📎 Moyens de paiement : • PayPal : /paypal • Wave : /wave 🌊 • Orange Money : /om • MTN Money : /mtn

Après paiement, utilise /preuve NOM NUMERO puis /acces.`; bot.sendMessage(msg.chat.id, message, { parse_mode: 'Markdown' }); });

bot.onText(//paypal/, (msg) => { bot.sendMessage(msg.chat.id, 🔵 *PayPal* : ${config.PAYPAL_LINK}, { parse_mode: 'Markdown' }); });

bot.onText(//wave/, (msg) => { bot.sendMessage(msg.chat.id, 🌊 *Wave* : ${config.WAVE_NUMBER}, { parse_mode: 'Markdown' }); });

bot.onText(//om/, (msg) => { bot.sendMessage(msg.chat.id, 🟠 *Orange Money* : ${config.OM_NUMBER}, { parse_mode: 'Markdown' }); });

bot.onText(//mtn/, (msg) => { bot.sendMessage(msg.chat.id, 💛 *MTN* : ${config.MTN_NUMBER}, { parse_mode: 'Markdown' }); });

// === /preuve NOM NUMERO === bot.onText(//preuve (.+)/, (msg, match) => { const userId = msg.from.id; const preuveText = match[1]; preuves[userId] = { text: preuveText, date: new Date().toISOString() }; savePreuves(); bot.sendMessage(msg.chat.id, '✅ Preuve enregistrée. Clique maintenant sur /acces.'); if (config.ADMIN_ID) { bot.sendMessage(config.ADMIN_ID, 🧾 Nouvelle preuve de ${userId} : ${preuveText}); } });

// === /acces === bot.onText(//acces/, (msg) => { const userId = msg.from.id; if (subscribers[userId] && new Date(subscribers[userId].expires) > new Date()) { return bot.sendMessage(msg.chat.id, ✅ Tu as déjà accès :\n${config.CHANNEL_LINK}); } const username = msg.from.username || ID:${userId}; pending[userId] = { username, chatId: msg.chat.id }; savePending(); bot.sendMessage(msg.chat.id, '📬 Demande envoyée. L’admin validera après vérification.'); if (config.ADMIN_ID) { const preuve = preuves[userId] ? \n📎 Preuve : ${preuves[userId].text} : ''; bot.sendMessage(config.ADMIN_ID, 🔔 Demande : @${username} (ID: ${userId})${preuve}\nValide avec /valider ${userId}); } });

// === /valider ID === bot.onText(//valider (\d+)/, (msg, match) => { if (String(msg.from.id) !== String(config.ADMIN_ID)) return; const userId = match[1]; const request = pending[userId]; if (!request) return; const exp = getExpirationDate(30); subscribers[userId] = { username: request.username, expires: exp }; delete pending[userId]; saveSubscribers(); savePending(); bot.sendMessage(request.chatId, ✅ Accès confirmé !\n${config.CHANNEL_LINK}); bot.sendMessage(msg.chat.id, ✔️ Validé pour ${request.username}); });

// === Webhook === const PORT = process.env.PORT || 3000; const HOST = process.env.RENDER_EXTERNAL_URL || config.WEBHOOK_URL; bot.setWebHook(${HOST}/bot${config.BOT_TOKEN});

app.post(/bot${config.BOT_TOKEN}, (req, res) => { bot.processUpdate(req.body); res.sendStatus(200); });

app.listen(PORT, '0.0.0.0', () => { console.log(🚀 Bot en ligne sur le port ${PORT}); });

