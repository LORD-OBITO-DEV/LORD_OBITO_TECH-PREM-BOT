import TelegramBot from 'node-telegram-bot-api';
import express from 'express';
import fs from 'fs';
import crypto from 'crypto';
import archiver from 'archiver';
import path from 'path';
import mongoose from 'mongoose';
const mongoUri = config.MONGO_URI;

mongoose.connect(mongoUri, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('✅ Connecté à MongoDB Atlas');
}).catch(err => {
  console.error('❌ Erreur de connexion MongoDB:', err);
});

const config = JSON.parse(fs.readFileSync('./config.json', 'utf8'));

// ✅ Fonction manquante ajoutée ici
function isAdmin(userId) {
  return String(userId) === String(config.ADMIN_ID);
}

const bot = new TelegramBot(config.BOT_TOKEN, { webHook: true });

const app = express();
app.use(express.json());

// === Fichiers JSON ===
const subscriberSchema = new mongoose.Schema({
  userId: String,
  username: String,
  expires: Date
});
const Subscriber = mongoose.model('Subscriber', subscriberSchema);

const referralSchema = new mongoose.Schema({
  userId: String,
  username: String,
  code: String,
  filleuls: [String]
});
const Referral = mongoose.model('Referral', referralSchema);

const pendingSchema = new mongoose.Schema({
  userId: String,
  username: String,
  chatId: Number,
  proof: String,
  requestedAt: Date
});
const Pending = mongoose.model('Pending', pendingSchema);

const whitelistSchema = new mongoose.Schema({
  userId: String
});
const Whitelist = mongoose.model('Whitelist', whitelistSchema);

// === Fonctions sauvegarde ===
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

