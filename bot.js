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
import Invite from './models/Invite.js';
import { t } from './i18n.js'; // importer la fonction t()

function getLang(msg) {
  const langCode = msg.from?.language_code || 'fr';
  return langCode.startsWith('en') ? 'en' : 'fr'; // par défaut français
}

function getExpirationDate(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

function generateReferralCode(length = 8) {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let code = '';
  for (let i = 0; i < length; i++) {
    code += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return code;
}

// 🟢 Charger d'abord le fichier de configuration
const config = JSON.parse(fs.readFileSync('./config.json', 'utf8'));

// 🟢 Ensuite initialiser mongoUri
const mongoUri = config.MONGO_URI;

// 🟢 Maintenant tu peux te connecter à MongoDB
mongoose.connect(mongoUri, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('✅ Connecté à MongoDB Atlas');
}).catch(err => {
  console.error('❌ Erreur de connexion MongoDB:', err);
});

// ✅ Fonction manquante ajoutée ici
function isAdmin(userId) {
  return String(userId) === String(config.ADMIN_ID);
}

const bot = new TelegramBot(config.BOT_TOKEN, { webHook: true });

const app = express();
app.use(express.json());

// === Fichiers JSON ===
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
  const lang = msg.from.language_code || 'fr'; // Détection de langue
  const refCode = match ? match[1] : null;
  const username = msg.from.username || `ID:${userId}`;

  // Si l'utilisateur a été invité avec un code
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

          await bot.sendMessage(parrain.userId, t(lang, 'bonus_parrainage'));
        }
      }
    }
  }

  // Créer le code de parrainage si l'utilisateur n'en a pas
  let referral = await Referral.findOne({ userId });
  if (!referral) {
    referral = new Referral({
      userId,
      username,
      code: generateReferralCode(),
      filleuls: []
    });
    await referral.save();
  }

  const image = 'https://files.catbox.moe/dsmhrq.jpg';
  const menu = t(lang, 'menu_start');

  await bot.sendPhoto(chatId, image, {
    caption: menu,
    parse_mode: "Markdown"
  });
});

// === /help ===

bot.onText(/\/help/, async (msg) => {
  const userId = String(msg.from.id);
  const isAdminUser = userId === String(config.ADMIN_ID);
  const lang = msg.from.language_code || 'fr';

  let text = t(lang, 'help_base');

  if (isAdminUser) {
    text += '\n\n' + t(lang, 'help_admin');
  }

  bot.sendMessage(msg.chat.id, text, { parse_mode: "MarkdownV2" });
});

// === /codepromo ===

bot.onText(/\/codepromo/, async (msg) => {
  const userId = String(msg.from.id);
  const username = msg.from.username || `ID:${userId}`;
  const lang = msg.from.language_code?.startsWith('en') ? 'en' : 'fr';

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

  const message = `🎫 ${t(lang, 'promo_code')} *${code}*\n${t(lang, 'share_code')} /start ${code}`;

  bot.sendMessage(msg.chat.id, message, {
    parse_mode: "Markdown"
  });
});

// === /promo ===
bot.onText(/\/promo/, async (msg) => {
  const userId = String(msg.from.id);
  const username = msg.from.username || `ID:${userId}`;
  const lang = msg.from.language_code || 'fr';

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
    : `${t(lang, 'share_code')} /start ${code}`;

  const message = `${t(lang, 'invite_friends')}\n${startLink}\n\n${t(lang, 'free_month_reward')}`;
  bot.sendMessage(msg.chat.id, message);
});

// === /mesfilleuls ===
bot.onText(/\/mesfilleuls/, async (msg) => {
  const userId = String(msg.from.id);
  const lang = msg.from.language_code || 'fr';

  const data = await Referral.findOne({ userId });
  if (!data || !data.filleuls || data.filleuls.length === 0) {
    return bot.sendMessage(msg.chat.id, t(lang, 'no_referrals'));
  }

  const filleulsList = data.filleuls.map(id => `- ID: ${id}`).join('\n');
  const response = `${t(lang, 'referral_count').replace('{count}', data.filleuls.length)}\n${filleulsList}`;

  bot.sendMessage(msg.chat.id, response);
});
// === /abonnement ===
bot.onText(/\/abonnement/, (msg) => {
  const lang = msg.from.language_code || 'fr';

  if (isAdmin(msg.from.id)) {
    return bot.sendMessage(msg.chat.id, t(lang, 'admin_no_payment_needed'));
  }

  const imageURL = 'https://files.catbox.moe/4m5nb4.jpg';
  const message = t(lang, 'subscription_message');

  bot.sendPhoto(msg.chat.id, imageURL, {
    caption: message,
    parse_mode: "Markdown"
  });
});

