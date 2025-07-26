// ... (tout ton code précédent inchangé)

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

// =========================
// 🔁 Code de parrainage
// =========================
const referralPath = './referrals.json';
let referrals = fs.existsSync(referralPath) ? JSON.parse(fs.readFileSync(referralPath)) : {};

function saveReferrals() {
  fs.writeFileSync(referralPath, JSON.stringify(referrals, null, 2));
}

bot.onText(/\/codepromo/, (msg) => {
  const userId = msg.from.id.toString();
  const code = `OBITO-${userId}`;
  bot.sendMessage(msg.chat.id, `🎁 Ton code promo est : \`${code}\`\nPartage ce lien à tes amis :\nhttps://t.me/${config.BOT_USERNAME}?start=${code}`, { parse_mode: "Markdown" });
});

bot.onText(/\/mesfilleuls/, (msg) => {
  const userId = msg.from.id.toString();
  const count = referrals[userId]?.length || 0;
  bot.sendMessage(msg.chat.id, `👥 Tu as invité ${count} personne(s).`);

  if (count >= 3 && !(subscribers[userId])) {
    const exp = getExpirationDate();
    subscribers[userId] = { username: msg.from.username || `ID:${userId}`, expires: exp };
    saveSubscribers();
    bot.sendMessage(msg.chat.id, `🎉 Tu as gagné 1 mois gratuit ! Voici ton lien :\n${config.CHANNEL_LINK}`);
  }
});

bot.onText(/\/start (.+)/, (msg, match) => {
  const refCode = match[1];
  const inviterId = refCode.replace('OBITO-', '');
  const newUserId = msg.from.id.toString();

  if (inviterId !== newUserId) {
    if (!referrals[inviterId]) referrals[inviterId] = [];
    if (!referrals[inviterId].includes(newUserId)) {
      referrals[inviterId].push(newUserId);
      saveReferrals();
    }
  }

  // ensuite, on renvoie le menu de base
  const image = 'https://files.catbox.moe/dsmhrq.jpg';
  const menu = `
╔════════════════════
║—͟͟͞͞➸⃝LORD_OBITO_TECH_PREM_BOT⍣⃝💀
╠════════════════════
║ ✞︎ /abonnement — Voir les moyens de paiement
║ ✞︎ /status — Vérifier ton abonnement
║ ✞︎ /promo — Gagne 1 mois gratuit
║ ✞︎ /codepromo — Génère ton code
║ ✞︎ /mesfilleuls — Voir tes filleuls
╚════════════════════════

© BY ✞︎ 𝙇𝙊𝙍𝘿 𝙊𝘽𝙄𝙏𝙊 𝘿𝙀𝙑 ✞
`;
  bot.sendPhoto(msg.chat.id, image, {
    caption: menu,
    parse_mode: "Markdown"
  });
});

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