// === Commande /start avec parrainage ===
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

        // Bonus 1 mois si 3 filleuls atteints
        if (parrainData.filleuls.length === 3) {
          let exp = new Date();
          if (subscribers[parrainId] && new Date(subscribers[parrainId].expires) > new Date()) {
            exp = new Date(subscribers[parrainId].expires);
          }
          exp.setDate(exp.getDate() + 30);
          subscribers[parrainId] = {
            username: parrainData.username || `ID:${parrainId}`,
            expires: exp.toISOString()
          };
          saveSubscribers();

          bot.sendMessage(parrainId, `🔥 Bravo ! Tu as 3 filleuls. Ton abonnement premium est prolongé de 1 mois automatiquement !`);
        }
      }
    }
  }

  if (!referrals[userId]) {
    referrals[userId] = { code: generateReferralCode(), filleuls: [] };
    referrals[userId].username = msg.from.username || `ID:${userId}`;
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
/preuve <texte> — Envoyer une preuve de paiement

👑 Commandes administrateur 👑 :
/valider <id> — Valider un paiement
/rejeter <id> <raison> — Rejeter une demande d'accès
/prem <id> — Donner un abonnement premium
/unprem <id> — Révoquer un abonnement premium
/abonnes — Voir la liste des abonnés
/backup — Télécharger une sauvegarde .zip
/whitelist <id> — ajouter un utilisateur premium à vie
/unwhitelist <id> — Retire un utilisateur de la whitelist
/whitelist_liste — Voir la whitelist actuelle
`;
  bot.sendMessage(msg.chat.id, text, { parse_mode: "Markdown" });
});

// === /codepromo ===
bot.onText(/\/codepromo/, (msg) => {
  const userId = msg.from.id;
  if (!referrals[userId]) {
    referrals[userId] = { code: generateReferralCode(), filleuls: [] };
    referrals[userId].username = msg.from.username || `ID:${userId}`;
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
    referrals[userId].username = msg.from.username || `ID:${userId}`;
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
  if (isAdmin(msg.from.id)) {
    return bot.sendMessage(msg.chat.id, '👑 En tant qu’admin, tu n’as pas besoin de payer. Accès illimité activé.');
  }

  const imageURL = 'https://files.catbox.moe/4m5nb4.jpg';
  const message = `
💳 *Abonnement Premium* — 1000 FCFA (~$1.65)

📎 Moyens de paiement :
• PayPal : /paypal
• Wave : /wave 🌊
• Orange Money : /om
• MTN Money : /mtn

✅ Clique sur /acces après paiement.`;
  bot.sendPhoto(msg.chat.id, imageURL, { caption: message, parse_mode: "Markdown" });
});

// Moyens de paiement
bot.onText(/\/paypal/, (msg) => {
  const text = `🔵 *Paiement PayPal*\n👉 ${config.PAYPAL_LINK}\n💵 1000 FCFA (~$1.65)\nClique /acces après paiement.`;
  bot.sendMessage(msg.chat.id, text, { parse_mode: "Markdown" });
});
bot.onText(/\/wave/, (msg) => {
  const text = `🌊 *Wave*\n📱 ${config.WAVE_NUMBER}\n💵 1000 FCFA\nClique /acces après paiement.`;
  bot.sendMessage(msg.chat.id, text, { parse_mode: "Markdown" });
});
bot.onText(/\/om/, (msg) => {
  const text = `🟠 *Orange Money*\n📱 ${config.OM_NUMBER}\n💵 1000 FCFA\nClique /acces après paiement.`;
  bot.sendMessage(msg.chat.id, text, { parse_mode: "Markdown" });
});
bot.onText(/\/mtn/, (msg) => {
  const text = `💛 *MTN Money*\n📱 ${config.MTN_NUMBER}\n💵 1000 FCFA\nClique /acces après paiement.`;
  bot.sendMessage(msg.chat.id, text, { parse_mode: "Markdown" });
});

// === /preuve ===
bot.onText(/\/preuve (.+)/, (msg, match) => {
  const userId = msg.from.id;
  const proofText = match[1];
  const username = msg.from.username || `ID:${userId}`;
  const chatId = msg.chat.id;

  if (isAdmin(userId)) {
    return bot.sendMessage(chatId, `👑 Tu es admin, inutile d’envoyer une preuve.`);
  }

  if (!proofText) {
    return bot.sendMessage(chatId, '❌ Veuillez envoyer une preuve valide après la commande, exemple: /preuve capture écran, reçu, etc.');
  }

  pending[userId] = { username, chatId, proof: proofText, requestedAt: new Date().toISOString() };
  savePending();

  bot.sendMessage(chatId, `📬 Preuve reçue, l’admin vérifiera et validera la demande.`);
  if (config.ADMIN_ID) {
    bot.sendMessage(config.ADMIN_ID, `🔔 Nouvelle preuve de paiement de @${username} (ID: ${userId}) :\n${proofText}\nValide avec /valider ${userId}`);
  }
});

// === /backup (réservé à l’admin) ===
bot.onText(/\/backup/, (msg) => {
  const userId = msg.from.id;

  if (!isAdmin(userId)) {
    return bot.sendMessage(msg.chat.id, '⛔ Commande réservée à l’administrateur.');
  }

  const zipPath = './backup.zip';
  const output = fs.createWriteStream(zipPath);
  const archive = archiver('zip', { zlib: { level: 9 } });

  output.on('close', () => {
    bot.sendDocument(msg.chat.id, zipPath, {}, {
      filename: 'backup-premium-bot.zip',
      contentType: 'application/zip'
    }).then(() => fs.unlinkSync(zipPath)); // Supprime le zip après envoi
  });

  archive.on('error', err => {
    console.error(err);
    bot.sendMessage(msg.chat.id, '❌ Erreur lors de la création du fichier de sauvegarde.');
  });

  archive.pipe(output);
  archive.file(path.resolve('./data/subscribers.json'), { name: 'subscribers.json' });
  archive.file(path.resolve('./data/referrals.json'), { name: 'referrals.json' });
  archive.file(path.resolve('./data/pending.json'), { name: 'pending.json' });
  archive.file(path.resolve('./data/whitelist.json'), { name: 'whitelist.json' });
  archive.finalize();
});

// === /acces ===
bot.onText(/\/acces/, (msg) => {
  const userId = msg.from.id;
  const chatId = msg.chat.id;

  if (isAdmin(userId)) {
    return bot.sendMessage(chatId, `✅ Accès illimité administrateur :\n${config.CHANNEL_LINK}`);
  }

  if (subscribers[userId] && new Date(subscribers[userId].expires) > new Date()) {
    return bot.sendMessage(chatId, `✅ Tu as déjà accès :\n${config.CHANNEL_LINK}`);
  }

  bot.sendMessage(chatId, `❌ Ton abonnement est expiré ou non activé.\nMerci de payer 1000 FCFA via /abonnement.\nEnvoie ta preuve avec /preuve`);
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
  if (referrals[userId] && referrals[userId].filleuls.length >= 3) {
    bonus = 30;
  }

  const exp = getExpirationDate(30 + bonus);
  subscribers[userId] = { username: request.username, expires: exp };
  saveSubscribers();

  delete pending[userId];
  savePending();

  bot.sendMessage(request.chatId, `✅ Paiement confirmé ! Voici ton lien d'accès premium :\n${config.CHANNEL_LINK}`);
  bot.sendMessage(msg.chat.id, `✅ Validé pour @${request.username}`);

  if (bonus > 0) {
    bot.sendMessage(userId, `🎉 Ton abonnement est prolongé de 1 mois grâce à tes 3 filleuls !`);
  }
});

