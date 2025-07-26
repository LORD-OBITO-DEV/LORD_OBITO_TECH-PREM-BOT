// bot.js
import TelegramBot from 'node-telegram-bot-api';
import fs from 'fs';

const config = JSON.parse(fs.readFileSync('./config.json', 'utf8'));

const bot = new TelegramBot(config.BOT_TOKEN, { polling: true });
const subscribersPath = './subscribers.json';

let subscribers = fs.existsSync(subscribersPath)
  ? JSON.parse(fs.readFileSync(subscribersPath))
  : {};

function saveSubscribers() {
  fs.writeFileSync(subscribersPath, JSON.stringify(subscribers, null, 2));
}

function getExpirationDate() {
  const now = new Date();
  now.setDate(now.getDate() + 30);
  return now.toISOString();
}

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, `👋 Bienvenue, ${msg.from.first_name} !\n\nPour accéder à la chaîne privée, utilise la commande /abonnement.`);
});

bot.onText(/\/abonnement/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(
    chatId,
    `💳 Pour t'abonner, effectue un paiement de 2000 FCFA via PayPal à l'adresse suivante :\n\n👉 ${config.PAYPAL_LINK}\n\nAprès paiement, clique sur /acces`
  );
});

bot.onText(/\/acces/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  if (subscribers[userId]) {
    const expDate = new Date(subscribers[userId].expires);
    if (expDate > new Date()) {
      return bot.sendMessage(chatId, `✅ Tu as déjà accès. Voici le lien :\n${config.CHANNEL_LINK}`);
    }
  }

  subscribers[userId] = {
    username: msg.from.username || '',
    expires: getExpirationDate(),
  };
  saveSubscribers();

  try {
    await bot.sendMessage(chatId, `✅ Paiement confirmé ! Voici le lien d'accès :\n${config.CHANNEL_LINK}`);
  } catch (err) {
    console.error('Erreur lors de l\'ajout à la chaîne :', err.message);
    bot.sendMessage(chatId, '❌ Une erreur est survenue lors de l\'ajout à la chaîne. Contacte l\'admin.');
  }
});

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
        console.error(`Erreur de suppression de ${userId} :`, err.message);
      }
      delete subscribers[userId];
      changed = true;
    }
  }
  if (changed) saveSubscribers();
}, 3600000);
