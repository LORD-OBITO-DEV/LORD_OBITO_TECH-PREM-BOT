import TelegramBot from 'node-telegram-bot-api';
import TelegramBot from 'node-telegram-bot-api';
import express from 'express';
import fs from 'fs';
import crypto from 'crypto';

const config = JSON.parse(fs.readFileSync('./config.json', 'utf8'));
const bot = new TelegramBot(config.BOT_TOKEN, { webHook: true });
const app = express();
app.use(express.json());

// === Fichiers JSON ===
const subscribersPath = './subscribers.json';
const pendingPath = './pending.json';
const referralsPath = './referrals.json';

let subscribers = fs.existsSync(subscribersPath) ? JSON.parse(fs.readFileSync(subscribersPath)) : {};
let pending = fs.existsSync(pendingPath) ? JSON.parse(fs.readFileSync(pendingPath)) : {};
let referrals = fs.existsSync(referralsPath) ? JSON.parse(fs.readFileSync(referralsPath)) : {};

// === Fonctions utiles ===
function save(obj, path) {
  fs.writeFileSync(path, JSON.stringify(obj, null, 2));
}
function getExpirationDate(days = 30) {
  const now = new Date();
  now.setDate(now.getDate() + days);
  return now.toISOString();
}
function generateReferralCode() {
  return crypto.randomBytes(4).toString('hex').toUpperCase();
}

// === Commande /start ===
bot.onText(/\/start(?: (.+))?/, (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const refCode = match ? match[1] : null;

  if (refCode) {
    const parrains = Object.entries(referrals).filter(([uid, data]) => data.code === refCode);
    if (parrains.length > 0) {
      const [parrainId, parrainData] = parrains[0];
      if (!parrainData.filleuls) parrainData.filleuls = [];
      if (!parrainData.filleuls.includes(String(userId)) && userId !== Number(parrainId)) {
        parrainData.filleuls.push(String(userId));
        save(referrals, referralsPath);
      }
    }
  }

  if (!referrals[userId]) {
    referrals[userId] = { code: generateReferralCode(), filleuls: [] };
    save(referrals, referralsPath);
  }

  const image = 'https://files.catbox.moe/dsmhrq.jpg';
  const menu = `
╔════════════════════
║—͟͟͞͞➸⃝LORD_OBITO_TECH_PREM_BOT⍣⃝💀
╠════════════════════
║ ✞︎ /abonnement — Voir les moyens de paiement
║ ✞︎ /status — Vérifier ton abonnement
║ ✞︎ /promo — Gagne 1 mois gratuit
║ ✞︎ /codepromo — Ton code personnel
║ ✞︎ /mesfilleuls — Voir tes filleuls
║ ✞︎ /help — Liste des commandes
╚════════════════════════
© BY ✞︎ 𝙇𝙊𝙍𝘿 𝙊𝘽𝙄𝙏𝙊 𝘿𝙀𝙑 ✞
`;

  bot.sendPhoto(chatId, image, {
    caption: menu,
    parse_mode: "Markdown",
    reply_markup: {
      inline_keyboard: [
        [
          { text: "📦 Abonnement", callback_data: "abonnement" },
          { text: "🎁 Code Promo", callback_data: "codepromo" }
        ],
        [
          { text: "👤 Status", callback_data: "status" },
          { text: "👥 Mes filleuls", callback_data: "mesfilleuls" }
        ],
        [
          { text: "📣 Parrainer (bonus)", callback_data: "promo" }
        ]
      ]
    }
  });
});

// === Boutons de raccourcis ===
bot.on("callback_query", (query) => {
  const data = query.data;
  const id = query.message.chat.id;

  if (data === "abonnement") bot.emit("message", { chat: { id }, from: query.from, text: "/abonnement" });
  if (data === "codepromo") bot.emit("message", { chat: { id }, from: query.from, text: "/codepromo" });
  if (data === "promo") bot.emit("message", { chat: { id }, from: query.from, text: "/promo" });
  if (data === "status") bot.emit("message", { chat: { id }, from: query.from, text: "/status" });
  if (data === "mesfilleuls") bot.emit("message", { chat: { id }, from: query.from, text: "/mesfilleuls" });
});

// === Commandes restantes ===
bot.onText(/\/help/, msg => {
  bot.sendMessage(msg.chat.id, `
📌 *Commandes* :
/abonnement — Moyens de paiement
/status — Ton abonnement
/codepromo — Code personnel
/mesfilleuls — Tes filleuls
/promo — Ton lien d'invitation
/valider <id> — Admin uniquement
`, { parse_mode: "Markdown" });
});

bot.onText(/\/abonnement/, msg => {
  const image = 'https://files.catbox.moe/4m5nb4.jpg';
  const message = `
💳 *Abonnement Premium* — 1000 FCFA (~$1.65)

📎 Moyens :
• PayPal : /paypal
• Wave : /wave
• Orange Money : /om
• MTN : /mtn

✅ Clique sur /acces après paiement.`;

  bot.sendPhoto(msg.chat.id, image, { caption: message, parse_mode: "Markdown" });
});

