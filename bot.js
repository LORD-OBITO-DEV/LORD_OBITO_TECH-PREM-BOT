import TelegramBot from 'node-telegram-bot-api'; import express from 'express'; import fs from 'fs'; import crypto from 'crypto';

const config = JSON.parse(fs.readFileSync('./config.json', 'utf8')); const bot = new TelegramBot(config.BOT_TOKEN, { webHook: true });

const app = express(); app.use(express.json());

const subscribersPath = './subscribers.json'; const pendingPath = './pending.json'; const referralsPath = './referrals.json';

let subscribers = fs.existsSync(subscribersPath) ? JSON.parse(fs.readFileSync(subscribersPath)) : {}; let pending = fs.existsSync(pendingPath) ? JSON.parse(fs.readFileSync(pendingPath)) : {}; let referrals = fs.existsSync(referralsPath) ? JSON.parse(fs.readFileSync(referralsPath)) : {};

function saveSubscribers() { fs.writeFileSync(subscribersPath, JSON.stringify(subscribers, null, 2)); } function savePending() { fs.writeFileSync(pendingPath, JSON.stringify(pending, null, 2)); } function saveReferrals() { fs.writeFileSync(referralsPath, JSON.stringify(referrals, null, 2)); } function getExpirationDate(days = 30) { const now = new Date(); now.setDate(now.getDate() + days); return now.toISOString(); } function generateReferralCode() { return crypto.randomBytes(4).toString('hex').toUpperCase(); }

bot.onText(//start(?: (.+))?/, (msg, match) => { const chatId = msg.chat.id; const userId = msg.from.id; const refCode = match ? match[1] : null;

if (refCode) { const parrains = Object.entries(referrals).filter(([uid, data]) => data.code === refCode); if (parrains.length > 0) { const [parrainId, parrainData] = parrains[0]; if (!parrainData.filleuls) parrainData.filleuls = []; if (!parrainData.filleuls.includes(String(userId)) && userId !== Number(parrainId)) { parrainData.filleuls.push(String(userId)); referrals[parrainId] = parrainData; saveReferrals(); } } }

if (!referrals[userId]) { referrals[userId] = { code: generateReferralCode(), filleuls: [] }; saveReferrals(); }

const image = 'https://files.catbox.moe/dsmhrq.jpg'; const menu = ╔════════════════════ ║—͟͟͞͞➸⃝LORD_OBITO_TECH_PREM_BOT⍣⃝💀 ╠════════════════════ ║ ✞︎ /abonnement — Voir les moyens de paiement ║ ✞︎ /status — Vérifier ton abonnement ║ ✞︎ /promo — Gagne 1 mois gratuit ║ ✞︎ /codepromo — Ton code personnel ║ ✞︎ /mesfilleuls — Voir tes filleuls ║ ✞︎ /help — Liste des commandes ╚════════════════════════ © BY ✞︎ 𝙇𝙊𝙍𝘿 𝙊𝘽𝙄𝙏𝙊 𝘿𝙀𝙑 ✞; bot.sendPhoto(chatId, image, { caption: menu, parse_mode: "Markdown" }); });

bot.onText(//help/, (msg) => { const text = 📌 *Commandes disponibles* : /start — Démarrer le bot /abonnement — Voir les moyens de paiement /status — Vérifier ton abonnement /codepromo — Voir ton code promo /mesfilleuls — Liste de tes filleuls /promo — Ton lien de parrainage /valider <id> — (admin) Valider un paiement; bot.sendMessage(msg.chat.id, text, { parse_mode: "Markdown" }); });

bot.onText(//codepromo/, (msg) => { const userId = msg.from.id; if (!referrals[userId]) { referrals[userId] = { code: generateReferralCode(), filleuls: [] }; saveReferrals(); } const code = referrals[userId].code; bot.sendMessage(msg.chat.id, 🎫 Ton code promo : *${code}*\nPartage-le avec /start ${code}, { parse_mode: "Markdown" }); });

bot.onText(//promo/, (msg) => { const userId = msg.from.id; const username = msg.from.username || null;

if (!referrals[userId]) { referrals[userId] = { code: generateReferralCode(), filleuls: [] }; saveReferrals(); }

const code = referrals[userId].code; const startLink = username ? https://t.me/${config.BOT_USERNAME}?start=${code} : /start ${code}; const message = 🎁 Invite tes amis avec ce lien :\n${startLink}\n\n3 filleuls = 1 mois gratuit ! 🔥; bot.sendMessage(msg.chat.id, message); });

bot.onText(//mesfilleuls/, (msg) => { const userId = msg.from.id; const data = referrals[userId]; if (!data || !data.filleuls || data.filleuls.length === 0) { return bot.sendMessage(msg.chat.id, 😔 Tu n'as pas encore de filleuls.); } const filleulsList = data.filleuls.map(id => - ID: ${id}).join('\n'); bot.sendMessage(msg.chat.id, 👥 Tu as ${data.filleuls.length} filleuls :\n${filleulsList}); });

bot.onText(//abonnement/, (msg) => { const chatId = msg.chat.id; const imageURL = 'https://files.catbox.moe/4m5nb4.jpg'; const caption = 💳 *Abonnement Premium* — 1000 FCFA (~$1.60) 📎 Moyens de paiement :\nClique sur un bouton ci-dessous :\n\n✅ Après paiement, tape /preuve NOM NUMÉRO;

const options = { caption, parse_mode: "Markdown", reply_markup: { inline_keyboard: [ [{ text: '💳 PayPal', callback_data: 'pay_paypal' }], [{ text: '🌊 Wave', callback_data: 'pay_wave' }], [{ text: '🟠 Orange Money', callback_data: 'pay_om' }], [{ text: '💛 MTN Money', callback_data: 'pay_mtn' }] ] } }; bot.sendPhoto(chatId, imageURL, options); });

bot.on('callback_query', (query) => { const chatId = query.message.chat.id; const data = query.data;

let text = ''; switch (data) { case 'pay_paypal': text = 🔵 *Paiement PayPal*\n👉 ${config.PAYPAL_LINK}\n💵 1000 FCFA\n📨 Envoie /preuve après paiement.; break; case 'pay_wave': text = 🌊 *Wave*\n📱 ${config.WAVE_NUMBER}\n💵 1000 FCFA\n📨 Envoie /preuve après paiement.; break; case 'pay_om': text = 🟠 *Orange Money*\n📱 ${config.OM_NUMBER}\n💵 1000 FCFA\n📨 Envoie /preuve après paiement.; break; case 'pay_mtn': text = 💛 *MTN Money*\n📱 ${config.MTN_NUMBER}\n💵 1000 FCFA\n📨 Envoie /preuve après paiement.; break; default: return; } bot.sendMessage(chatId, text, { parse_mode: "Markdown" }); bot.answerCallbackQuery(query.id); });

bot.onText(//preuve (.+) (.+)/, (msg, match) => { const userId = msg.from.id; const username = msg.from.username || ID:${userId}; const name = match[1]; const phone = match[2];

const info = 📩 *Nouvelle preuve de paiement !*\n\n👤 Utilisateur : @${username}\n🧾 Nom : *${name}*\n📱 Numéro : *${phone}*\n🕒 Date : ${new Date().toLocaleString()}\n\nValide avec /valider ${userId};

if (config.ADMIN_ID) { bot.sendMessage(config.ADMIN_ID, info, { parse_mode: "Markdown" }); } bot.sendMessage(msg.chat.id, ✅ Merci pour ta preuve. Elle sera vérifiée sous peu., { parse_mode: "Markdown" }); });