// Moyens de paiement
bot.onText(/\/paypal/, (msg) => {
  const lang = msg.from.language_code || 'fr';
  const text = t(lang, 'paypal_text').replace('{link}', config.PAYPAL_LINK);
  bot.sendMessage(msg.chat.id, text, { parse_mode: "Markdown" });
});

bot.onText(/\/wave/, (msg) => {
  const lang = msg.from.language_code || 'fr';
  const text = t(lang, 'wave_text').replace('{number}', config.WAVE_NUMBER);
  bot.sendMessage(msg.chat.id, text, { parse_mode: "Markdown" });
});

bot.onText(/\/om/, (msg) => {
  const lang = msg.from.language_code || 'fr';
  const text = t(lang, 'om_text').replace('{number}', config.OM_NUMBER);
  bot.sendMessage(msg.chat.id, text, { parse_mode: "Markdown" });
});

bot.onText(/\/mtn/, (msg) => {
  const lang = msg.from.language_code || 'fr';
  const text = t(lang, 'mtn_text').replace('{number}', config.MTN_NUMBER);
  bot.sendMessage(msg.chat.id, text, { parse_mode: "Markdown" });
});

// === /preuve ===
bot.onText(/\/preuve(?: (.+))?/, async (msg, match) => {
  const userId = String(msg.from.id);
  const proofText = match ? match[1] : null;
  const username = msg.from.username || `ID:${userId}`;
  const chatId = msg.chat.id;
  const lang = msg.from.language_code || 'fr';

  if (isAdmin(userId)) {
    return bot.sendMessage(chatId, t(lang, 'admin_no_proof'));
  }

  if (!proofText) {
    return bot.sendMessage(chatId, t(lang, 'proof_missing'));
  }

  // Enregistrement dans la base
  await Pending.findOneAndUpdate(
    { userId },
    {
      username,
      chatId,
      proof: proofText,
      requestedAt: new Date().toISOString()
    },
    { upsert: true }
  );

  bot.sendMessage(chatId, t(lang, 'proof_received'));

  if (config.ADMIN_ID) {
    const alert = `🔔 Nouvelle preuve de paiement de ${username} (ID: ${userId}) :\n${proofText}\n\n✅ Valider avec /valider ${userId}`;
    bot.sendMessage(config.ADMIN_ID, alert);
  }
});

// === /backup (réservé à l’admin) ===
bot.onText(/\/backup/, async (msg) => {
  const userId = String(msg.from.id);
  const lang = msg.from.language_code || 'fr';

  if (!isAdmin(userId)) {
    return bot.sendMessage(msg.chat.id, t(lang, 'admin_only'));
  }

  try {
    // Étape 1 : récupérer les données MongoDB
    const [subscribers, referrals, pending, whitelist] = await Promise.all([
      Subscriber.find().lean(),
      Referral.find().lean(),
      Pending.find().lean(),
      Whitelist.find().lean()
    ]);

    // Étape 2 : écrire les fichiers JSON temporairement
    fs.writeFileSync('./subscribers.json', JSON.stringify(subscribers, null, 2));
    fs.writeFileSync('./referrals.json', JSON.stringify(referrals, null, 2));
    fs.writeFileSync('./pending.json', JSON.stringify(pending, null, 2));
    fs.writeFileSync('./whitelist.json', JSON.stringify(whitelist, null, 2));

    // Étape 3 : Créer le zip
    const zipPath = './backup.zip';
    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    archive.pipe(output);
    archive.file('./subscribers.json', { name: 'subscribers.json' });
    archive.file('./referrals.json', { name: 'referrals.json' });
    archive.file('./pending.json', { name: 'pending.json' });
    archive.file('./whitelist.json', { name: 'whitelist.json' });

    await archive.finalize();

    output.on('close', async () => {
      await bot.sendDocument(msg.chat.id, zipPath, {
        caption: t(lang, 'backup_success'),
        filename: 'backup-premium-bot.zip',
        contentType: 'application/zip'
      });

      // Nettoyage
      fs.unlinkSync('./subscribers.json');
      fs.unlinkSync('./referrals.json');
      fs.unlinkSync('./pending.json');
      fs.unlinkSync('./whitelist.json');
      fs.unlinkSync(zipPath);
    });

    archive.on('error', (err) => {
      console.error('Erreur archive:', err);
      bot.sendMessage(msg.chat.id, t(lang, 'zip_error'));
    });

  } catch (err) {
    console.error(err);
    bot.sendMessage(msg.chat.id, t(lang, 'error_occurred'));
  }
});

