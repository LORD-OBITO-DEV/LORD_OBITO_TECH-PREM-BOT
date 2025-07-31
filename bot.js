import TelegramBot from 'node-telegram-bot-api';
import express from 'express';
import fs from 'fs';
import crypto from 'crypto';
import archiver from 'archiver';
import path from 'path';
import Subscriber from './models/Subscriber.js';
import Referral from './models/Referral.js';
import Pending from './models/Pending.js';
import Whitelist from './models/Whitelist.js';
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

// Sauvegarde ou mise à jour d’un abonné
export async function upsertSubscriber(userId, data) {
  await Subscriber.findOneAndUpdate(
    { userId },
    { $set: data },
    { upsert: true, new: true }
  );
}

// Supprime un abonné
export async function deleteSubscriber(userId) {
  await Subscriber.deleteOne({ userId });
}

// Sauvegarde ou mise à jour d’un pending
export async function upsertPending(userId, data) {
  await Pending.findOneAndUpdate(
    { userId },
    { $set: data },
    { upsert: true, new: true }
  );
}

// Supprime une demande en attente
export async function deletePending(userId) {
  await Pending.deleteOne({ userId });
}

// Sauvegarde ou mise à jour d’un referral
export async function upsertReferral(userId, data) {
  await Referral.findOneAndUpdate(
    { userId },
    { $set: data },
    { upsert: true, new: true }
  );
}

