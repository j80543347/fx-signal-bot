import { scanForexMarkets } from "./signalService.js";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const AUTHORIZED_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

if (!BOT_TOKEN) throw new Error("Missing TELEGRAM_BOT_TOKEN");
if (!AUTHORIZED_CHAT_ID) throw new Error("Missing TELEGRAM_CHAT_ID");

const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

let offset = 0;
let running = true;
let scanInProgress = false;
let lastAutoScanAt = 0;
let lastMarketOpenState = null;

const SCAN_INTERVAL_MS = 5 * 60 * 1000;
const SCHEDULER_CHECK_MS = 30 * 1000;

// Simplified standard Forex week in UTC:
// Sunday 22:00 UTC through Friday 22:00 UTC.
function isForexMarketOpen(date = new Date()) {
  const day = date.getUTCDay();
  const hour = date.getUTCHours();

  if (day === 0) return hour >= 22;
  if (day === 6) return false;
  if (day === 5) return hour < 22;
  return true;
}

// Approximate fixed UTC session windows.
// London/New York daylight-saving changes are not automatically adjusted.
function isTradingSessionActive(date = new Date()) {
  const day = date.getUTCDay();
  const hour = date.getUTCHours();

  if (day === 0 || day === 6) return false;

  const asian = hour >= 0 && hour < 9;
  const london = hour >= 7 && hour < 16;
  const newYork = hour >= 12 && hour < 21;

  return asian || london || newYork;
}

async function sendMessage(chatId, message) {
  const response = await fetch(`${TELEGRAM_API}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: message })
  });

  const result = await response.json();
  if (!response.ok || !result.ok) {
    throw new Error(result.description || "Telegram message failed");
  }
}

async function runScan({ notifyChatId = null, source = "manual" } = {}) {
  if (scanInProgress) {
    if (notifyChatId) {
      await sendMessage(notifyChatId, "A market scan is already running.");
    }
    return;
  }

  scanInProgress = true;
  lastAutoScanAt = Date.now();

  try {
    if (notifyChatId) {
      await sendMessage(notifyChatId, "Forex market scan started. Please wait...");
    }

    console.log(`Starting ${source} Forex market scan...`);
    await scanForexMarkets();
    console.log(`${source} Forex market scan completed.`);

    if (notifyChatId) {
      await sendMessage(notifyChatId, "Market scan completed.");
    }
  } catch (error) {
    console.error(`${source} scan error:`, error.message);
    if (notifyChatId) {
      await sendMessage(notifyChatId, `Market scan failed: ${error.message}`);
    }
  } finally {
    scanInProgress = false;
  }
}

async function handleUpdate(update) {
  const message = update.message;
  if (!message?.text) return;

  const chatId = message.chat.id;
  const command = message.text.trim().split(/\s+/)[0].split("@")[0];

  if (command === "/start") {
    await sendMessage(
      chatId,
      "Welcome to FX SMART SIGNAL!\n\n" +
      "Five independent strategies:\n" +
      "1. ICT\n2. SMC\n3. Support and Resistance\n" +
      "4. Supply and Demand\n5. Liquidity\n\n" +
      "Timeframes: D1 + H4 + M15\n" +
      "Automatic scanning: Every 5 minutes during configured sessions (UTC).\n" +
      "Trading mode: Signals only.\n\n" +
      "Commands:\n/status - Check bot status\n" +
      "/chatid - Show your Telegram chat ID\n/scan - Run a manual market scan"
    );
    return;
  }

  if (command === "/chatid") {
    await sendMessage(
      chatId,
      `Your Telegram chat ID is: ${chatId}\n\n` +
      "The authorized chat ID is configured in the hosting environment."
    );
    return;
  }

  if (command === "/status") {
    const marketOpen = isForexMarketOpen();
    const sessionActive = isTradingSessionActive();

    await sendMessage(
      chatId,
      "FX SMART SIGNAL is online.\n" +
      `Forex market: ${marketOpen ? "OPEN" : "CLOSED"}.\n` +
      `Trading session: ${sessionActive ? "ACTIVE" : "INACTIVE"}.\n` +
      "Automatic scan interval: 5 minutes during configured sessions (UTC).\n" +
      "Strategies: 5 configured.\nTimeframes: D1 + H4 + M15.\n" +
      "Trading mode: Signals only.\n" +
      `Scan running: ${scanInProgress ? "YES" : "NO"}`
    );
    return;
  }

  if (command === "/scan") {
    if (String(chatId) !== String(AUTHORIZED_CHAT_ID)) {
      await sendMessage(chatId, "You are not authorized to run scans.");
      return;
    }

    if (!isForexMarketOpen()) {
      await sendMessage(
        chatId,
        "Forex market is currently CLOSED. Manual scanning is paused until the market reopens."
      );
      return;
    }

    await runScan({ notifyChatId: chatId, source: "manual" });
  }
}

async function checkMarketAndSchedule() {
  const now = new Date();
  const marketOpen = isForexMarketOpen(now);

  if (lastMarketOpenState === null) {
    lastMarketOpenState = marketOpen;
    if (!marketOpen) {
      await sendMessage(
        AUTHORIZED_CHAT_ID,
        "Forex market is currently CLOSED. Automatic scanning is paused. The bot will resume when the market reopens (UTC)."
      );
    }
    return;
  }

  if (marketOpen !== lastMarketOpenState) {
    lastMarketOpenState = marketOpen;
    const message = marketOpen
      ? "Forex market is now OPEN. FX SMART SIGNAL will resume automatic scanning during the configured trading sessions (UTC)."
      : "Forex market is now CLOSED. Automatic scanning is paused until the market reopens (UTC).";

    await sendMessage(AUTHORIZED_CHAT_ID, message);
    console.log(message);
  }

  if (!marketOpen || !isTradingSessionActive(now)) return;
  if (scanInProgress) return;
  if (Date.now() - lastAutoScanAt < SCAN_INTERVAL_MS) return;

  await runScan({ source: "automatic" });
}

function startScheduler() {
  console.log("Automatic Forex scheduler started (UTC, 5-minute interval).");

  checkMarketAndSchedule().catch(error => {
    console.error("Scheduler error:", error.message);
  });

  setInterval(() => {
    checkMarketAndSchedule().catch(error => {
      console.error("Scheduler error:", error.message);
    });
  }, SCHEDULER_CHECK_MS);
}

async function startBot() {
  console.log("FX SMART SIGNAL starting...");
  startScheduler();

  while (running) {
    try {
      const response = await fetch(
        `${TELEGRAM_API}/getUpdates?offset=${offset}&timeout=25`
      );
      const result = await response.json();

      if (!response.ok || !result.ok) {
        throw new Error(result.description || "Telegram polling failed");
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
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
}

process.on("SIGTERM", () => { running = false; });
process.on("SIGINT", () => { running = false; });

startBot();