// === /acces ===
bot.onText(/\/acces/, async (msg) => {
  const userId = String(msg.from.id);
  const chatId = msg.chat.id;
  const lang = msg.from.language_code || 'fr';

  if (isAdmin(userId)) {
    return bot.sendMessage(chatId, `✅ ${t(lang, 'admin_access')}:\n${config.CHANNEL_LINK}`);
  }

  try {
    const user = await Subscriber.findOne({ userId });

    if (!user || new Date(user.expires) < new Date()) {
      return bot.sendMessage(chatId, `${t(lang, 'subscription_expired')}\n${t(lang, 'please_pay')} /abonnement\n${t(lang, 'send_proof')} /preuve`);
    }

    let invite = await Invite.findOne({ userId });
    const now = new Date();

    // 🔁 Si un lien encore valide existe
    if (invite && invite.expiresAt && new Date(invite.expiresAt) > now) {
      return bot.sendMessage(chatId, `✅ ${t(lang, 'valid_invite')}\n${invite.inviteLink}`, {
        reply_markup: {
          inline_keyboard: [[
            { text: `✅ ${t(lang, 'joined_button')}`, callback_data: "joined_channel" }
          ]]
        }
      });
    }

    // 🆕 Sinon, on crée un nouveau lien valable 1h
    const expireTimestamp = Math.floor(Date.now() / 1000) + 3600;
    const inviteLinkData = await bot.createChatInviteLink(config.CHANNEL_ID, {
      member_limit: 1,
      creates_join_request: false,
      expire_date: expireTimestamp
    });

    const inviteLink = inviteLinkData.invite_link;

    const sent = await bot.sendMessage(chatId, `✅ ${t(lang, 'new_invite')}\n${inviteLink}`, {
      reply_markup: {
        inline_keyboard: [[
          { text: `✅ ${t(lang, 'joined_button')}`, callback_data: "joined_channel" }
        ]]
      }
    });

    // 💾 Sauvegarde ou MAJ de l’invitation
    await Invite.findOneAndUpdate(
      { userId },
      {
        userId,
        inviteLink,
        messageId: sent.message_id,
        chatId,
        expiresAt: new Date(Date.now() + 3600 * 1000)
      },
      { upsert: true }
    );

  } catch (err) {
    console.error(err);
    bot.sendMessage(chatId, `❌ ${t(lang, 'error_occurred')}`);
  }
});


// === /valider <id> ===
bot.onText(/\/valider (\d+)/, async (msg, match) => {
  const adminId = String(msg.from.id);
  const lang = msg.from.language_code || 'fr';

  if (!isAdmin(adminId)) {
    return bot.sendMessage(msg.chat.id, t(lang, 'admin_only'));
  }

  const targetId = match[1];

  try {
    const pending = await Pending.findOne({ userId: targetId });

    if (!pending) {
      return bot.sendMessage(msg.chat.id, t(lang, 'no_pending'));
    }

    const ref = await Referral.findOne({ userId: targetId });
    const username = ref?.username || `ID:${targetId}`;
    const expires = getExpirationDate(30); // 30 jours

    await Subscriber.findOneAndUpdate(
      { userId: targetId },
      { username, expires },
      { upsert: true, new: true }
    );

    await Pending.deleteOne({ userId: targetId });

    await bot.sendMessage(targetId, t(lang, 'prem_user'));
    await bot.sendMessage(msg.chat.id, `${t(lang, 'prem_admin')} ${username}`);
  } catch (err) {
    console.error(err);
    bot.sendMessage(msg.chat.id, `❌ ${t(lang, 'error_occurred')}`);
  }
});