// === /rejeter ===
bot.onText(/\/rejeter (\d+) (.+)/, (msg, match) => {
  if (String(msg.from.id) !== String(config.ADMIN_ID)) {
    return bot.sendMessage(msg.chat.id, '⛔ Commande réservée à l’admin');
  }

  const userId = match[1];
  const reason = match[2];
  const request = pending[userId];
  if (!request) return bot.sendMessage(msg.chat.id, `❌ Aucune demande en attente pour cet ID.`);

  delete pending[userId];
  savePending();

  bot.sendMessage(request.chatId, `❌ Ta demande d'accès a été rejetée.\nRaison : ${reason}`);
  bot.sendMessage(msg.chat.id, `✅ Demande de @${request.username} (ID: ${userId}) rejetée.\nRaison : ${reason}`);
});

// === /status ===
bot.onText(/\/status/, async (msg) => {
  const userId = msg.from.id;

  if (isAdmin(userId)) {
    return bot.sendMessage(msg.chat.id, `👑 Statut : *ADMIN - Accès illimité*`, { parse_mode: 'Markdown' });
  }

  const sub = await Subscriber.findOne({ userId: String(userId) });

  if (sub && sub.expires > new Date()) {
    return bot.sendMessage(msg.chat.id, `✅ Abonnement actif jusqu’au : *${new Date(sub.expires).toLocaleString()}*`, { parse_mode: 'Markdown' });
  } else {
    return bot.sendMessage(msg.chat.id, `❌ Ton abonnement est expiré ou non activé.`);
  }
});

// === /prem ===
bot.onText(/\/prem (\d+)/, (msg, match) => {
  if (!isAdmin(msg.from.id)) {
    return bot.sendMessage(msg.chat.id, '⛔ Commande réservée à l’administrateur.');
  }

  const userId = match[1];
  const username = referrals[userId]?.username || `ID:${userId}`;

  const exp = getExpirationDate(30); // 30 jours
  subscribers[userId] = { username, expires: exp };
  saveSubscribers();

  bot.sendMessage(userId, `🎉 Ton abonnement premium a été activé manuellement par l'administrateur.`);
  bot.sendMessage(msg.chat.id, `✅ Premium accordé à ${username}`);
});

// === /unprem ===
bot.onText(/\/unprem (\d+)/, async (msg, match) => {
  if (!isAdmin(msg.from.id)) {
    return bot.sendMessage(msg.chat.id, '⛔ Commande réservée à l’administrateur.');
  }

  const userId = match[1];

  if (!subscribers[userId]) {
    return bot.sendMessage(msg.chat.id, `ℹ️ Cet utilisateur n’a pas d’abonnement actif.`);
  }

  delete subscribers[userId];
  saveSubscribers();

  try {
    await bot.banChatMember(config.CHANNEL_ID, parseInt(userId));
    await bot.unbanChatMember(config.CHANNEL_ID, parseInt(userId));
    
    bot.sendMessage(userId, `⚠️ Ton abonnement a été révoqué et ton accès à la chaîne a été supprimé.`);
    bot.sendMessage(msg.chat.id, `✅ ${userId} révoqué et retiré de la chaîne.`);
  } catch (err) {
    bot.sendMessage(msg.chat.id, `⚠️ Erreur lors du retrait de ${userId} de la chaîne : ${err.message}`);
  }
});

