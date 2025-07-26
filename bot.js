// === /abonnement & moyens de paiement ===
bot.onText(/\/abonnement/, (msg) => {
  const imageURL = 'https://files.catbox.moe/4m5nb4.jpg';
  const message = `
💳 *Abonnement Premium* — 1000 FCFA (~$1.60)

📎 Moyens de paiement :
• PayPal : /paypal
• Wave : /wave 🌊
• Orange Money : /om
• MTN Money : /mtn

✅ Clique sur /acces après paiement.`;
  bot.sendPhoto(msg.chat.id, imageURL, { caption: message, parse_mode: "Markdown" });
});

bot.onText(/\/paypal/, (msg) => {
  const text = `🔵 *Paiement PayPal*\n👉 ${config.PAYPAL_LINK}\n💵 1000 FCFA (~$1.60)\nClique /acces après paiement.`;
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