// === /rejeter ===
bot.onText(/\/rejeter (\d+) (.+)/, async (msg, match) => {
  const lang = msg.from.language_code || 'fr';

  if (!isAdmin(msg.from.id)) {
    return bot.sendMessage(msg.chat.id, t(lang, 'admin_only'));
  }

  const userId = match[1];
  const reason = match[2];

  try {
    const request = await Pending.findOne({ userId });

    if (!request) {
      return bot.sendMessage(msg.chat.id, t(lang, 'no_pending'));
    }

    await Pending.deleteOne({ userId });

    await bot.sendMessage(request.chatId, `${t(lang, 'rejected_user')}:\n${reason}`);
    await bot.sendMessage(msg.chat.id, `${t(lang, 'rejected_admin')} @${request.username} (ID: ${userId})\n${t(lang, 'reason')}: ${reason}`);
  } catch (error) {
    console.error(error);
    bot.sendMessage(msg.chat.id, t(lang, 'error_occurred'));
  }
});

// === /status ===
bot.onText(/\/status/, async (msg) => {
  const userId = String(msg.from.id);
  const lang = msg.from.language_code || 'fr';

  if (isAdmin(userId)) {
    return bot.sendMessage(msg.chat.id, `👑 ${t(lang, 'status_admin')}`, { parse_mode: 'Markdown' });
  }

  const sub = await Subscriber.findOne({ userId });

  if (sub && new Date(sub.expires) > new Date()) {
    return bot.sendMessage(msg.chat.id, `✅ ${t(lang, 'status_active')} *${new Date(sub.expires).toLocaleString()}*`, {
      parse_mode: 'Markdown'
    });
  } else {
    return bot.sendMessage(msg.chat.id, t(lang, 'status_expired'));
  }
});