bot.onText(/\/paypal/, msg => bot.sendMessage(msg.chat.id, `🔵 *PayPal*\n👉 ${config.PAYPAL_LINK}\n💵 1000 FCFA\nClique /acces après paiement.`, { parse_mode: "Markdown" }));
bot.onText(/\/wave/, msg => bot.sendMessage(msg.chat.id, `🌊 *Wave*\n📱 ${config.WAVE_NUMBER}\n💵 1000 FCFA\nClique /acces après paiement.`, { parse_mode: "Markdown" }));
bot.onText(/\/om/, msg => bot.sendMessage(msg.chat.id, `🟠 *Orange Money*\n📱 ${config.OM_NUMBER}\n💵 1000 FCFA\nClique /acces après paiement.`, { parse_mode: "Markdown" }));
bot.onText(/\/mtn/, msg => bot.sendMessage(msg.chat.id, `💛 *MTN*\n📱 ${config.MTN_NUMBER}\n💵 1000 FCFA\nClique /acces après paiement.`, { parse_mode: "Markdown" }));

bot.onText(/\/codepromo/, msg => {
  const id = msg.from.id;
  if (!referrals[id]) referrals[id] = { code: generateReferralCode(), filleuls: [] }, save(referrals, referralsPath);
  bot.sendMessage(msg.chat.id, `🎫 Ton code promo : *${referrals[id].code}*\n/start ${referrals[id].code}`, { parse_mode: "Markdown" });
});

bot.onText(/\/promo/, msg => {
  const id = msg.from.id;
  const username = msg.from.username;
  if (!referrals[id]) referrals[id] = { code: generateReferralCode(), filleuls: [] }, save(referrals, referralsPath);
  const code = referrals[id].code;
  const link = username ? `https://t.me/${config.BOT_USERNAME}?start=${code}` : `/start ${code}`;
  bot.sendMessage(msg.chat.id, `🎁 Invite avec ce lien :\n${link}\n\n3 filleuls = 1 mois gratuit !`);
});

bot.onText(/\/mesfilleuls/, msg => {
  const id = msg.from.id;
  const data = referrals[id];
  if (!data || !data.filleuls?.length) return bot.sendMessage(msg.chat.id, `😔 Aucun filleul.`);
  bot.sendMessage(msg.chat.id, `👥 Tu as ${data.filleuls.length} filleuls :\n${data.filleuls.map(i => `- ${i}`).join('\n')}`);
});

bot.onText(/\/acces/, msg => {
  const id = msg.from.id;
  const username = msg.from.username || `ID:${id}`;
  const chatId = msg.chat.id;

  if (subscribers[id] && new Date(subscribers[id].expires) > new Date()) {
    return bot.sendMessage(chatId, `✅ Tu as déjà accès :\n${config.CHANNEL_LINK}`);
  }

  pending[id] = { username, chatId, requestedAt: new Date().toISOString() };
  save(pending, pendingPath);

  bot.sendMessage(chatId, `📬 Demande envoyée. L’admin validera après vérification.\n\n📝 Merci d'envoyer maintenant :\n- Le *nom du compte utilisé*\n- Le *numéro de paiement*`);
  if (config.ADMIN_ID) {
    bot.sendMessage(config.ADMIN_ID, `🔔 Demande : @${username} (ID: ${id})\nValide avec /valider ${id}`);
  }
});

bot.onText(/\/valider (\d+)/, (msg, match) => {
  if (String(msg.from.id) !== String(config.ADMIN_ID)) return bot.sendMessage(msg.chat.id, '⛔ Admin uniquement');
  const id = match[1];
  const req = pending[id];
  if (!req) return bot.sendMessage(msg.chat.id, `❌ Aucune demande pour cet ID.`);
  const bonus = referrals[id]?.filleuls?.length >= 3 ? 30 : 0;
  const exp = getExpirationDate(30 + bonus);
  subscribers[id] = { username: req.username, expires: exp };
  save(subscribers, subscribersPath);
  delete pending[id];
  save(pending, pendingPath);
  bot.sendMessage(req.chatId, `✅ Paiement confirmé ! Voici ton lien :\n${config.CHANNEL_LINK}`);
  bot.sendMessage(msg.chat.id, `✅ Validé pour @${req.username}`);
});

bot.onText(/\/status/, msg => {
  const id = msg.from.id;
  const sub = subscribers[id];
  if (sub && new Date(sub.expires) > new Date()) {
    bot.sendMessage(msg.chat.id, `✅ Abonnement actif jusqu’au : *${new Date(sub.expires).toLocaleString()}*`, { parse_mode: 'Markdown' });
  } else {
    bot.sendMessage(msg.chat.id, `❌ Ton abonnement est expiré ou non activé.`);
  }
});

// === Nettoyage automatique ===
setInterval(() => {
  const now = new Date();
  let changed = false;
  for (const id in subscribers) {
    if (new Date(subscribers[id].expires) < now) {
      delete subscribers[id];
      changed = true;
    }
  }
  if (changed) save(subscribers, subscribersPath);
}, 3600000);

// === Webhook ===
const PORT = process.env.PORT || 3000;
const HOST = process.env.RENDER_EXTERNAL_URL || config.WEBHOOK_URL;
bot.setWebHook(`${HOST}/bot${config.BOT_TOKEN}`);
app.post(`/bot${config.BOT_TOKEN}`, (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Bot Webhook actif sur le port ${PORT}`);
});
