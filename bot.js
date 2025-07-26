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

// === /start avec parrainage ===
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
    referrals[userId] = { code: generateReferralCode(), filleuls: [] };
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
║ ✞︎ /help — Liste des commandes
╚════════════════════════
© BY ✞︎ 𝙇𝙊𝙍𝘿 𝙊𝘽𝙄𝙏𝙊 𝘿𝙀𝙑 ✞
`;
  bot.sendPhoto(chatId, image, { caption: menu, parse_mode: "Markdown" });
});

// === /help ===
bot.onText(/\/help/, (msg) => {
  const text = `
📌 *Commandes disponibles* :

/start — Démarrer le bot
/abonnement — Voir les moyens de paiement
/status — Vérifier ton abonnement
/codepromo — Voir ton code promo
/mesfilleuls — Liste de tes filleuls
/promo — Ton lien de parrainage
/valider <id> — (admin) Valider un paiement
`;
  bot.sendMessage(msg.chat.id, text, { parse_mode: "Markdown" });
});

// === /codepromo ===
bot.onText(/\/codepromo/, (msg) => {
  const userId = msg.from.id;
  if (!referrals[userId]) {
    referrals[userId] = { code: generateReferralCode(), filleuls: [] };
    saveReferrals();
  }
  const code = referrals[userId].code;
  bot.sendMessage(msg.chat.id, `🎫 Ton code promo : *${code}*\nPartage-le avec /start ${code}`, { parse_mode: "Markdown" });
});

// === /promo ===
bot.onText(/\/promo/, (msg) => {
  const userId = msg.from.id;
  const username = msg.from.username || null;

  if (!referrals[userId]) {
    referrals[userId] = { code: generateReferralCode(), filleuls: [] };
    saveReferrals();
  }

  const code = referrals[userId].code;
  const startLink = username
    ? `https://t.me/${config.BOT_USERNAME}?start=${code}`
    : `Partage ton code avec /start ${code}`;

  const message = `🎁 Invite tes amis avec ce lien :\n${startLink}\n\n3 filleuls = 1 mois gratuit ! 🔥`;
  bot.sendMessage(msg.chat.id, message);
});

// === /mesfilleuls ===
bot.onText(/\/mesfilleuls/, (msg) => {
  const userId = msg.from.id;
  const data = referrals[userId];
  if (!data || !data.filleuls || data.filleuls.length === 0) {
    return bot.sendMessage(msg.chat.id, `😔 Tu n'as pas encore de filleuls.`);
  }
  const filleulsList = data.filleuls.map(id => `- ID: ${id}`).join('\n');
  bot.sendMessage(msg.chat.id, `👥 Tu as ${data.filleuls.length} filleuls :\n${filleulsList}`);
});

// === /abonnement ===
bot.onText(/\/abonnement/, (msg) => {
  const imageURL = 'https://files.catbox.moe/4m5nb4.jpg';
  const message = `
💳 *Abonnement Premium* — 1000 FCFA (~$1.65)

📎 Moyens de paiement :
• PayPal : /paypal
• Wave : /wave 🌊
• Orange Money : /om
• MTN Money : /mtn

✅ Clique sur /acces après paiement.
`;
  bot.sendPhoto(msg.chat.id, imageURL, { caption: message, parse_mode: "Markdown" });
});

// === Paiements avec images ===
bot.onText(/\/paypal/, (msg) => {
  const img = 'https://upload.wikimedia.org/wikipedia/commons/b/b5/PayPal.svg';
  const caption = `🔵 *Paiement via PayPal*\n💵 *Montant :* 1000 FCFA (~$1.65)\n🔗 *Lien :* ${config.PAYPAL_LINK}\n✅ Après paiement, clique sur /acces ou envoie une preuve avec /preuve.`;
  bot.sendPhoto(msg.chat.id, img, { caption, parse_mode: "Markdown" });
});

bot.onText(/\/wave/, (msg) => {
  const img = 'https://cdn.futura-sciences.com/buildsv6/images/largeoriginal/7/f/e/7fe6f53ab9_50171292_wave.jpg';
  const caption = `🌊 *Paiement via Wave*\n💵 *Montant :* 1000 FCFA\n📱 *Numéro :* ${config.WAVE_NUMBER}\n✅ Envoie une preuve ou clique sur /acces après paiement.`;
  bot.sendPhoto(msg.chat.id, img, { caption, parse_mode: "Markdown" });
});

bot.onText(/\/om/, (msg) => {
  const img = 'https://seeklogo.com/images/O/orange-money-logo-EF24E88B1E-seeklogo.com.png';
  const caption = `🟠 *Paiement via Orange Money*\n💵 *Montant :* 1000 FCFA\n📱 *Numéro :* ${config.OM_NUMBER}\n✅ Envoie une preuve ou clique sur /acces après paiement.`;
  bot.sendPhoto(msg.chat.id, img, { caption, parse_mode: "Markdown" });
});

bot.onText(/\/mtn/, (msg) => {
  const img = 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/8b/MTN_Logo.svg/1280px-MTN_Logo.svg.png';
  const caption = `💛 *Paiement via MTN Money*\n💵 *Montant :* 1000 FCFA\n📱 *Numéro :* ${config.MTN_NUMBER}\n✅ Envoie une preuve ou clique sur /acces après paiement.`;
  bot.sendPhoto(msg.chat.id, img, { caption, parse_mode: "Markdown" });
});

// === /acces ===
bot.onText(/\/acces/, (msg) => {
  const userId = msg.from.id;
  const username = msg.from.username || `ID:${userId}`;
  const chatId = msg.chat.id;

  if (subscribers[userId] && new Date(subscribers[userId].expires) > new Date()) {
    return bot.sendMessage(chatId, `✅ Tu as déjà accès :\n${config.CHANNEL_LINK}`);
  }

  pending[userId] = { username, chatId, requestedAt: new Date().toISOString() };
  savePending();

  bot.sendMessage(chatId, `📬 Demande envoyée. L’admin validera après vérification.`);
  if (config.ADMIN_ID) {
    bot.sendMessage(config.ADMIN_ID, `🔔 Demande : @${username} (ID: ${userId})\nValide avec /valider ${userId}`);
  }
});

// === /valider ===
bot.onText(/\/valider (\d+)/, (msg, match) => {
  if (String(msg.from.id) !== String(config.ADMIN_ID)) {
    return bot.sendMessage(msg.chat.id, '⛔ Commande réservée à l’admin');
  }

  const userId = match[1];
  const request = pending[userId];
  if (!request) return bot.sendMessage(msg.chat.id, `❌ Aucune demande pour cet ID.`);

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

// === /status ===
bot.onText(/\/status/, (msg) => {
  const userId = msg.from.id;
  const sub = subscribers[userId];
  if (sub && new Date(sub.expires) > new Date()) {
    return bot.sendMessage(msg.chat.id, `✅ Abonnement actif jusqu’au : *${new Date(sub.expires).toLocaleString()}*`, { parse_mode: 'Markdown' });
  } else {
    return bot.sendMessage(msg.chat.id, `❌ Ton abonnement est expiré ou non activé.`);
  }
});

// === Auto-clean abonnés expirés chaque heure ===
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

// === Webhook config ===
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
