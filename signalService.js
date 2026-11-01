
import {
  FOREX_PAIRS,
  getMarketSnapshot
} from "./marketData.js";

import {
  analyzeAllStrategies
} from "./signalManager.js";

import {
  addRiskLevels
} from "./riskManager.js";

import {
  generateSignalChart
} from "./chartGenerator.js";

import {
  sendSignalPhoto
} from "./telegramSender.js";

const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// Prevent repeated alerts for the same setup
const sentSignals = new Map();

const COOLDOWN_MS = 60 * 60 * 1000; // 1 hour

export async function scanForexMarkets() {
  if (!CHAT_ID) {
    throw new Error("Missing TELEGRAM_CHAT_ID environment variable");
  }

  console.log("Starting Forex market scan...");

  for (const symbol of FOREX_PAIRS) {
    try {
      console.log(`Analyzing ${symbol}...`);

      const snapshot = await getMarketSnapshot(symbol);

      const setups = analyzeAllStrategies(snapshot);

      for (const setup of setups) {
        const signalKey =
          `${symbol}-${setup.strategy}-${setup.direction}`;

        const lastSent = sentSignals.get(signalKey);

        if (
          lastSent &&
          Date.now() - lastSent < COOLDOWN_MS
        ) {
          console.log(`Cooldown active: ${signalKey}`);
          continue;
        }

        const signal = addRiskLevels(
          setup,
          snapshot.fifteenMinute
        );

        if (!signal) {
          console.log(`Invalid risk levels: ${signalKey}`);
          continue;
        }

        const chart = generateSignalChart(
          signal,
          snapshot.fifteenMinute
        );

        await sendSignalPhoto(
          CHAT_ID,
          signal,
          chart
        );

        sentSignals.set(signalKey, Date.now());

        console.log(`Signal delivered: ${signalKey}`);
      }

      // Small delay between currency pairs
      await new Promise(resolve =>
        setTimeout(resolve, 2000)
      );

    } catch (error) {
      console.error(
        `Scan failed for ${symbol}:`,
        error.message
      );
    }
  }

  console.log("Forex market scan completed.");
}
