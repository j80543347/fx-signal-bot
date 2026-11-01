
import { scanForexMarkets } from "./signalService.js";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const AUTHORIZED_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

if (!BOT_TOKEN) {
  throw new Error("Missing TELEGRAM_BOT_TOKEN");
}

const TELEGRAM_API =
  `https://api.telegram.org/bot${BOT_TOKEN}`;

let offset = 0;
let running = true;
let scanInProgress = false;

async function sendMessage(chatId, message) {
  const response = await fetch(
    `${TELEGRAM_API}/sendMessage`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: message
      })
    }
  );

  const result = await response.json();

  if (!result.ok) {
    throw new Error(
      result.description || "Telegram message failed"
    );
  }
}

async function handleUpdate(update) {
  const message = update.message;

  if (!message?.text) return;

  const chatId = message.chat.id;
  const command = message.text
    .trim()
    .split(/\s+/)[0]
    .split("@")[0];

  if (command === "/start") {
    await sendMessage(
      chatId,
      "Welcome to FX Signal Bot!\n\n" +
      "Five independent strategies:\n" +
      "1. ICT\n" +
      "2. SMC\n" +
      "3. Support and Resistance\n" +
      "4. Supply and Demand\n" +
      "5. Liquidity\n\n" +
      "Timeframes: D1 + H4 + M15\n\n" +
      "Trading mode: Signals only.\n\n" +
      "Commands:\n" +
      "/status - Check bot status\n" +
      "/chatid - Show your Telegram chat ID\n" +
      "/scan - Run a market scan"
    );
  }

  if (command === "/chatid") {
    await sendMessage(
      chatId,
      `Your Telegram chat ID is: ${chatId}\n\n` +
      "Add this as TELEGRAM_CHAT_ID in your hosting environment variables."
    );
  }

  if (command === "/status") {
    await sendMessage(
      chatId,
      "FX Signal Bot is online.\n" +
      "Market analysis: Connected.\n" +
      "Strategies: 5 configured.\n" +
      "Timeframes: D1 + H4 + M15.\n" +
      "Trading mode: Signals only.\n" +
      `Scan running: ${scanInProgress ? "YES" : "NO"}`
    );
  }

  if (command === "/scan") {
    if (
      AUTHORIZED_CHAT_ID &&
      String(chatId) !== String(AUTHORIZED_CHAT_ID)
    ) {
      await sendMessage(chatId, "You are not authorized to run scans.");
      return;
    }

    if (scanInProgress) {
      await sendMessage(chatId, "A market scan is already running.");
      return;
    }

    scanInProgress = true;

    try {
      await sendMessage(
        chatId,
        "Forex market scan started. Please wait..."
      );

      await scanForexMarkets();

      await sendMessage(
        chatId,
        "Market scan completed."
      );
    } catch (error) {
      console.error("Scan error:", error.message);

      await sendMessage(
        chatId,
        `Market scan failed: ${error.message}`
      );
    } finally {
      scanInProgress = false;
    }
  }
}

async function startBot() {
  console.log("FX Signal Bot starting...");

  while (running) {
    try {
      const response = await fetch(
        `${TELEGRAM_API}/getUpdates?offset=${offset}&timeout=25`
      );

      const result = await response.json();

      if (!result.ok) {
        throw new Error(
          result.description || "Telegram polling failed"
        );
      }

      for (const update of result.result) {
        offset = update.update_id + 1;

        try {
          await handleUpdate(update);
        } catch (error) {
          console.error("Update error:", error.message);
        }
      }
    } catch (error) {
      console.error("Telegram connection error:", error.message);

      await new Promise(resolve =>
        setTimeout(resolve, 5000)
      );
    }
  }
}

process.on("SIGTERM", () => {
  running = false;
});

process.on("SIGINT", () => {
  running = false;
});

startBot();
