const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

if (!BOT_TOKEN) {
  throw new Error("Missing TELEGRAM_BOT_TOKEN");
}

const TELEGRAM_API =
  `https://api.telegram.org/bot${BOT_TOKEN}`;

function formatPrice(value) {
  return Number(value).toFixed(
    String(value).includes("JPY") ? 3 : 5
  );
}

export async function sendSignalPhoto(
  chatId,
  signal,
  chartBuffer
) {
  if (!chatId) {
    throw new Error("Missing Telegram chat ID");
  }

  if (!chartBuffer) {
    throw new Error("Missing chart image");
  }

  const directionEmoji =
    signal.direction === "BUY" ? "🟢" : "🔴";

  const confirmations = (signal.confirmations || [])
    .map(item => `✓ ${item}`)
    .join("\n");

  const caption = [
    `${directionEmoji} ${signal.direction === "BUY" ? "BUY" : "SELL"} ${signal.symbol}`,
    "",
    `Strategy: ${signal.strategy}`,
    `Timeframe: ${signal.timeframe || "15M"}`,
    `Trend: ${signal.trend || "N/A"}`,
    "",
    `Entry Price: ${formatPrice(signal.entry)}`,
    `SL: ${formatPrice(signal.stopLoss)}`,
    `TP1: ${formatPrice(signal.tp1)}`,
    `TP2: ${formatPrice(signal.tp2)}`,
    "",
    `Risk : Reward: ${signal.riskReward?.tp2 || "1:2"}`,
    "",
    "Confirmations:",
    confirmations || "No confirmation details available.",
    "",
    "Trade responsibly. This is a technical analysis signal, not financial advice."
  ].join("\n");

  const form = new FormData();

  form.append("chat_id", String(chatId));
  form.append("caption", caption);
  form.append("photo", new Blob(
    [chartBuffer],
    { type: "image/png" }
  ), `${signal.symbol}-signal.png`);

  const response = await fetch(
    `${TELEGRAM_API}/sendPhoto`,
    {
      method: "POST",
      body: form
    }
  );

  const result = await response.json();

  if (!result.ok) {
    throw new Error(
      result.description || "Telegram image delivery failed"
    );
  }

  console.log(
    `Signal image sent: ${signal.symbol} ${signal.direction}`
  );

  return result;
}