// === /abonnes ===
bot.onText(/\/abonnes/, (msg) => {
  if (!isAdmin(msg.from.id)) {
    return bot.sendMessage(msg.chat.id, '⛔ Commande réservée à l’administrateur.');
  }

  const total = Object.keys(subscribers).length;
  if (total === 0) {
    return bot.sendMessage(msg.chat.id, '📭 Aucun abonné premium pour le moment.');
  }

  const liste = Object.entries(subscribers)
    .map(([id, sub]) => `• ${sub.username} (ID: ${id})\n  Expires: ${new Date(sub.expires).toLocaleDateString()}`)
    .join('\n\n');

  bot.sendMessage(msg.chat.id, `📋 *Liste des abonnés premium* (${total}) :\n\n${liste}`, { parse_mode: 'Markdown' });
});

// === Chargement de la whitelist ===
const whitelistPath = './whitelist.json';
let whitelist = fs.existsSync(whitelistPath) ? JSON.parse(fs.readFileSync(whitelistPath)) : [];

function saveWhitelist() {
  fs.writeFileSync(whitelistPath, JSON.stringify(whitelist, null, 2));
}

// === Commande /whitelist <id> ===
bot.onText(/\/whitelist (\d+)/, (msg, match) => {
  const adminId = config.ADMIN_ID;
  if (String(msg.from.id) !== String(adminId)) {
    return bot.sendMessage(msg.chat.id, '⛔ Commande réservée à l’administrateur.');
  }

  const targetId = match[1];

  if (whitelist.includes(targetId)) {
    return bot.sendMessage(msg.chat.id, `ℹ️ L’utilisateur ${targetId} est déjà dans la whitelist.`);
  }

  whitelist.push(targetId);
  saveWhitelist();

  bot.sendMessage(msg.chat.id, `✅ L’utilisateur ${targetId} est ajouté à la whitelist. Il ne sera pas supprimé automatiquement.`);
  bot.sendMessage(targetId, `✅ Tu es désormais protégé. Ton abonnement ne sera pas supprimé automatiquement.`);
});

bot.onText(/\/id/, (msg) => {
  bot.sendMessage(msg.chat.id, `🆔 Chat ID: \`${msg.chat.id}\``, { parse_mode: 'Markdown' });
});
// === Commande /unwhitelist <id> ===

bot.onText(/\/unwhitelist (\d+)/, (msg, match) => {
  if (!isAdmin(msg.from.id)) {
    return bot.sendMessage(msg.chat.id, '⛔ Commande réservée à l’admin.');
  }

  const userId = match[1];
  if (whitelist.includes(userId)) {
    whitelist = whitelist.filter(id => id !== userId);
    saveWhitelist();
    bot.sendMessage(msg.chat.id, `🗑️ L'utilisateur ${userId} a été retiré de la whitelist.`);
  } else {
    bot.sendMessage(msg.chat.id, `ℹ️ L'utilisateur ${userId} n'était pas dans la whitelist.`);
  }
});

// === Commande /whitelist_liste ===

bot.onText(/\/whitelist_liste/, (msg) => {
  if (!isAdmin(msg.from.id)) {
    return bot.sendMessage(msg.chat.id, '⛔ Commande réservée à l’admin.');
  }

  if (whitelist.length === 0) {
    return bot.sendMessage(msg.chat.id, '📭 Aucun utilisateur dans la whitelist.');
  }

  const list = whitelist.map((id, index) => `• ${index + 1}. ID: ${id}`).join('\n');
  bot.sendMessage(msg.chat.id, `📋 *Whitelist actuelle* :\n\n${list}`, { parse_mode: 'Markdown' });
});

// === Nettoyage abonnés expirés (toutes les heures) ===
setInterval(async () => {
  const now = new Date();
  let changed = false;

  for (const userId in subscribers) {
    const isExpired = new Date(subscribers[userId].expires) < now;
    const isWhitelisted = whitelist.includes(userId);

    if (isExpired && !isWhitelisted) {
      try {
        // Ban & unban pour retirer de la chaîne
        await bot.banChatMember(config.CHANNEL_ID, parseInt(userId));
        await bot.unbanChatMember(config.CHANNEL_ID, parseInt(userId));
        bot.sendMessage(userId, "⏰ Ton abonnement premium a expiré. Merci de renouveler avec /abonnement.");
      } catch (err) {
        console.error(`❌ Échec suppression de la chaîne pour ${userId} : ${err.message}`);
      }

      delete subscribers[userId];
      changed = true;
    }
  }

  if (changed) saveSubscribers();
}, 3600000); // toutes les heures

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
