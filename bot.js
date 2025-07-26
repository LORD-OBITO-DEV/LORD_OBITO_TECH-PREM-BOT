import TelegramBot from 'node-telegram-bot-api';
import fs from 'fs';

const config = JSON.parse(fs.readFileSync('./config.json', 'utf8'));
const bot = new TelegramBot(config.BOT_TOKEN, { polling: true });
const subscribersPath = './subscribers.json';
const pendingRequestsPath = './pending.json';

let subscribers = fs.existsSync(subscribersPath)
  ? JSON.parse(fs.readFileSync(subscribersPath))
  : {};

let pending = fs.existsSync(pendingRequestsPath)
  ? JSON.parse(fs.readFileSync(pendingRequestsPath))
  : {};

function saveSubscribers() {
  fs.writeFileSync(subscribersPath, JSON.stringify(subscribers, null, 2));
}

function savePending() {
  fs.writeFileSync(pendingRequestsPath, JSON.stringify(pending, null, 2));
}

function getExpirationDate() {
  const now = new Date();
  now.setDate(now.getDate() + 30);
  return now.toISOString();
}

// Commande /start
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, `👋 Bienvenue, ${msg.from.first_name} !\n\nPour accéder à la chaîne privée, utilise la commande /abonnement.`);
});

// Commande /abonnement
bot.onText(/\/abonnement/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(
    chatId,
    `💳 Pour t'abonner, effectue un paiement de 2000 FCFA (~$3.30) via PayPal :\n\n👉 ${config.PAYPAL_LINK}\n\nEnsuite, clique sur /acces pour demander l'accès.`
  );
});

// Commande /acces
bot.onText(/\/acces/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const username = msg.from.username || `ID:${userId}`;

  if (subscribers[userId]) {
    const expDate = new Date(subscribers[userId].expires);
    if (expDate > new Date()) {
      return bot.sendMessage(chatId, `✅ Tu as déjà accès. Voici le lien :\n${config.CHANNEL_LINK}`);
    }
  }

  pending[userId] = {
    username,
    chatId,
    requestedAt: new Date().toISOString(),
  };
  savePending();

  bot.sendMessage(chatId, `📬 Demande d'accès envoyée. L'admin va vérifier ton paiement.`);

  if (config.ADMIN_ID) {
    bot.sendMessage(config.ADMIN_ID, `🔔 Demande d'accès de @${username} (ID: ${userId})\nTape : /valider ${userId} pour valider.`);
  }
});

// Commande /valider
bot.onText(/\/valider (\d+)/, async (msg, match) => {
  const adminId = msg.from.id;
  if (config.ADMIN_ID && String(adminId) !== String(config.ADMIN_ID)) {
    return bot.sendMessage(msg.chat.id, '⛔ Commande réservée à l’admin.');
  }

  const userId = match[1];
  const request = pending[userId];

  if (!request) {
    return bot.sendMessage(msg.chat.id, `❌ Aucun utilisateur en attente avec l'ID ${userId}.`);
  }

  const expDate = getExpirationDate();
  subscribers[userId] = {
    username: request.username,
    expires: expDate,
  };
  saveSubscribers();
  delete pending[userId];
  savePending();

  bot.sendMessage(request.chatId, `✅ Paiement confirmé ! Voici ton lien d'accès :\n${config.CHANNEL_LINK}`);
  bot.sendMessage(msg.chat.id, `✅ Utilisateur @${request.username} validé jusqu'au ${expDate}.`);
});

// Auto-clean des abonnés expirés
setInterval(async () => {
  const now = new Date();
  let changed = false;

  for (const userId in subscribers) {
    const exp = new Date(subscribers[userId].expires);
    if (exp < now) {
      try {
        await bot.banChatMember(config.CHANNEL_LINK, Number(userId));
        await bot.unbanChatMember(config.CHANNEL_LINK, Number(userId));
        console.log(`🚫 Utilisateur ${userId} retiré de la chaîne`);
      } catch (err) {
        console.error(`Erreur suppression ${userId} :`, err.message);
      }
      delete subscribers[userId];
      changed = true;
    }
  }

  if (changed) saveSubscribers();
}, 3600000);
