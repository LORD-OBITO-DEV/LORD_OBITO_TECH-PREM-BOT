import TelegramBot from 'node-telegram-bot-api'; import express from 'express'; import fs from 'fs'; import crypto from 'crypto';

const config = JSON.parse(fs.readFileSync('./config.json', 'utf8')); const bot = new TelegramBot(config.BOT_TOKEN, { webHook: true });

const app = express(); app.use(express.json());

// === fichiers JSON === const subscribersPath = './subscribers.json'; const pendingPath = './pending.json'; const referralsPath = './referrals.json';

let subscribers = fs.existsSync(subscribersPath) ? JSON.parse(fs.readFileSync(subscribersPath)) : {}; let pending = fs.existsSync(pendingPath) ? JSON.parse(fs.readFileSync(pendingPath)) : {}; let referrals = fs.existsSync(referralsPath) ? JSON.parse(fs.readFileSync(referralsPath)) : {};

function saveSubscribers() { fs.writeFileSync(subscribersPath, JSON.stringify(subscribers, null, 2)); } function savePending() { fs.writeFileSync(pendingPath, JSON.stringify(pending, null, 2)); } function saveReferrals() { fs.writeFileSync(referralsPath, JSON.stringify(referrals, null, 2)); }

function getExpirationDate(days = 30) { const now = new Date(); now.setDate(now.getDate() + days); return now.toISOString(); }

function generateReferralCode() { return crypto.randomBytes(4).toString('hex').toUpperCase(); }

bot.onText(//start(?: (.+))?/, (msg, match) => { const chatId = msg.chat.id; const userId = msg.from.id; const refCode = match ? match[1] : null;

if (refCode) { const parrains = Object.entries(referrals).filter(([uid, data]) => data.code === refCode); if (parrains.length > 0) { const [parrainId, parrainData] = parrains[0]; if (!parrainData.filleuls) parrainData.filleuls = []; if (!parrainData.filleuls.includes(String(userId)) && userId !== Number(parrainId)) { parrainData.filleuls.push(String(userId)); referrals[parrainId] = parrainData; saveReferrals(); } } }

if (!referrals[userId]) { referrals[userId] = { code: generateReferralCode(), filleuls: [] }; saveReferrals(); }

const image = 'https://files.catbox.moe/dsmhrq.jpg'; const menu = ╔════════════════════ ║—͟͟͞͞➸⃝LORD_OBITO_TECH_PREM_BOT⍣⃝💀 ╠════════════════════ ║ ✞︎ /abonnement — Voir les moyens de paiement ║ ✞︎ /status — Vérifier ton abonnement ║ ✞︎ /promo — Gagne 1 mois gratuit ║ ✞︎ /codepromo — Ton code personnel ║ ✞︎ /mesfilleuls — Voir tes filleuls ╚════════════════════════ © BY ✞︎ 𝙇𝙊𝙍𝘿 𝙊𝘽𝙄𝙏𝙊 𝘿𝙀𝙑 ✞;

bot.sendPhoto(chatId, image, { caption: menu, parse_mode: "Markdown" }); });

bot.onText(//codepromo/, (msg) => { const userId = msg.from.id; if (!referrals[userId]) { referrals[userId] = { code: generateReferralCode(), filleuls: [] }; saveReferrals(); } const code = referrals[userId].code; bot.sendMessage(msg.chat.id, 🎫 Ton code promo unique est : *${code}*\n\nPartage ce lien à tes amis :\nhttps://t.me/${config.BOT_USERNAME}?start=${code}, { parse_mode: "Markdown" }); });

bot.onText(//mesfilleuls/, (msg) => { const userId = msg.from.id; const data = referrals[userId]; if (!data || !data.filleuls || data.filleuls.length === 0) { return bot.sendMessage(msg.chat.id, 😔 Tu n'as pas encore de filleuls.); } const filleulsList = data.filleuls.map(id => - ${id}).join('\n'); bot.sendMessage(msg.chat.id, 👥 Tu as ${data.filleuls.length} filleuls :\n${filleulsList}); });

bot.onText(//status/, (msg) => { const userId = msg.from.id; const sub = subscribers[userId]; if (sub) { bot.sendMessage(msg.chat.id, 📆 Ton abonnement expire le : *${new Date(sub.expires).toLocaleDateString()}*, { parse_mode: "Markdown" }); } else { bot.sendMessage(msg.chat.id, ❌ Tu n'es pas encore abonné.); } });

bot.onText(//promo/, (msg) => { bot.sendPhoto(msg.chat.id, 'https://i.imgur.com/7zwp4mc.jpeg', { caption: 🎁 *Promo Parrainage !*\n\nInvite tes amis avec ton code et gagne 1 mois gratuit après 3 filleuls !\nUtilise /codepromo pour récupérer ton code., parse_mode: "Markdown" }); });

bot.onText(//acces/, (msg) => { const chatId = msg.chat.id; const userId = msg.from.id; const username = msg.from.username || ID:${userId};

if (subscribers[userId] && new Date(subscribers[userId].expires) > new Date()) { return bot.sendMessage(chatId, ✅ Tu as déjà accès :\n${config.CHANNEL_LINK}); }

pending[userId] = { username, chatId, requestedAt: new Date().toISOString() }; savePending();

bot.sendMessage(chatId, 📬 Demande envoyée. L'admin validera après vérification.);

if (config.ADMIN_ID) { bot.sendMessage(config.ADMIN_ID, 🔔 Demande d’accès : @${username} (ID: ${userId})\nValide avec /valider ${userId}); } });

bot.onText(//valider (\d+)/, (msg, match) => { if (String(msg.from.id) !== String(config.ADMIN_ID)) { return bot.sendMessage(msg.chat.id, '⛔ Réservé à l’admin'); }

const userId = match[1]; const request = pending[userId]; if (!request) return bot.sendMessage(msg.chat.id, ❌ Aucun utilisateur avec ID ${userId});

let bonusDays = 0; const ref = referrals[userId]; if (ref && ref.filleuls && ref.filleuls.length >= 3) { bonusDays = 30; }

const exp = getExpirationDate(30 + bonusDays); subscribers[userId] = { username: request.username, expires: exp }; saveSubscribers(); delete pending[userId]; savePending();

bot.sendMessage(request.chatId, ✅ Paiement confirmé ! Voici ton lien :\n${config.CHANNEL_LINK}); bot.sendMessage(msg.chat.id, ✅ Validé pour @${request.username}); });

const PORT = process.env.PORT || 3000; const HOST = process.env.RENDER_EXTERNAL_URL || config.WEBHOOK_URL;

bot.setWebHook(${HOST}/bot${config.BOT_TOKEN});

app.post(/bot${config.BOT_TOKEN}, (req, res) => { bot.processUpdate(req.body); res.sendStatus(200); });

app.listen(PORT, '0.0.0.0', () => { console.log(🚀 Bot Webhook en écoute sur le port ${PORT}); });

setInterval(() => { const now = new Date(); let changed = false; for (const userId in subscribers) { if (new Date(subscribers[userId].expires) < now) { delete subscribers[userId]; changed = true; } } if (changed) saveSubscribers(); }, 3600000);

