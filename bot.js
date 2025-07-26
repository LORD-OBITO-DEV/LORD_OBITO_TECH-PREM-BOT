import TelegramBot from 'node-telegram-bot-api';
import express from 'express';
import fs from 'fs';
import crypto from 'crypto';

const config = JSON.parse(fs.readFileSync('./config.json', 'utf8'));
const bot = new TelegramBot(config.BOT_TOKEN, { webHook: true });

const app = express();
app.use(express.json());

const subscribersPath = './subscribers.json';
const pendingPath = './pending.json';
const referralsPath = './referrals.json';

let subscribers = fs.existsSync(subscribersPath) ? JSON.parse(fs.readFileSync(subscribersPath)) : {};
let pending = fs.existsSync(pendingPath) ? JSON.parse(fs.readFileSync(pendingPath)) : {};
let referrals = fs.existsSync(referralsPath) ? JSON.parse(fs.readFileSync(referralsPath)) : {};

function saveSubscribers() {
  fs.writeFileSync(subscribersPath, JSON.stringify(subscribers, null, 2));
}
function savePending() {
  fs.writeFileSync(pendingPath, JSON.stringify(pending, null, 2));
}
function saveReferrals() {
  fs.writeFileSync(referralsPath, JSON.stringify(referrals, null, 2));
}

function getExpirationDate(days = 30) {
  const now = new Date();
  now.setDate(now.getDate() + days);
  return now.toISOString();
}

function generateReferralCode() {
  return crypto.randomBytes(4).toString('hex').toUpperCase();
}

// /start avec gestion code parrainage
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
        referrals[parrainId] = parrainData;
        saveReferrals();
      }
    }
  }

  if (!referrals[userId]) {
    referrals[userId] = {
      code: generateReferralCode(),
      filleuls: []
    };
    saveReferrals();
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
╚════════════════════════
© BY ✞︎ 𝙇𝙊𝙍𝘿 𝙊𝘽𝙄𝙏𝙊 𝘿𝙀𝙑 ✞
`;
  bot.sendPhoto(chatId, image, { caption: menu, parse_mode: "Markdown" });
});

bot.onText(/\/codepromo/, (msg) => {
  const userId = msg.from.id;
  if (!referrals[userId]) {
    referrals[userId] = { code: generateReferralCode(), filleuls: [] };
    saveReferrals();
  }
  const code = referrals[userId].code;
  bot.sendMessage(msg.chat.id, `🎫 Ton code promo : *${code}*\nPartage-le avec /start ${code}`, { parse_mode: "Markdown" });
});

bot.onText(/\/mesfilleuls/, (msg) => {
  const userId = msg.from.id;
  const data = referrals[userId];
  if (!data || !data.filleuls || data.filleuls.length === 0) {
    return bot.sendMessage(msg.chat.id, `😔 Tu n'as pas encore de filleuls.`);
  }
  const filleulsList = data.filleuls.map(id => `- ID: ${id}`).join('\n');
  bot.sendMessage(msg.chat.id, `👥 Tu as ${data.filleuls.length} filleuls :\n${filleulsList}`);
});

bot.onText(/\/abonnement/, (msg) => {
  const imageURL = 'https://files.catbox.moe/4m5nb4.jpg';
  const message = `
╔════════════════════
║—͟͟͞͞➸⃝ABONNEMENT⍣⃝💳
╠════════════════════
║ 💰 Montant : 2000 FCFA (~$3.30)
║ 
║ 📎 Moyens de paiement :
║ • PayPal : /paypal
║ • Wave : /wave 🌊
║ • Orange Money : /om
║ • MTN Money : /mtn
╚════════════════════════

Clique sur /acces après paiement 💼

© BY ✞︎ 𝙇𝙊𝙍𝘿 𝙊𝘽𝙄𝙏𝙊 𝘿𝙀𝙑 ✞
`;
  bot.sendPhoto(msg.chat.id, imageURL, { caption: message, parse_mode: "Markdown" });
});

bot.onText(/\/paypal/, (msg) => {
  const text = `🔵 *Paiement par PayPal*\n\n👉 ${config.PAYPAL_LINK}\n💵 Montant : 2000 FCFA (~$3.30)\n\n✅ Clique ensuite sur /acces pour valider.`;
  bot.sendPhoto(msg.chat.id, 'https://i.imgur.com/GPiFxEz.png', { caption: text, parse_mode: "Markdown" });
});

