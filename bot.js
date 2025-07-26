import TelegramBot from 'node-telegram-bot-api';
import express from 'express';
import fs from 'fs';

const config = JSON.parse(fs.readFileSync('./config.json', 'utf8'));
const bot = new TelegramBot(config.BOT_TOKEN, { webHook: true });

const app = express();
app.use(express.json());

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

// === Commandes utilisateurs ===

bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id, `👋 Bienvenue ${msg.from.first_name} !\n\nUtilise la commande /abonnement pour voir les moyens de paiement.`);
});

bot.onText(/\/abonnement/, (msg) => {
  bot.sendMessage(msg.chat.id, `💳 *Abonnement*\n\nTu peux payer via :\n\n🔵 /paypal\n🌊 /wave\n🟠 /om\n💛 /mtn\n\nClique ensuite sur /acces pour demander l’accès.`, { parse_mode: "Markdown" });
});

bot.onText(/\/paypal/, (msg) => {
  const text = `🔵 *Paiement par PayPal*\n\nLien :\n👉 ${config.PAYPAL_LINK}\n💵 Montant : 2000 FCFA (~$3.30)\n\nClique ensuite sur /acces pour valider.`;
  bot.sendPhoto(msg.chat.id, 'https://i.imgur.com/GPiFxEz.png', { caption: text, parse_mode: "Markdown" });
});

bot.onText(/\/wave/, (msg) => {
  const message = `🌊 *Paiement par Wave*\n\n📱 Numéro : ${config.WAVE_NUMBER}\n💵 Montant : 2000 FCFA (~$3.30)\n\nClique ci-dessous quand c’est fait.`;
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

bot.onText(/\/status/, (msg) => {
  const userId = msg.from.id;
  const sub = subscribers[userId];
  if (sub) {
    bot.sendMessage(msg.chat.id, `📆 Ton abonnement expire le : *${new Date(sub.expires).toLocaleDateString()}*`, { parse_mode: "Markdown" });
  } else {
    bot.sendMessage(msg.chat.id, `❌ Tu n'es pas encore abonné.`);
  }
});

bot.onText(/\/promo/, (msg) => {
  bot.sendPhoto(msg.chat.id, 'https://i.imgur.com/7zwp4mc.jpeg', {
    caption: `🎁 *Promo Parrainage !*\n\nInvite tes amis et gagne 1 mois gratuit !\nEnvoie ce lien : https://t.me/${config.BOT_USERNAME}\n\nPlus d’amis = plus de bonus 🎉`,
    parse_mode: "Markdown"
  });
});

// Nettoyage des expirés
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

// Webhook Express
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
