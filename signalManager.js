import { analyzeICT } from "./ict.js";
import { analyzeSMC } from "./smc.js";
import { analyzeAPA } from "./apa.js";
import { analyzeTopDown } from "./topDownAnalysis.js";
import {
  analyzeSupportResistance
} from "./supportResistance.js";
import {
  analyzeSupplyDemand
} from "./supplyDemand.js";
import {
  analyzeLiquidity
} from "./liquidity.js";

// Run the shared D1/H4 Top-Down filter first, then run all six
// strategy engines independently using their existing M15 rules.
export function analyzeAllStrategies(snapshot) {
  const {
    symbol,
    daily,
    fourHour,
    fifteenMinute
  } = snapshot;

  const topDown = analyzeTopDown(daily, fourHour, fifteenMinute);

  // No directional agreement between D1 and H4: no strategy signals.
  if (!topDown) {
    console.log(`Top-down filter: WAIT for ${symbol} (D1/H4 not aligned).`);
    return [];
  }

  console.log(
    `Top-down filter: ${symbol} ${topDown.direction} ` +
    `(D1=${topDown.dailyBias}, H4=${topDown.h4Structure}, ` +
    `M15=${topDown.m15Structure}).`
  );

  const results = [];

  const strategies = [
    () => analyzeICT(daily, fourHour, fifteenMinute),
    () => analyzeSMC(daily, fourHour, fifteenMinute),
    () => analyzeSupportResistance(daily, fourHour, fifteenMinute),
    () => analyzeSupplyDemand(daily, fourHour, fifteenMinute),
    () => analyzeLiquidity(symbol, daily, fourHour, fifteenMinute),
    () => analyzeAPA(daily, fourHour, fifteenMinute)
  ];

  for (const runStrategy of strategies) {
    try {
      const result = runStrategy();

      if (
        result &&
        result.status === "CONFIRMED_SETUP" &&
        ["BUY", "SELL"].includes(result.direction) &&
        result.direction === topDown.direction
      ) {
        results.push({
          ...result,
          symbol,
          topDownAnalysis: topDown,
          confirmations: [
            ...(Array.isArray(result.confirmations) ? result.confirmations : []),
            ...topDown.confirmations
          ]
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