bot.onText(/\/wave/, (msg) => {
  const message = `🌊 *Paiement par Wave*\n\n📱 Numéro : ${config.WAVE_NUMBER}\n💵 Montant : 2000 FCFA (~$3.30)`;
  bot.sendPhoto(msg.chat.id, 'https://i.imgur.com/MZEKPVP.jpeg', {
    caption: message,
    parse_mode: "Markdown",
    reply_markup: {
      inline_keyboard: [[{ text: "✅ J’ai payé (Wave)", callback_data: "demander_acces" }]]
    }
  });
});

bot.onText(/\/om/, (msg) => {
  const message = `🟠 *Paiement par Orange Money*\n\n📱 Numéro : ${config.OM_NUMBER}\n💵 Montant : 2000 FCFA (~$3.30)`;
  bot.sendPhoto(msg.chat.id, 'https://i.imgur.com/zQjVl38.jpeg', {
    caption: message,
    parse_mode: "Markdown",
    reply_markup: {
      inline_keyboard: [[{ text: "✅ J’ai payé (OM)", callback_data: "demander_acces" }]]
    }
  });
});

bot.onText(/\/mtn/, (msg) => {
  const message = `💛 *Paiement par MTN Money*\n\n📱 Numéro : ${config.MTN_NUMBER}\n💵 Montant : 2000 FCFA (~$3.30)`;
  bot.sendPhoto(msg.chat.id, 'https://i.imgur.com/bcs0ZtF.jpeg', {
    caption: message,
    parse_mode: "Markdown",
    reply_markup: {
      inline_keyboard: [[{ text: "✅ J’ai payé (MTN)", callback_data: "demander_acces" }]]
    }
  });
});

bot.on("callback_query", (query) => {
  if (query.data === "demander_acces") {
    bot.sendMessage(query.message.chat.id, "🔄 Redirection vers /acces...");
    bot.emit("message", { text: "/acces", chat: { id: query.message.chat.id }, from: query.from });
  }
});

bot.onText(/\/acces/, (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const username = msg.from.username || `ID:${userId}`;

  if (subscribers[userId] && new Date(subscribers[userId].expires) > new Date()) {
    return bot.sendMessage(chatId, `✅ Tu as déjà accès :\n${config.CHANNEL_LINK}`);
  }

  pending[userId] = { username, chatId, requestedAt: new Date().toISOString() };
  savePending();

  bot.sendMessage(chatId, `📬 Demande envoyée. L'admin validera après vérification.`);

  if (config.ADMIN_ID) {
    bot.sendMessage(config.ADMIN_ID, `🔔 Demande d’accès : @${username} (ID: ${userId})\nValide avec /valider ${userId}`);
  }
});

bot.onText(/\/valider (\d+)/, (msg, match) => {
  if (String(msg.from.id) !== String(config.ADMIN_ID)) {
    return bot.sendMessage(msg.chat.id, '⛔ Réservé à l’admin');
  }

  const userId = match[1];
  const request = pending[userId];
  if (!request) return bot.sendMessage(msg.chat.id, `❌ Aucun utilisateur avec ID ${userId}`);

  let bonus = 0;
  if (referrals[userId] && referrals[userId].filleuls.length >= 3) bonus = 30;

  const exp = getExpirationDate(30 + bonus);
  subscribers[userId] = { username: request.username, expires: exp };
  saveSubscribers();
  delete pending[userId];
  savePending();

  bot.sendMessage(request.chatId, `✅ Paiement confirmé ! Voici ton lien :\n${config.CHANNEL_LINK}`);
  bot.sendMessage(msg.chat.id, `✅ Validé pour @${request.username}`);
});

bot.onText(/\/status/, (msg) => {
  const userId = msg.from.id;
  if (subscribers[userId] && new Date(subscribers[userId].expires) > new Date()) {
    bot.sendMessage(msg.chat.id, `✅ Accès actif jusqu’au : *${new Date(subscribers[userId].expires).toLocaleString()}*`, { parse_mode: 'Markdown' });
  } else {
    bot.sendMessage(msg.chat.id, '❌ Ton abonnement a expiré ou n’a pas encore été validé.');
  }
});

// Vérifie les abonnements toutes les heures
setInterval(() => {
  const now = new Date();
  let changed = false;
  for (const userId in subscribers) {
    if (new Date(subscribers[userId].expires) < now) {
      delete subscribers[userId];
      changed = true;
    }
  }
  if (changed) saveSubscribers();
}, 3600000);

// Webhook
const PORT = process.env.PORT || 3000;
const HOST = process.env.RENDER_EXTERNAL_URL || config.WEBHOOK_URL;

bot.setWebHook(`${HOST}/bot${config.BOT_TOKEN}`);

app.post(`/bot${config.BOT_TOKEN}`, (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Bot Webhook en écoute sur le port ${PORT}`);
});
