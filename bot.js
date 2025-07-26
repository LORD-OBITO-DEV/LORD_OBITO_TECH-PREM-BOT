import TelegramBot from 'node-telegram-bot-api'; import express from 'express'; import fs from 'fs'; import crypto from 'crypto';

const config = JSON.parse(fs.readFileSync('./config.json', 'utf8')); const bot = new TelegramBot(config.BOT_TOKEN, { webHook: true });

const app = express(); app.use(express.json());

// === Fichiers JSON === const subscribersPath = './subscribers.json'; const pendingPath = './pending.json'; const referralsPath = './referrals.json';

let subscribers = fs.existsSync(subscribersPath) ? JSON.parse(fs.readFileSync(subscribersPath)) : {}; let pending = fs.existsSync(pendingPath) ? JSON.parse(fs.readFileSync(pendingPath)) : {}; let referrals = fs.existsSync(referralsPath) ? JSON.parse(fs.readFileSync(referralsPath)) : {};

// === Fonctions sauvegarde === function saveSubscribers() { fs.writeFileSync(subscribersPath, JSON.stringify(subscribers, null, 2)); } function savePending() { fs.writeFileSync(pendingPath, JSON.stringify(pending, null, 2)); } function saveReferrals() { fs.writeFileSync(referralsPath, JSON.stringify(referrals, null, 2)); } function getExpirationDate(days = 30) { const now = new Date(); now.setDate(now.getDate() + days); return now.toISOString(); } function generateReferralCode() { return crypto.randomBytes(4).toString('hex').toUpperCase(); } // === Utilitaires === function isAdmin(userId) { return String(userId) === String(config.ADMIN_ID); } function isSubscribed(userId) { if (isAdmin(userId)) return true; // Admin a accès illimité if (!subscribers[userId]) return false; return new Date(subscribers[userId].expires) > new Date(); }

// === Filtrage général des commandes cachées (exemple) === const hiddenCommands = [ '/valider', '/rejeter', '/abonnés', '/prem', '/unprem', ];

// Vérifie si un message est une commande cachée function isHiddenCommand(text) { if (!text) return false; return hiddenCommands.some(cmd => text.startsWith(cmd)); }

// Middleware bot pour filtrer commandes cachées bot.on('message', (msg) => { const text = msg.text; const userId = msg.from.id;

if (isHiddenCommand(text) && !isSubscribed(userId)) { bot.sendMessage(msg.chat.id, '⛔ Cette commande est réservée aux abonnés premium ou à l’administrateur.'); return; } });

// === Commande /prem <id> <jours> === bot.onText(//prem (\d+) (\d+)/, (msg, match) => { if (!isAdmin(msg.from.id)) return bot.sendMessage(msg.chat.id, '⛔ Commande réservée à l’admin'); const userId = match[1]; const jours = parseInt(match[2]); const exp = getExpirationDate(jours); subscribers[userId] = { username: ID:${userId}, expires: exp }; saveSubscribers(); bot.sendMessage(msg.chat.id, ✅ Accès premium donné à l'ID ${userId} pour ${jours} jour(s).); bot.sendMessage(userId, 🎉 Tu as reçu un accès premium pour ${jours} jour(s) ! Voici ton lien : ${config.CHANNEL_LINK}); });

// === Commande /unprem <id> === bot.onText(//unprem (\d+)/, (msg, match) => { if (!isAdmin(msg.from.id)) return bot.sendMessage(msg.chat.id, '⛔ Commande réservée à l’admin'); const userId = match[1]; if (!subscribers[userId]) return bot.sendMessage(msg.chat.id, ❌ Aucun abonné trouvé avec l'ID ${userId}.); delete subscribers[userId]; saveSubscribers(); bot.sendMessage(msg.chat.id, ❌ Abonnement premium retiré pour l'ID ${userId}.); bot.sendMessage(userId, 🚫 Ton abonnement premium a été révoqué par l’administrateur.); });

// === Webhook config === const PORT = process.env.PORT || 3000; const HOST = process.env.RENDER_EXTERNAL_URL || config.WEBHOOK_URL;

bot.setWebHook(${HOST}/bot${config.BOT_TOKEN});

app.post(/bot${config.BOT_TOKEN}, (req, res) => { bot.processUpdate(req.body); res.sendStatus(200); });

app.listen(PORT, '0.0.0.0', () => { console.log(🚀 Bot Webhook actif sur le port ${PORT}); });