// === Commande /start avec parrainage (MongoDB) ===
bot.onText(/\/start(?: (.+))?/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = String(msg.from.id);
  const refCode = match ? match[1] : null;
  const username = msg.from.username || `ID:${userId}`;

  // ✅ Si l'utilisateur a été invité avec un code
  if (refCode) {
    const parrain = await Referral.findOne({ code: refCode });

    if (parrain && parrain.userId !== userId) {
      if (!parrain.filleuls.includes(userId)) {
        parrain.filleuls.push(userId);
        await parrain.save();

        // 🎁 Bonus si 3 filleuls
        if (parrain.filleuls.length === 3) {
          let existingSub = await Subscriber.findOne({ userId: parrain.userId });
          let exp = new Date();

          if (existingSub && new Date(existingSub.expires) > new Date()) {
            exp = new Date(existingSub.expires);
          }

          exp.setDate(exp.getDate() + 30);

          await Subscriber.findOneAndUpdate(
            { userId: parrain.userId },
            {
              userId: parrain.userId,
              username: parrain.username,
              expires: exp
            },
            { upsert: true }
          );

          bot.sendMessage(parrain.userId, `🔥 Bravo ! Tu as 3 filleuls. Ton abonnement premium est prolongé de 1 mois automatiquement !`);
        }
      }
    }
  }

  // ✅ Si l'utilisateur n’a pas encore de code de parrainage
  const existingReferral = await Referral.findOne({ userId });

  if (!existingReferral) {
    const newReferral = new Referral({
      userId,
      username,
      code: generateReferralCode(),
      filleuls: []
    });
    await newReferral.save();
  }

  // ✅ Menu d’accueil
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

bot.onText(/\/help/, async (msg) => {
  const userId = String(msg.from.id);
  const isAdminUser = userId === String(config.ADMIN_ID);

  let text = `
📌 *Commandes disponibles* :

/start — Démarrer le bot
/abonnement — Voir les moyens de paiement
/status — Vérifier ton abonnement
/codepromo — Voir ton code promo
/mesfilleuls — Liste de tes filleuls
/promo — Ton lien de parrainage
/preuve <texte> — Envoyer une preuve de paiement
`;

  if (isAdminUser) {
    text += `
    
👑 *Commandes administrateur* 👑 :
/valider <id> — Valider un paiement
/rejeter <id> <raison> — Rejeter une demande d'accès
/prem <id> — Donner un abonnement premium
/unprem <id> — Révoquer un abonnement premium
/abonnes — Voir la liste des abonnés
/backup — Télécharger une sauvegarde .zip
/whitelist <id> — Ajouter un utilisateur premium à vie
/unwhitelist <id> — Retirer un utilisateur de la whitelist
/whitelist_liste — Voir la whitelist actuelle
    `;
  }

  bot.sendMessage(msg.chat.id, text, { parse_mode: "Markdown" });
});

// === /codepromo ===

bot.onText(/\/codepromo/, async (msg) => {
  const userId = String(msg.from.id);
  const username = msg.from.username || `ID:${userId}`;

  let referral = await Referral.findOne({ userId });

  if (!referral) {
    referral = new Referral({
      userId,
      code: crypto.randomBytes(4).toString('hex').toUpperCase(),
      filleuls: [],
      username
    });
    await referral.save();
  }

  const code = referral.code;
  bot.sendMessage(msg.chat.id, `🎫 Ton code promo : *${code}*\nPartage-le avec /start ${code}`, {
    parse_mode: "Markdown"
  });
});

// === /promo ===

bot.onText(/\/promo/, async (msg) => {
  const userId = String(msg.from.id);
  const username = msg.from.username || `ID:${userId}`;

  let referral = await Referral.findOne({ userId });

  if (!referral) {
    referral = new Referral({
      userId,
      code: crypto.randomBytes(4).toString('hex').toUpperCase(),
      filleuls: [],
      username
    });
    await referral.save();
  }

  const code = referral.code;
  const startLink = username
    ? `https://t.me/${config.BOT_USERNAME}?start=${code}`
    : `Partage ton code avec /start ${code}`;

  const message = `🎁 Invite tes amis avec ce lien :\n${startLink}\n\n3 filleuls = 1 mois gratuit ! 🔥`;
  bot.sendMessage(msg.chat.id, message);
});

// === /mesfilleuls ===
bot.onText(/\/mesfilleuls/, async (msg) => {
  const userId = String(msg.from.id);

  const data = await Referral.findOne({ userId });
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
bot.onText(/\/preuve (.+)/, async (msg, match) => {
  const userId = String(msg.from.id);
  const proofText = match[1];
  const username = msg.from.username || `ID:${userId}`;
  const chatId = msg.chat.id;

  if (isAdmin(userId)) {
    return bot.sendMessage(chatId, `👑 Tu es admin, inutile d’envoyer une preuve.`);
  }

  if (!proofText) {
    return bot.sendMessage(chatId, '❌ Veuillez envoyer une preuve valide après la commande, exemple: /preuve capture écran, reçu, etc.');
  }

  // Enregistre dans MongoDB
  await Pending.findOneAndUpdate(
    { userId },
    { username, chatId, proof: proofText, requestedAt: new Date().toISOString() },
    { upsert: true }
  );

  bot.sendMessage(chatId, `📬 Preuve reçue, l’admin vérifiera et validera la demande.`);

  if (config.ADMIN_ID) {
    bot.sendMessage(config.ADMIN_ID, `🔔 Nouvelle preuve de paiement de @${username} (ID: ${userId}) :\n${proofText}\nValide avec /valider ${userId}`);
  }
});

// === /backup (réservé à l’admin) ===
bot.onText(/\/backup/, async (msg) => {
  const userId = msg.from.id;
  if (!isAdmin(userId)) {
    return bot.sendMessage(msg.chat.id, '⛔ Commande réservée à l’administrateur.');
  }

  const zipPath = './backup.zip';
  const output = fs.createWriteStream(zipPath);
  const archive = archiver('zip', { zlib: { level: 9 } });

  // Étape 1 : récupérer les données depuis MongoDB
  const subscribers = await Subscriber.find().lean();
  const referrals = await Referral.find().lean();
  const pending = await Pending.find().lean();
  const whitelist = await Whitelist.find().lean();

  // Étape 2 : sauvegarder temporairement dans des fichiers JSON
  fs.writeFileSync('./subscribers.json', JSON.stringify(subscribers, null, 2));
  fs.writeFileSync('./referrals.json', JSON.stringify(referrals, null, 2));
  fs.writeFileSync('./pending.json', JSON.stringify(pending, null, 2));
  fs.writeFileSync('./whitelist.json', JSON.stringify(whitelist, null, 2));

  // Étape 3 : créer le ZIP
  output.on('close', () => {
    bot.sendDocument(msg.chat.id, zipPath, {}, {
      filename: 'backup-premium-bot.zip',
      contentType: 'application/zip'
    }).then(() => {
      fs.unlinkSync(zipPath);
      fs.unlinkSync('./subscribers.json');
      fs.unlinkSync('./referrals.json');
      fs.unlinkSync('./pending.json');
      fs.unlinkSync('./whitelist.json');
    });
  });

  archive.on('error', err => {
    console.error(err);
    bot.sendMessage(msg.chat.id, '❌ Erreur lors de la création du fichier de sauvegarde.');
  });

  archive.pipe(output);
  archive.file('./subscribers.json', { name: 'subscribers.json' });
  archive.file('./referrals.json', { name: 'referrals.json' });
  archive.file('./pending.json', { name: 'pending.json' });
  archive.file('./whitelist.json', { name: 'whitelist.json' });
  archive.finalize();
});

// === /acces ===
bot.onText(/\/acces/, async (msg) => {
  const userId = msg.from.id;
  const chatId = msg.chat.id;

  if (isAdmin(userId)) {
    return bot.sendMessage(chatId, `✅ Accès illimité administrateur :\n${config.CHANNEL_LINK}`);
  }

  try {
    const user = await Subscriber.findOne({ userId });

    if (user && new Date(user.expires) > new Date()) {
      return bot.sendMessage(chatId, `✅ Tu as déjà accès :\n${config.CHANNEL_LINK}`);
    } else {
      return bot.sendMessage(chatId, `❌ Ton abonnement est expiré ou non activé.\nMerci de payer 1000 FCFA via /abonnement.\nEnvoie ta preuve avec /preuve`);
    }
  } catch (err) {
    console.error(err);
    bot.sendMessage(chatId, `⚠️ Une erreur est survenue lors de la vérification de ton abonnement.`);
  }
});

// === /valider ===
bot.onText(/\/valider (\d+)/, async (msg, match) => {
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

  const exp = new Date();
  exp.setDate(exp.getDate() + 30 + bonus);

  try {
    await Subscriber.findOneAndUpdate(
      { userId },
      {
        userId,
        username: request.username,
        expires: exp.toISOString()
      },
      { upsert: true, new: true }
    );

    delete pending[userId];
    savePending();

    await bot.sendMessage(request.chatId, `✅ Paiement confirmé ! Voici ton lien d'accès premium :\n${config.CHANNEL_LINK}`);
    await bot.sendMessage(msg.chat.id, `✅ Validé pour @${request.username}`);

    if (bonus > 0) {
      await bot.sendMessage(userId, `🎉 Ton abonnement est prolongé de 1 mois grâce à tes 3 filleuls !`);
    }
  } catch (err) {
    console.error(err);
    bot.sendMessage(msg.chat.id, `❌ Une erreur est survenue lors de la validation.`);
  }
});

// === /rejeter ===
bot.onText(/\/rejeter (\d+) (.+)/, async (msg, match) => {
  if (String(msg.from.id) !== String(config.ADMIN_ID)) {
    return bot.sendMessage(msg.chat.id, '⛔ Commande réservée à l’admin');
  }

  const userId = match[1];
  const reason = match[2];

  try {
    const request = await Pending.findOne({ userId });

    if (!request) {
      return bot.sendMessage(msg.chat.id, `❌ Aucune demande en attente pour cet ID.`);
    }

    await Pending.deleteOne({ userId });

    await bot.sendMessage(request.chatId, `❌ Ta demande d'accès a été rejetée.\nRaison : ${reason}`);
    await bot.sendMessage(msg.chat.id, `✅ Demande de @${request.username} (ID: ${userId}) rejetée.\nRaison : ${reason}`);
  } catch (error) {
    console.error(error);
    bot.sendMessage(msg.chat.id, `❌ Erreur lors du rejet.`);
  }
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
bot.onText(/\/prem (\d+)/, async (msg, match) => {
  if (!isAdmin(msg.from.id)) {
    return bot.sendMessage(msg.chat.id, '⛔ Commande réservée à l’administrateur.');
  }

  const userId = match[1];
  const ref = await Referral.findOne({ userId });
  const username = ref?.username || `ID:${userId}`;
  const expires = getExpirationDate(30); // 30 jours

  await Subscriber.findOneAndUpdate(
    { userId },
    { username, expires },
    { upsert: true, new: true }
  );

  bot.sendMessage(userId, `🎉 Ton abonnement premium a été activé manuellement par l'administrateur.`);
  bot.sendMessage(msg.chat.id, `✅ Premium accordé à ${username}`);
});

// === /unprem ===
bot.onText(/\/unprem (\d+)/, async (msg, match) => {
  if (!isAdmin(msg.from.id)) {
    return bot.sendMessage(msg.chat.id, '⛔ Commande réservée à l’administrateur.');
  }

  const userId = match[1];

  const sub = await Subscriber.findOne({ userId });
  if (!sub) {
    return bot.sendMessage(msg.chat.id, `ℹ️ Cet utilisateur n’a pas d’abonnement actif.`);
  }

  await Subscriber.deleteOne({ userId });

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
bot.onText(/\/abonnes/, async (msg) => {
  if (!isAdmin(msg.from.id)) {
    return bot.sendMessage(msg.chat.id, '⛔ Commande réservée à l’administrateur.');
  }

  const abonnés = await Subscriber.find({});
  const total = abonnés.length;

  if (total === 0) {
    return bot.sendMessage(msg.chat.id, '📭 Aucun abonné premium pour le moment.');
  }

  const liste = abonnés.map(sub => {
    const date = new Date(sub.expires).toLocaleDateString();
    return `• ${sub.username} (ID: ${sub.userId})\n  Expires: ${date}`;
  }).join('\n\n');

  const message = `📋 *Liste des abonnés premium* (${total}) :\n\n${liste}`;
  bot.sendMessage(msg.chat.id, message, { parse_mode: 'Markdown' });
});

// === Commande /whitelist <id> ===
bot.onText(/\/whitelist (\d+)/, async (msg, match) => {
  const adminId = config.ADMIN_ID;
  if (String(msg.from.id) !== String(adminId)) {
    return bot.sendMessage(msg.chat.id, '⛔ Commande réservée à l’administrateur.');
  }

  const targetId = match[1];

  const exist = await Whitelist.findOne({ userId: targetId });
  if (exist) {
    return bot.sendMessage(msg.chat.id, `ℹ️ L’utilisateur ${targetId} est déjà dans la whitelist.`);
  }

  await Whitelist.create({ userId: targetId });

  bot.sendMessage(msg.chat.id, `✅ L’utilisateur ${targetId} est ajouté à la whitelist.`);
  bot.sendMessage(targetId, `✅ Tu es désormais protégé. Ton abonnement ne sera pas supprimé automatiquement.`);
});
// === Commande /unwhitelist <id> ===

bot.onText(/\/unwhitelist (\d+)/, async (msg, match) => {
  const adminId = config.ADMIN_ID;
  if (String(msg.from.id) !== String(adminId)) {
    return bot.sendMessage(msg.chat.id, '⛔ Commande réservée à l’administrateur.');
  }

  const targetId = match[1];

  const result = await Whitelist.findOneAndDelete({ userId: targetId });
  if (!result) {
    return bot.sendMessage(msg.chat.id, `❌ Utilisateur ${targetId} non trouvé dans la whitelist.`);
  }

  bot.sendMessage(msg.chat.id, `✅ L’utilisateur ${targetId} a été retiré de la whitelist.`);
});

// === Commande /whitelist_liste ===

bot.onText(/\/whitelist_liste/, async (msg) => {
  if (!isAdmin(msg.from.id)) {
    return bot.sendMessage(msg.chat.id, '⛔ Commande réservée à l’administrateur.');
  }

  const list = await Whitelist.find({});
  if (list.length === 0) {
    return bot.sendMessage(msg.chat.id, '📭 Aucune entrée dans la whitelist.');
  }

  const texte = list.map(item => `• ID: ${item.userId}`).join('\n');
  bot.sendMessage(msg.chat.id, `📋 *Whitelist actuelle* :\n\n${texte}`, { parse_mode: 'Markdown' });
});

// === Nettoyage abonnés expirés (toutes les heures) ===

setInterval(async () => {
  const now = new Date();
  const expiredSubscribers = await Subscriber.find({ expires: { $lt: now } });

  for (const sub of expiredSubscribers) {
    const isWhitelisted = await Whitelist.findOne({ userId: sub.userId });
    if (isWhitelisted) continue;

    try {
      await bot.banChatMember(config.CHANNEL_ID, parseInt(sub.userId));
      await bot.unbanChatMember(config.CHANNEL_ID, parseInt(sub.userId));
      await bot.sendMessage(sub.userId, "⏰ Ton abonnement premium a expiré. Merci de renouveler avec /abonnement.");
    } catch (err) {
      console.error(`❌ Échec suppression pour ${sub.userId} : ${err.message}`);
    }

    await Subscriber.deleteOne({ userId: sub.userId });
  }
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
