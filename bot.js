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
import User from './models/User.js';
import Admin from './models/Admin.js';

// 🔐 Vérifie si un utilisateur est admin
async function isAdmin(userId) {
  return String(userId) === config.OWNER_ID || await Admin.exists({ userId });
}

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

// === fonction getUserLang (unique et correcte) ===
async function getUserLang(userId, fallback = 'fr') {
  const user = await User.findOne({ userId });
  return (user && user.lang) || fallback;
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
  const username = msg.from.username || `ID:${userId}`;
  const refCode = match ? match[1] : null;

  // 🟢 Détecter la langue via base de données
  const lang = await getUserLang(userId, msg.from.language_code);

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
  const lang = await getUserLang(userId, msg.from.language_code);

  let text = t(lang, 'help_base');

  if (String(config.ADMIN_ID) === userId) {
    text += '\n\n' + t(lang, 'help_admin');
  }

  bot.sendMessage(msg.chat.id, text, {
    parse_mode: "MarkdownV2"
  });
});

// === /codepromo ===
bot.onText(/\/codepromo/, async (msg) => {
  const userId = String(msg.from.id);
  const username = msg.from.username || `ID:${userId}`;
  const lang = await getUserLang(userId, msg.from.language_code);

  let referral = await Referral.findOne({ userId });

  if (!referral) {
    referral = new Referral({
      userId,
      username,
      code: crypto.randomBytes(4).toString('hex').toUpperCase(),
      filleuls: []
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
  const lang = await getUserLang(userId, msg.from.language_code);

  let referral = await Referral.findOne({ userId });

  if (!referral) {
    referral = new Referral({
      userId,
      username,
      code: crypto.randomBytes(4).toString('hex').toUpperCase(),
      filleuls: []
    });
    await referral.save();
  }

  const code = referral.code;
  const startLink = `https://t.me/${config.BOT_USERNAME}?start=${code}`;
  const message = `${t(lang, 'invite_friends')}\n${startLink}\n\n${t(lang, 'free_month_reward')}`;

  bot.sendMessage(msg.chat.id, message);
});

// === /mesfilleuls ===
bot.onText(/\/mesfilleuls/, async (msg) => {
  const userId = String(msg.from.id);
  const lang = await getUserLang(userId, msg.from.language_code);

  const data = await Referral.findOne({ userId });

  if (!data || !Array.isArray(data.filleuls) || data.filleuls.length === 0) {
    return bot.sendMessage(msg.chat.id, t(lang, 'no_referrals'));
  }

  const filleulsList = data.filleuls.map(id => `- ID: ${id}`).join('\n');
  const response = `${t(lang, 'referral_count').replace('{count}', data.filleuls.length)}\n${filleulsList}`;

  bot.sendMessage(msg.chat.id, response);
});
// === /abonnement ===
bot.onText(/\/abonnement/, async (msg) => {
  const userId = String(msg.from.id);
  const user = await User.findOne({ userId });
  const lang = user?.lang || msg.from.language_code || 'fr';

  if (isAdmin(userId)) {
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
bot.onText(/\/abonnement/, async (msg) => {
  const userId = String(msg.from.id);
  const lang = await getUserLang(userId, msg.from.language_code);

  if (isAdmin(userId)) {
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
bot.onText(/\/paypal/, async (msg) => {
  const lang = await getUserLang(msg.from.id, msg.from.language_code);
  const text = t(lang, 'paypal_text').replace('{link}', config.PAYPAL_LINK);
  bot.sendMessage(msg.chat.id, text, { parse_mode: "Markdown" });
});

bot.onText(/\/wave/, async (msg) => {
  const lang = await getUserLang(msg.from.id, msg.from.language_code);
  const text = t(lang, 'wave_text').replace('{number}', config.WAVE_NUMBER);
  bot.sendMessage(msg.chat.id, text, { parse_mode: "Markdown" });
});

bot.onText(/\/om/, async (msg) => {
  const lang = await getUserLang(msg.from.id, msg.from.language_code);
  const text = t(lang, 'om_text').replace('{number}', config.OM_NUMBER);
  bot.sendMessage(msg.chat.id, text, { parse_mode: "Markdown" });
});

bot.onText(/\/mtn/, async (msg) => {
  const lang = await getUserLang(msg.from.id, msg.from.language_code);
  const text = t(lang, 'mtn_text').replace('{number}', config.MTN_NUMBER);
  bot.sendMessage(msg.chat.id, text, { parse_mode: "Markdown" });
});

// === /preuve ===
bot.onText(/\/preuve(?: (.+))?/, async (msg, match) => {
  const userId = String(msg.from.id);
  const username = msg.from.username || `ID:${userId}`;
  const chatId = msg.chat.id;
  const proofText = match?.[1];
  const lang = await getUserLang(userId, msg.from.language_code);

  if (isAdmin(userId)) {
    return bot.sendMessage(chatId, t(lang, 'admin_no_proof'));
  }

  if (!proofText || proofText.length < 3) {
    return bot.sendMessage(chatId, t(lang, 'proof_missing'));
  }

  await Pending.findOneAndUpdate(
    { userId },
    {
      username,
      chatId,
      proof: proofText,
      requestedAt: new Date()
    },
    { upsert: true }
  );

  await bot.sendMessage(chatId, t(lang, 'proof_received'));

  if (config.ADMIN_ID) {
    const alert = `🔔 Nouvelle preuve de paiement reçue\n👤 *${username}* (ID: ${userId})\n\n📩 _${proofText}_\n\n👉 /valider ${userId}\n❌ /rejeter ${userId} raison`;
    bot.sendMessage(config.ADMIN_ID, alert, { parse_mode: 'Markdown' });
  }
});

// === /lang ===
bot.onText(/\/lang (fr|en)/, async (msg, match) => {
  const userId = String(msg.from.id);
  const lang = match[1];

  await User.findOneAndUpdate(
    { userId },
    { userId, lang },
    { upsert: true }
  );

  const confirmation = lang === 'fr' ? '✅ Langue mise à jour en *Français*' : '✅ Language updated to *English*';
  bot.sendMessage(msg.chat.id, confirmation, { parse_mode: 'Markdown' });
});

// === /backup (réservé à l’admin) ===
bot.onText(/\/backup/, async (msg) => {
  const userId = String(msg.from.id);
  const lang = msg.from.language_code || 'fr';

  if (!await isAdmin(userId)) {
    return bot.sendMessage(msg.chat.id, t(lang, 'admin_only'));
  }

  try {
    // Étape 1 : Récupérer les données MongoDB
    const [subscribers, referrals, pending, whitelist] = await Promise.all([
      Subscriber.find().lean(),
      Referral.find().lean(),
      Pending.find().lean(),
      Whitelist.find().lean()
    ]);

    // Étape 2 : Écrire les fichiers JSON temporairement
    fs.writeFileSync('./subscribers.json', JSON.stringify(subscribers, null, 2));
    fs.writeFileSync('./referrals.json', JSON.stringify(referrals, null, 2));
    fs.writeFileSync('./pending.json', JSON.stringify(pending, null, 2));
    fs.writeFileSync('./whitelist.json', JSON.stringify(whitelist, null, 2));

    // Étape 3 : Créer le fichier zip
    const zipPath = './𝑩𝒂𝒄𝒌𝒖𝒑_𝑷𝒓𝒆𝒎-𝒃𝒐𝒕.zip';
    const output = fs.createWriteStream(zipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    archive.pipe(output);
    archive.file('./subscribers.json', { name: 'subscribers.json' });
    archive.file('./referrals.json', { name: 'referrals.json' });
    archive.file('./pending.json', { name: 'pending.json' });
    archive.file('./whitelist.json', { name: 'whitelist.json' });

    await archive.finalize();

    // 🟡 Attendre que le fichier soit bien fermé
    await new Promise((resolve, reject) => {
      output.on('close', resolve);
      archive.on('error', reject);
    });

    // Étape 4 : Envoi à l’admin
    await bot.sendDocument(msg.chat.id, zipPath, {
      caption: t(lang, 'backup_success'),
      filename: '𝑩𝒂𝒄𝒌𝒖𝒑_𝑷𝒓𝒆𝒎-𝒃𝒐𝒕.zip',
      contentType: 'application/zip'
    });

    // Étape 5 : Nettoyage
    fs.unlinkSync('./subscribers.json');
    fs.unlinkSync('./referrals.json');
    fs.unlinkSync('./pending.json');
    fs.unlinkSync('./whitelist.json');
    fs.unlinkSync(zipPath);

  } catch (err) {
    console.error('Erreur dans /backup :', err);
    bot.sendMessage(msg.chat.id, t(lang, 'error_occurred'));
  }
});

// === /acces ===
bot.onText(/\/acces/, async (msg) => {
  const userId = String(msg.from.id);
  const chatId = msg.chat.id;

  // 🔁 Langue depuis DB ou fallback
  const userLangData = await User.findOne({ userId });
  const lang = userLangData?.lang || (msg.from.language_code?.startsWith('en') ? 'en' : 'fr');

  if (isAdmin(userId)) {
    return bot.sendMessage(chatId, `✅ ${t(lang, 'admin_access')}:\n${config.CHANNEL_LINK}`);
  }

  try {
    const user = await Subscriber.findOne({ userId });

    // ❌ Aucune souscription ou expirée
    if (!user || new Date(user.expires) < new Date()) {
      return bot.sendMessage(chatId,
        `${t(lang, 'subscription_expired')}\n\n` +
        `${t(lang, 'please_pay')} /abonnement\n` +
        `${t(lang, 'send_proof')} /preuve`
      );
    }

    // 🔒 Vérifie si l’utilisateur est déjà dans la chaîne
    const member = await bot.getChatMember(config.CHANNEL_ID, parseInt(userId));
    if (["member", "administrator", "creator"].includes(member.status)) {
      return bot.sendMessage(chatId, `✅ ${t(lang, 'access_granted')}`);
    }

    const now = new Date();
    const invite = await Invite.findOne({ userId });

    // 🔁 Si un lien encore valide existe, on le renvoie
    if (invite && invite.expiresAt && new Date(invite.expiresAt) > now) {
      return bot.sendMessage(chatId, `✅ ${t(lang, 'valid_invite')}\n${invite.inviteLink}`, {
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: `✅ ${t(lang, 'joined_button')}`,
                callback_data: "joined_channel"
              }
            ]
          ]
        }
      });
    }

    // ❌ Si un lien a déjà été généré mais expiré → ne PAS en régénérer
    if (invite && invite.expiresAt && new Date(invite.expiresAt) <= now) {
      return bot.sendMessage(chatId, `❌ ${t(lang, 'subscription_expired')} (${t(lang, 'link_deleted')})`);
    }

    // ✅ Sinon, créer un nouveau lien une seule fois
    const expireTimestamp = Math.floor(Date.now() / 1000) + 3600;
    const inviteLinkData = await bot.createChatInviteLink(config.CHANNEL_ID, {
      member_limit: 1,
      creates_join_request: false,
      expire_date: expireTimestamp
    });

    const inviteLink = inviteLinkData.invite_link;

    const sent = await bot.sendMessage(chatId, `✅ ${t(lang, 'new_invite')}\n${inviteLink}`, {
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: `✅ ${t(lang, 'joined_button')}`,
              callback_data: "joined_channel"
            }
          ]
        ]
      }
    });

    // 💾 Enregistrer le lien d’invitation
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
    console.error('Erreur /acces:', err);
    bot.sendMessage(chatId, `❌ ${t(lang, 'error_occurred')}`);
  }
});


// === /valider <id> ===
bot.onText(/\/valider (\d+)/, async (msg, match) => {
  const adminId = String(msg.from.id);
  const userId = String(match[1]);
  const lang = await getUserLang(adminId, msg.from.language_code);

  if (!await isAdmin(adminId)) {
    return bot.sendMessage(msg.chat.id, t(lang, 'admin_only'));
  }

  try {
    const pending = await Pending.findOne({ userId });
    if (!pending) {
      return bot.sendMessage(msg.chat.id, t(lang, 'no_pending'));
    }

    const expiration = new Date();
    expiration.setDate(expiration.getDate() + 30);

    await Subscriber.findOneAndUpdate(
      { userId },
      {
        userId,
        username: pending.username,
        expires: expiration
      },
      { upsert: true }
    );

    await Pending.deleteOne({ userId });

    const userLang = await getUserLang(userId); // langue du bénéficiaire

    await bot.sendMessage(userId, t(userLang, 'subscription_validated'));
    await bot.sendMessage(msg.chat.id, `✅ ${t(lang, 'subscription_validated_admin')} @${pending.username || userId} (ID: ${userId})`);

  } catch (err) {
    console.error('Erreur validation abonnement:', err);
    bot.sendMessage(msg.chat.id, t(lang, 'error_occurred'));
  }
});

// === /rejeter ===
bot.onText(/\/rejeter (\d+) (.+)/, async (msg, match) => {
  const adminId = String(msg.from.id);
  const userId = String(match[1]);
  const reason = match[2].trim();

  const lang = await getUserLang(adminId, msg.from.language_code);

  if (!await isAdmin(adminId)) {
    return bot.sendMessage(msg.chat.id, t(lang, 'admin_only'));
  }

  try {
    const request = await Pending.findOne({ userId });
    if (!request) {
      return bot.sendMessage(msg.chat.id, t(lang, 'no_pending'));
    }

    await Pending.deleteOne({ userId });

    const userLang = await getUserLang(userId);

    await bot.sendMessage(
      request.chatId,
      `❌ ${t(userLang, 'rejected_user')}\n📌 *${t(userLang, 'reason')}:* ${reason}`,
      { parse_mode: "Markdown" }
    );

    const username = request.username ? `@${request.username}` : `ID:${userId}`;
    await bot.sendMessage(
      msg.chat.id,
      `❌ ${t(lang, 'rejected_admin')} ${username}\n📌 *${t(lang, 'reason')}:* ${reason}`,
      { parse_mode: "Markdown" }
    );

  } catch (err) {
    console.error('❌ Erreur /rejeter :', err);
    bot.sendMessage(msg.chat.id, t(lang, 'error_occurred'));
  }
});

// === /status ===
bot.onText(/\/status/, async (msg) => {
  const userId = String(msg.from.id);
  const lang = await getUserLang(userId, msg.from.language_code);

  if (isAdmin(userId)) {
    return bot.sendMessage(msg.chat.id, `👑 ${t(lang, 'status_admin')}`, { parse_mode: 'Markdown' });
  }

  const sub = await Subscriber.findOne({ userId });
  const now = new Date();

  if (sub && new Date(sub.expires) > now) {
    const dateStr = new Date(sub.expires).toLocaleString(lang === 'fr' ? 'fr-FR' : 'en-US');
    return bot.sendMessage(
      msg.chat.id,
      `✅ ${t(lang, 'status_active')} *${dateStr}*`,
      { parse_mode: 'Markdown' }
    );
  } else {
    return bot.sendMessage(msg.chat.id, t(lang, 'status_expired'));
  }
});


// === /prem ===
bot.onText(/\/prem (\d+)/, async (msg, match) => {
  const adminId = String(msg.from.id);
  const lang = await getUserLang(adminId, msg.from.language_code);
  const userId = String(match[1]);

  if (!await isAdmin(adminId)) {
    return bot.sendMessage(msg.chat.id, t(lang, 'admin_only'));
  }

  try {
    const ref = await Referral.findOne({ userId });
    const username = ref?.username || `ID:${userId}`;
    const expires = getExpirationDate(30); // +30 jours

    // 📌 Mise à jour/ajout du premium
    await Subscriber.findOneAndUpdate(
      { userId },
      { username, expires },
      { upsert: true, new: true }
    );

    const userLang = await getUserLang(userId);

    // 👀 Est-ce que l'utilisateur est déjà dans la chaîne ?
    try {
      const member = await bot.getChatMember(config.CHANNEL_ID, parseInt(userId));
      if (["member", "administrator", "creator"].includes(member.status)) {
        await bot.sendMessage(userId, t(userLang, 'prem_user'));
        return bot.sendMessage(msg.chat.id, `✅ ${t(lang, 'prem_admin')} ${username}`);
      }
    } catch (e) {
      // S'il n'est pas dans le canal, on vérifie le lien
    }

    const now = new Date();
    const invite = await Invite.findOne({ userId });

    // 🔁 Si lien encore valide, on le renvoie
    if (invite && invite.expiresAt && new Date(invite.expiresAt) > now) {
      await bot.sendMessage(userId, `${t(userLang, 'new_invite')}\n${invite.inviteLink}`, {
        reply_markup: {
          inline_keyboard: [[{ text: `✅ ${t(userLang, 'joined_button')}`, callback_data: "joined_channel" }]]
        }
      });
      return bot.sendMessage(msg.chat.id, `✅ ${t(lang, 'prem_admin')} ${username}`);
    }

    // ❌ S'il a déjà eu un lien mais expiré → ne PAS en régénérer
    if (invite && invite.expiresAt && new Date(invite.expiresAt) <= now) {
      await bot.sendMessage(msg.chat.id, `⚠️ ${username} a déjà eu un lien expiré. Il doit demander l’accès manuellement.`);
      return;
    }

    // ✅ Générer un nouveau lien si nécessaire
    const expireTimestamp = Math.floor(Date.now() / 1000) + 3600;
    const inviteLinkData = await bot.createChatInviteLink(config.CHANNEL_ID, {
      member_limit: 1,
      creates_join_request: false,
      expire_date: expireTimestamp
    });

    const inviteLink = inviteLinkData.invite_link;

    await bot.sendMessage(userId, `${t(userLang, 'new_invite')}\n${inviteLink}`, {
      reply_markup: {
        inline_keyboard: [[{ text: `✅ ${t(userLang, 'joined_button')}`, callback_data: "joined_channel" }]]
      }
    });

    const sent = await bot.sendMessage(msg.chat.id, `✅ ${t(lang, 'prem_admin')} ${username}`);

    await Invite.findOneAndUpdate(
      { userId },
      {
        userId,
        inviteLink,
        messageId: sent.message_id,
        chatId: msg.chat.id,
        expiresAt: new Date(Date.now() + 3600 * 1000)
      },
      { upsert: true }
    );

  } catch (err) {
    console.error('Erreur /prem :', err);
    bot.sendMessage(msg.chat.id, `❌ ${t(lang, 'error_occurred')}`);
  }
});

// === /unprem ===
bot.onText(/\/unprem (\d+)/, async (msg, match) => {
  const adminId = String(msg.from.id);
  const userId = String(match[1]);
  const lang = await getUserLang(adminId, msg.from.language_code);

  if (!await isAdmin(adminId)) {
    return bot.sendMessage(msg.chat.id, t(lang, 'admin_only'));
  }

  const sub = await Subscriber.findOne({ userId });

  if (!sub) {
    return bot.sendMessage(msg.chat.id, t(lang, 'no_active_subscription'));
  }

  await Subscriber.deleteOne({ userId });

  try {
    await bot.banChatMember(config.CHANNEL_ID, parseInt(userId));   // kick
    await bot.unbanChatMember(config.CHANNEL_ID, parseInt(userId)); // débloque

    const userLang = await getUserLang(userId);
    await bot.sendMessage(userId, t(userLang, 'unprem_user'));
    await bot.sendMessage(msg.chat.id, `❌ ${t(lang, 'unprem_admin')} ${sub.username || 'ID:' + userId}`);
  } catch (err) {
    console.error('Erreur unprem:', err);
    bot.sendMessage(msg.chat.id, `❌ ${t(lang, 'unprem_error')} ${err.message}`);
  }
});

// === /abonnes ===
bot.onText(/\/abonnes/, async (msg) => {
  const adminId = String(msg.from.id);
  const lang = await getUserLang(adminId, msg.from.language_code);

  if (!await isAdmin(adminId)) {
    return bot.sendMessage(msg.chat.id, t(lang, 'admin_only'));
  }

  const abonnés = await Subscriber.find({});
  const total = abonnés.length;

  if (total === 0) {
    return bot.sendMessage(msg.chat.id, t(lang, 'no_premium_users'));
  }

  const liste = abonnés.map(sub => {
    const date = new Date(sub.expires).toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-US');
    return `• ${sub.username || 'ID:' + sub.userId}\n  ${t(lang, 'expires')}: ${date}`;
  }).join('\n\n');

  const message = `📋 *${t(lang, 'premium_list')}* (${total}) :\n\n${liste}`;

  bot.sendMessage(msg.chat.id, message, { parse_mode: 'Markdown' });
});

// === /whitelist <id> ===
bot.onText(/\/whitelist (\d+)/, async (msg, match) => {
  const adminId = String(msg.from.id);
  const lang = await getUserLang(adminId, msg.from.language_code);
  const targetId = match[1];

  if (!await isAdmin(adminId)) {
    return bot.sendMessage(msg.chat.id, t(lang, 'admin_only'));
  }

  const already = await Whitelist.findOne({ userId: targetId });
  if (already) {
    return bot.sendMessage(msg.chat.id, t(lang, 'already_whitelisted').replace('{id}', targetId));
  }

  try {
    // 👀 Vérifie si l'utilisateur est déjà dans la chaîne
    try {
      const member = await bot.getChatMember(config.CHANNEL_ID, parseInt(targetId));
      if (["member", "administrator", "creator"].includes(member.status)) {
        await Whitelist.create({ userId: targetId });

        await Subscriber.findOneAndUpdate(
          { userId: targetId },
          {
            userId: targetId,
            expires: new Date('9999-12-31'),
            inviteLink: null
          },
          { upsert: true }
        );

        return bot.sendMessage(msg.chat.id, `✅ ${t(lang, 'whitelisted_success').replace('{id}', targetId)}`);
      }
    } catch (e) {
      // S’il n’est pas dans le canal, continuer
    }

    const now = new Date();
    const existingInvite = await Invite.findOne({ userId: targetId });

    // 🔁 Si lien actif déjà existant
    if (existingInvite && existingInvite.expiresAt && new Date(existingInvite.expiresAt) > now) {
      await Whitelist.create({ userId: targetId });

      await Subscriber.findOneAndUpdate(
        { userId: targetId },
        {
          userId: targetId,
          expires: new Date('9999-12-31'),
          inviteLink: existingInvite.inviteLink
        },
        { upsert: true }
      );

      const userLang = await getUserLang(targetId);
      await bot.sendMessage(targetId, t(userLang, 'whitelist_user_notify').replace('{link}', existingInvite.inviteLink));

      return bot.sendMessage(msg.chat.id, `✅ ${t(lang, 'whitelisted_success').replace('{id}', targetId)}`);
    }

    // ❌ Si un lien expiré existe, ne pas recréer un lien
    if (existingInvite && new Date(existingInvite.expiresAt) <= now) {
      return bot.sendMessage(msg.chat.id, `⚠️ Le lien pour ${targetId} a expiré. Aucun nouveau lien ne sera généré.`);
    }

    // ✅ Créer un nouveau lien temporaire
    const expireTimestamp = Math.floor(Date.now() / 1000) + 3600;
    const invite = await bot.createChatInviteLink(config.CHANNEL_ID, {
      member_limit: 1,
      expire_date: expireTimestamp
    });

    const inviteLink = invite.invite_link;

    const sent = await bot.sendMessage(targetId, t(await getUserLang(targetId), 'whitelist_user_notify').replace('{link}', inviteLink), {
      reply_markup: {
        inline_keyboard: [
          [{ text: `✅ ${t(lang, 'joined_button')}`, callback_data: 'joined_channel' }]
        ]
      }
    });

    // 💾 Enregistrement dans Whitelist, Invite & Subscriber
    await Whitelist.create({ userId: targetId });

    await Subscriber.findOneAndUpdate(
      { userId: targetId },
      {
        userId: targetId,
        expires: new Date('9999-12-31'),
        inviteLink
      },
      { upsert: true }
    );

    await Invite.findOneAndUpdate(
      { userId: targetId },
      {
        userId: targetId,
        inviteLink,
        messageId: sent.message_id,
        chatId: targetId,
        expiresAt: new Date(Date.now() + 3600 * 1000)
      },
      { upsert: true }
    );

    await bot.sendMessage(msg.chat.id, `✅ ${t(lang, 'whitelisted_success').replace('{id}', targetId)}`);
    
  } catch (err) {
    console.error('Erreur /whitelist :', err.message);
    bot.sendMessage(msg.chat.id, t(lang, 'error_occurred'));
  }
});


// === /unwhitelist <id> ===
bot.onText(/\/unwhitelist (\d+)/, async (msg, match) => {
  const adminId = String(msg.from.id);
  const lang = await getUserLang(adminId, msg.from.language_code);
  const targetId = match[1];

  if (!await isAdmin(adminId)) {
    return bot.sendMessage(msg.chat.id, t(lang, 'admin_only'));
  }

  const result = await Whitelist.findOneAndDelete({ userId: targetId });

  if (!result) {
    return bot.sendMessage(msg.chat.id, t(lang, 'whitelist_not_found').replace('{id}', targetId));
  }

  // Supprime également l’abonnement illimité (si existant)
  await Subscriber.deleteOne({ userId: targetId });

  try {
    // Retire l'accès au canal
    await bot.banChatMember(config.CHANNEL_ID, parseInt(targetId));
    await bot.unbanChatMember(config.CHANNEL_ID, parseInt(targetId));

    const userLang = await getUserLang(targetId);
    await bot.sendMessage(targetId, t(userLang, 'unwhitelist_user_notify'));

    bot.sendMessage(msg.chat.id, t(lang, 'unwhitelist_success').replace('{id}', targetId));
  } catch (err) {
    console.error('Erreur /unwhitelist :', err.message);
    bot.sendMessage(msg.chat.id, `${t(lang, 'unprem_error')} ${err.message}`);
  }
});

// === Commande /whitelist_liste ===
bot.onText(/\/whitelist_liste/, async (msg) => {
  const lang = await getUserLang(msg.from.id, msg.from.language_code);

  if (!await isAdmin(msg.from.id)) {
    return bot.sendMessage(msg.chat.id, t(lang, 'admin_only'));
  }

  const list = await Whitelist.find({});
  if (!list || list.length === 0) {
    return bot.sendMessage(msg.chat.id, t(lang, 'whitelist_empty'));
  }

  const texte = list.map(item => `• ID: \`${item.userId}\``).join('\n');
  const message = `📋 *${t(lang, 'whitelist_current')}* :\n\n${texte}`;
  bot.sendMessage(msg.chat.id, message, { parse_mode: 'Markdown' });
});

// === /stats ===
bot.onText(/\/stats/, async (msg) => {
  const lang = await getUserLang(msg.from.id, msg.from.language_code);

  if (!await isAdmin(msg.from.id)) return bot.sendMessage(msg.chat.id, t(lang, 'admin_only'));

  const [totalSubs, totalRef, totalPending] = await Promise.all([
    Subscriber.countDocuments(),
    Referral.countDocuments(),
    Pending.countDocuments()
  ]);

  const message = `📊 *${t(lang, 'stats_title')}* :
• ${t(lang, 'stats_subs')} : ${totalSubs}
• ${t(lang, 'stats_refs')} : ${totalRef}
• ${t(lang, 'stats_pending')} : ${totalPending}`;

  bot.sendMessage(msg.chat.id, message, { parse_mode: 'Markdown' });
});

// === /infos ===
bot.onText(/\/infos/, async (msg) => {
  const lang = await getUserLang(msg.from.id, msg.from.language_code);
  const userId = String(msg.from.id);
  const username = msg.from.username || 'N/A';

  const referral = await Referral.findOne({ userId });
  const sub = await Subscriber.findOne({ userId });

  const premiumText = sub
    ? `${t(lang, 'until')} *${new Date(sub.expires).toLocaleDateString()}*`
    : t(lang, 'not_active');

  const infos = [
    `👤 *ID* : \`${userId}\``,
    `📛 *Username* : @${username}`,
    `🔗 *${t(lang, 'promo_code')}* : *${referral?.code || t(lang, 'none')}*`,
    `🎫 *Premium* : ${premiumText}`
  ].join('\n');

  bot.sendMessage(msg.chat.id, infos, { parse_mode: 'Markdown' });
});

//=== addadmin ===
bot.onText(/\/addadmin (\d+)/, async (msg, match) => {
  const ownerId = String(msg.from.id);
  const lang = await getUserLang(ownerId, msg.from.language_code);
  const targetId = match[1];

  if (ownerId !== config.OWNER_ID) {
    return bot.sendMessage(msg.chat.id, t(lang, 'owner_only'));
  }

  const exists = await Admin.exists({ userId: targetId });
  if (exists) {
    return bot.sendMessage(msg.chat.id, t(lang, 'already_admin').replace('{id}', targetId));
  }

  await Admin.create({ userId: targetId });
  bot.sendMessage(msg.chat.id, t(lang, 'admin_added').replace('{id}', targetId));
});

// === deladmin ===
bot.onText(/\/deladmin (\d+)/, async (msg, match) => {
  const ownerId = String(msg.from.id);
  const lang = await getUserLang(ownerId, msg.from.language_code);
  const targetId = match[1];

  if (ownerId !== config.OWNER_ID) {
    return bot.sendMessage(msg.chat.id, t(lang, 'owner_only'));
  }

  const result = await Admin.deleteOne({ userId: targetId });

  if (result.deletedCount > 0) {
    bot.sendMessage(msg.chat.id, t(lang, 'admin_removed').replace('{id}', targetId));
  } else {
    bot.sendMessage(msg.chat.id, t(lang, 'not_admin').replace('{id}', targetId));
  }
});

// === admin ===
bot.onText(/\/admins/, async (msg) => {
  const userId = String(msg.from.id);
  const lang = await getUserLang(userId, msg.from.language_code);

  if (!await isAdmin(userId)) {
    return bot.sendMessage(msg.chat.id, t(lang, 'admin_only'));
  }

  const admins = await Admin.find({});
  const count = admins.length;

  if (count === 0) {
    return bot.sendMessage(msg.chat.id, t(lang, 'no_admins'));
  }

  const list = admins.map((a, i) => `👤 ${i + 1}. ID: \`${a.userId}\``).join('\n');

  const response = `👮‍♂️ *${t(lang, 'admin_list')}* (${count}):\n\n${list}\n\n👑 *OWNER:* \`${config.OWNER_ID}\``;

  bot.sendMessage(msg.chat.id, response, { parse_mode: 'Markdown' });
});

// === /nettoie_liens ===
bot.onText(/\/nettoie_liens/, async (msg) => {
  const lang = await getUserLang(msg.from.id, msg.from.language_code);

  if (!await isAdmin(msg.from.id)) {
    return bot.sendMessage(msg.chat.id, t(lang, 'admin_only'));
  }

  try {
    const now = new Date();

    const expiredLinks = await Invite.find({
      expiresAt: { $lte: now }
    });

    console.log(`[NETTOYAGE] ${expiredLinks.length} lien(s) trouvé(s) à supprimer`);

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

    return bot.sendMessage(msg.chat.id, t(lang, 'clean_links_done').replace('{count}', count));
  } catch (err) {
    console.error('❌ Erreur nettoyage :', err.message);
    return bot.sendMessage(msg.chat.id, t(lang, 'error_occurred'));
  }
});

// === Nettoyage abonnés expirés (chaque heure) ===
setInterval(async () => {
  const now = new Date();
  const expiredSubscribers = await Subscriber.find({ expires: { $lt: now } });

  for (const sub of expiredSubscribers) {
    const userId = String(sub.userId);

    // 🔒 Ne pas supprimer si dans la whitelist
    const isWhitelisted = await Whitelist.findOne({ userId });
    if (isWhitelisted) continue;

    try {
      // 🚫 Expulsion de la chaîne
      await bot.banChatMember(config.CHANNEL_ID, parseInt(userId));
      await bot.unbanChatMember(config.CHANNEL_ID, parseInt(userId));

      // 🔗 Suppression du lien
      const invite = await Invite.findOne({ userId });
      if (invite) {
        if (invite.chatId && invite.messageId) {
          try {
            await bot.deleteMessage(invite.chatId, invite.messageId);
          } catch (err) {
            console.warn(`⚠️ Erreur suppression message (${userId}) : ${err.message}`);
          }
        }

        try {
          const allLinks = await bot.getChatInviteLinks(config.CHANNEL_ID);
          const matching = allLinks.find(link => link.invite_link === invite.inviteLink);
          if (matching) {
            await bot.revokeChatInviteLink(config.CHANNEL_ID, matching.invite_link);
          }
        } catch (err) {
          console.warn(`⚠️ Erreur révocation du lien (${userId}) : ${err.message}`);
        }

        await Invite.deleteOne({ userId });
      }

      // 🧹 Suppression de l’abonnement
      await Subscriber.deleteOne({ userId });

      // ✅ Récupération langue personnalisée
      const targetLang = await getUserLang(userId);
      await bot.sendMessage(userId, t(targetLang, 'subscription_expired'));

      // 🔔 Notifier admin
      const adminMessage = `📤 *Abonnement expiré* :
• ID: \`${userId}\`
• Username: @${sub.username || 'N/A'}
⛔ Lien d’accès et abonnement supprimés.`;

      await bot.sendMessage(config.ADMIN_ID, adminMessage, { parse_mode: 'Markdown' });

    } catch (err) {
      console.error(`❌ Erreur nettoyage (${userId}) : ${err.message}`);
    }
  }
}, 3600000); // Toutes les heures

// === Callback: bouton "J’ai rejoint la chaîne" + /lang
bot.on('callback_query', async (query) => {
  const userId = String(query.from.id);
  const lang = query.from.language_code || 'fr';
  const chatId = query.message.chat.id;

  // 1️⃣ Callback : "J’ai rejoint la chaîne"
  if (query.data === 'joined_channel') {
    const invite = await Invite.findOne({ userId });

    try {
      // 🔒 Vérifie s’il est dans la chaîne
      const status = await bot.getChatMember(config.CHANNEL_ID, parseInt(userId));
      const isMember = ["member", "administrator", "creator"].includes(status.status);

      if (!isMember) {
        return await bot.answerCallbackQuery(query.id, {
          text: lang === 'fr'
            ? "❌ Tu n’as pas encore rejoint la chaîne."
            : "❌ You haven’t joined the channel yet.",
          show_alert: true
        });
      }

      if (invite && invite.chatId && invite.messageId) {
        await bot.deleteMessage(invite.chatId, invite.messageId);
        await Invite.deleteOne({ userId });
      }

      await bot.answerCallbackQuery(query.id, {
        text: t(lang, 'link_deleted'),
        show_alert: false
      });

      await bot.sendMessage(userId, t(lang, 'joined_success'));

    } catch (err) {
      console.error(`❌ Erreur dans joined_channel : ${err.message}`);
      await bot.answerCallbackQuery(query.id, {
        text: t(lang, 'error_occurred'),
        show_alert: true
      });
    }
  }

  // 2️⃣ Callback pour changement de langue
  else if (query.data.startsWith("lang_")) {
    const newLang = query.data.split("_")[1];

    try {
      await User.findOneAndUpdate(
        { userId },
        { lang: newLang },
        { upsert: true }
      );

      const confirmMsg = newLang === 'fr'
        ? "✅ Langue définie sur *Français*."
        : "✅ Language set to *English*.";

      await bot.editMessageText(confirmMsg, {
        chat_id: chatId,
        message_id: query.message.message_id,
        parse_mode: "Markdown"
      });

      await bot.answerCallbackQuery(query.id); // Ferme le "loading"
    } catch (err) {
      console.error("❌ Erreur changement langue :", err.message);
      await bot.answerCallbackQuery(query.id, {
        text: t(lang, 'error_occurred'),
        show_alert: true
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
