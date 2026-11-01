import { analyzeICT } from "./ict.js";
import { analyzeSMC } from "./smc.js";
import {
  analyzeSupportResistance
} from "./supportResistance.js";
import {
  analyzeSupplyDemand
} from "./supplyDemand.js";
import {
  analyzeLiquidity
} from "./liquidity.js";

// Run all five strategies independently
export function analyzeAllStrategies(snapshot) {
  const {
    symbol,
    daily,
    fourHour,
    fifteenMinute
  } = snapshot;

  const results = [];

  const strategies = [
    () => analyzeICT(daily, fourHour, fifteenMinute),

    () => analyzeSMC(daily, fourHour, fifteenMinute),

    () => analyzeSupportResistance(
      daily,
      fourHour,
      fifteenMinute
    ),

    () => analyzeSupplyDemand(
      daily,
      fourHour,
      fifteenMinute
    ),

    () => analyzeLiquidity(
      symbol,
      daily,
      fourHour,
      fifteenMinute
    )
  ];

  for (const runStrategy of strategies) {
    try {
      const result = runStrategy();

      if (
        result &&
        result.status === "CONFIRMED_SETUP" &&
        ["BUY", "SELL"].includes(result.direction)
      ) {
        results.push({
          ...result,
          symbol
        });
      }
    } catch (error) {
      console.error(
        `Strategy analysis error for ${symbol}:`,
        error.message
      );
    }
  }

  return results;
}