// === /prem ===
bot.onText(/\/prem (\d+)/, async (msg, match) => {
  const lang = msg.from.language_code || 'fr';

  if (!isAdmin(msg.from.id)) {
    return bot.sendMessage(msg.chat.id, t(lang, 'admin_only'));
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

  await bot.sendMessage(userId, t(lang, 'prem_user'));
  bot.sendMessage(msg.chat.id, `${t(lang, 'prem_admin')} ${username}`);
});

// === /unprem ===
bot.onText(/\/unprem (\d+)/, async (msg, match) => {
  const lang = msg.from.language_code || 'fr';

  if (!isAdmin(msg.from.id)) {
    return bot.sendMessage(msg.chat.id, t(lang, 'admin_only'));
  }

  const userId = match[1];

  const sub = await Subscriber.findOne({ userId });
  if (!sub) {
    return bot.sendMessage(msg.chat.id, t(lang, 'no_active_subscription'));
  }

  await Subscriber.deleteOne({ userId });

  try {
    await bot.banChatMember(config.CHANNEL_ID, parseInt(userId));
    await bot.unbanChatMember(config.CHANNEL_ID, parseInt(userId));

    await bot.sendMessage(userId, t(lang, 'unprem_user'));
    await bot.sendMessage(msg.chat.id, `${t(lang, 'unprem_admin')} ${userId}`);
  } catch (err) {
    bot.sendMessage(msg.chat.id, `${t(lang, 'unprem_error')} ${err.message}`);
  }
});

// === /abonnes ===
bot.onText(/\/abonnes/, async (msg) => {
  const lang = msg.from.language_code || 'fr';

  if (!isAdmin(msg.from.id)) {
    return bot.sendMessage(msg.chat.id, t(lang, 'admin_only'));
  }

  const abonnés = await Subscriber.find({});
  const total = abonnés.length;

  if (total === 0) {
    return bot.sendMessage(msg.chat.id, t(lang, 'no_premium_users'));
  }

  const liste = abonnés.map(sub => {
    const date = new Date(sub.expires).toLocaleDateString();
    return `• ${sub.username} (ID: ${sub.userId})\n  ${t(lang, 'expires')}: ${date}`;
  }).join('\n\n');

  const message = `📋 *${t(lang, 'premium_list')}* (${total}) :\n\n${liste}`;
  bot.sendMessage(msg.chat.id, message, { parse_mode: 'Markdown' });
});

// === /whitelist <id> ===
bot.onText(/\/whitelist (\d+)/, async (msg, match) => {
  const lang = msg.from.language_code || 'fr';
  const adminId = config.ADMIN_ID;

  if (String(msg.from.id) !== String(adminId)) {
    return bot.sendMessage(msg.chat.id, t(lang, 'admin_only'));
  }

  const targetId = match[1];
  const exist = await Whitelist.findOne({ userId: targetId });

  if (exist) {
    return bot.sendMessage(msg.chat.id, t(lang, 'already_whitelisted').replace('{id}', targetId));
  }

  await Whitelist.create({ userId: targetId });

  // 🔁 Lien valable 1 heure
  const invite = await bot.createChatInviteLink(config.CHANNEL_ID, {
    member_limit: 1,
    expire_date: Math.floor(Date.now() / 1000) + 3600 // 1 heure
  });

  await Subscriber.findOneAndUpdate(
    { userId: targetId },
    {
      userId: targetId,
      expires: new Date('9999-12-31'),
      inviteLink: invite.invite_link
    },
    { upsert: true }
  );

  bot.sendMessage(msg.chat.id, t(lang, 'whitelisted_success').replace('{id}', targetId));
  bot.sendMessage(targetId, t(lang, 'whitelist_user_notify').replace('{link}', invite.invite_link));
});


// === /unwhitelist <id> ===
bot.onText(/\/unwhitelist (\d+)/, async (msg, match) => {
  const lang = msg.from.language_code || 'fr';
  const adminId = config.ADMIN_ID;

  if (String(msg.from.id) !== String(adminId)) {
    return bot.sendMessage(msg.chat.id, t(lang, 'admin_only'));
  }

  const targetId = match[1];

  const result = await Whitelist.findOneAndDelete({ userId: targetId });
  if (!result) {
    return bot.sendMessage(msg.chat.id, t(lang, 'whitelist_not_found').replace('{id}', targetId));
  }

  bot.sendMessage(msg.chat.id, t(lang, 'whitelist_removed').replace('{id}', targetId));
});

// === Commande /whitelist_liste ===

bot.onText(/\/whitelist_liste/, async (msg) => {
  const lang = msg.from.language_code || 'fr';

  if (!isAdmin(msg.from.id)) {
    return bot.sendMessage(msg.chat.id, t(lang, 'admin_only'));
  }

  const list = await Whitelist.find({});
  if (list.length === 0) {
    return bot.sendMessage(msg.chat.id, t(lang, 'whitelist_empty'));
  }

  const texte = list.map(item => `• ID: ${item.userId}`).join('\n');
  bot.sendMessage(msg.chat.id, `📋 *${t(lang, 'whitelist_current')}* :\n\n${texte}`, { parse_mode: 'Markdown' });
});

// === /stats === 

bot.onText(/\/stats/, async (msg) => {
  if (!isAdmin(msg.from.id)) return;

  const totalSubs = await Subscriber.countDocuments();
  const totalRef = await Referral.countDocuments();
  const totalPending = await Pending.countDocuments();

  const message = `📊 *Statistiques* :
• Abonnés premium : ${totalSubs}
• Références créées : ${totalRef}
• En attente de validation : ${totalPending}`;

  bot.sendMessage(msg.chat.id, message, { parse_mode: 'Markdown' });
});

// === /infos ===
bot.onText(/\/infos/, async (msg) => {
  const lang = msg.from.language_code || 'fr';
  const userId = String(msg.from.id);
  const username = msg.from.username || 'N/A';

  const referral = await Referral.findOne({ userId });
  const sub = await Subscriber.findOne({ userId });

  const infos = [
    `👤 *ID* : ${userId}`,
    `📛 *Nom d'utilisateur* : ${username}`,
    `🔗 *Code promo* : ${referral?.code || 'Aucun'}`,
    `🎫 *Premium* : ${sub ? `jusqu’au ${new Date(sub.expires).toLocaleDateString()}` : 'Non actif'}`
  ].join('\n');

  bot.sendMessage(msg.chat.id, infos, { parse_mode: 'Markdown' });
});

// === Nettoyage liens expirés
bot.onText(/\/nettoie_liens/, async (msg) => {
  const lang = msg.from.language_code || 'fr';

  if (!isAdmin(msg.from.id)) {
    return bot.sendMessage(msg.chat.id, t(lang, 'admin_only'));
  }

  try {
    const now = new Date();
    const expiredLinks = await Invite.find({
      createdAt: { $lte: new Date(now.getTime() - 60 * 60 * 1000) } // > 1h
    });

    let count = 0;

    for (const invite of expiredLinks) {
      try {
        await bot.revokeChatInviteLink(config.CHANNEL_ID, invite.inviteLink);
        await Invite.deleteOne({ _id: invite._id });
        count++;
      } catch (err) {
        console.error(`Erreur suppression du lien ${invite.inviteLink}:`, err.message);
      }
    }

    bot.sendMessage(chatId, t(lang, 'clean_links_done').replace('{count}', deletedCount));

  } catch (err) {
    console.error('❌ Erreur pendant le nettoyage :', err.message);
    bot.sendMessage(msg.chat.id, t(lang, 'error_occurred'));
  }
});
    

// === Nettoyage abonnés expirés (toutes les heures) ===

setInterval(async () => {
  const now = new Date();
  const expiredSubscribers = await Subscriber.find({ expires: { $lt: now } });

  for (const sub of expiredSubscribers) {
    const isWhitelisted = await Whitelist.findOne({ userId: sub.userId });
    if (isWhitelisted) continue;

    try {
      // ❌ Retirer de la chaîne
      await bot.banChatMember(config.CHANNEL_ID, parseInt(sub.userId));
      await bot.unbanChatMember(config.CHANNEL_ID, parseInt(sub.userId));

      // 🔗 Supprimer lien
      const invite = await Invite.findOne({ userId: sub.userId });
      if (invite) {
        if (invite.chatId && invite.messageId) {
          try {
            await bot.deleteMessage(invite.chatId, invite.messageId);
          } catch (err) {
            console.warn(`⚠️ Erreur suppression message (${sub.userId}) : ${err.message}`);
          }
        }

        try {
          const allLinks = await bot.getChatInviteLinks(config.CHANNEL_ID);
          const matching = allLinks.find(link => link.invite_link === invite.inviteLink);
          if (matching) {
            await bot.revokeChatInviteLink(config.CHANNEL_ID, matching.invite_link);
          }
        } catch (err) {
          console.warn(`⚠️ Erreur révocation du lien (${sub.userId}) : ${err.message}`);
        }

        await Invite.deleteOne({ userId: sub.userId });
      }

      // 🧹 Supprimer abonnement
      await Subscriber.deleteOne({ userId: sub.userId });

      // 🔔 Alerter utilisateur
      await bot.sendMessage(sub.userId, t('fr', 'subscription_expired')); // Utilisateur : défaut FR

      // 🔔 Alerter admin
      const adminMessage = `📤 *Abonnement expiré* :
• ID: ${sub.userId}
• Username: ${sub.username || 'N/A'}
⛔ Lien d’accès et abonnement supprimés.`;

      await bot.sendMessage(config.ADMIN_ID, adminMessage, { parse_mode: 'Markdown' });

    } catch (err) {
      console.error(`❌ Erreur nettoyage (${sub.userId}) : ${err.message}`);
    }
  }
}, 3600000); // toutes les heures

// === Callback bouton "J’ai rejoint la chaîne" ===
bot.on('callback_query', async (query) => {
  const userId = String(query.from.id);
  const lang = query.from.language_code || 'fr';

  if (query.data === 'joined_channel') {
    const invite = await Invite.findOne({ userId });

    if (invite && invite.chatId && invite.messageId) {
      try {
        // Supprimer le message avec le lien
        await bot.deleteMessage(invite.chatId, invite.messageId);
        await Invite.deleteOne({ userId });

        // Répondre à l'appui du bouton
        await bot.answerCallbackQuery(query.id, {
          text: t(lang, 'link_deleted'), // ✅ Lien supprimé. Bienvenue dans la chaîne !
          show_alert: false
        });

        // Message privé
        await bot.sendMessage(userId, t(lang, 'joined_success')); // 🎉 Accès confirmé !
      } catch (err) {
        console.error(`❌ Erreur suppression message : ${err.message}`);
        await bot.answerCallbackQuery(query.id, {
          text: t(lang, 'error_occurred') // ❌ Une erreur est survenue
        });
      }
    } else {
      await bot.answerCallbackQuery(query.id, {
        text: t(lang, 'no_pending') // ❌ Lien déjà supprimé ou inexistant.
      });
    }
  }
});

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
