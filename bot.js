import TelegramBot from 'node-telegram-bot-api';
import express from 'express';
import fs from 'fs';

const config = JSON.parse(fs.readFileSync('./config.json', 'utf8'));
const bot = new TelegramBot(config.BOT_TOKEN, { webHook: true });

const app = express();
app.use(express.json());

// === fichiers JSON ===
const subscribersPath = './subscribers.json';
const pendingPath = './pending.json';

let subscribers = fs.existsSync(subscribersPath) ? JSON.parse(fs.readFileSync(subscribersPath)) : {};
let pending = fs.existsSync(pendingPath) ? JSON.parse(fs.readFileSync(pendingPath)) : {};

function saveSubscribers() {
  fs.writeFileSync(subscribersPath, JSON.stringify(subscribers, null, 2));
}
function savePending() {
  fs.writeFileSync(pendingPath, JSON.stringify(pending, null, 2));
}
function getExpirationDate() {
  const now = new Date();
  now.setDate(now.getDate() + 30);
  return now.toISOString();
}

// === commandes Telegram ===
bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id, `👋 Bienvenue ${msg.from.first_name} !\n\nUtilise /abonnement pour t'abonner.`);
});

bot.onText(/\/abonnement/, (msg) => {
  bot.sendMessage(msg.chat.id, `💳 Pour t'abonner, envoie 2000 FCFA (~$3.30) via PayPal :\n👉 ${config.PAYPAL_LINK}\n\nOu utilise /wave pour payer via Wave.\n\nClique sur /acces après paiement.`);
});

bot.onText(/\/wave/, (msg) => {
  const message = `🌊 Paiement par Wave\n\n📱 Numéro : ${config.WAVE_NUMBER}\n💵 Montant : 2000 FCFA (~$3.30)\n\nClique ci-dessous quand c’est fait.`;
  bot.sendMessage(msg.chat.id, message, {
    reply_markup: {
      inline_keyboard: [[{ text: "✅ J’ai payé", callback_data: "demander_acces" }]]
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

  pending[userId] = {
    username,
    chatId,
    requestedAt: new Date().toISOString(),
  };
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

  const exp = getExpirationDate();
  subscribers[userId] = { username: request.username, expires: exp };
  saveSubscribers();
  delete pending[userId];
  savePending();

  bot.sendMessage(request.chatId, `✅ Paiement confirmé ! Voici ton lien :\n${config.CHANNEL_LINK}`);
  bot.sendMessage(msg.chat.id, `✅ Validé pour @${request.username}`);
});

// Nettoyage auto des expirés
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

// === Webhook Express ===
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
