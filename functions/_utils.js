export async function sendTelegramNotification(env, message) {
  const botToken = env.TELEGRAM_BOT_TOKEN;
  const chatId = env.TELEGRAM_CHAT_ID;
  if (!botToken || !chatId) {
    console.warn("Telegram config missing");
    return;
  }
  const url = `https://api.telegram.org/bot${botToken}/sendMessage?chat_id=${chatId}&text=${encodeURIComponent(message)}`;
  try {
    await fetch(url);
  } catch (e) {
    console.error("Telegram send failed", e);
  }
}
