import { getMarketStructure } from "./analysisUtils.js";

// Shared multi-timeframe directional filter.
// D1 establishes the broad bias; H4 must agree.
// M15 remains the strategy-specific entry/trigger timeframe.
export function analyzeTopDown(daily, fourHour, fifteenMinute) {
  if (
    !Array.isArray(daily) ||
    !Array.isArray(fourHour) ||
    !Array.isArray(fifteenMinute) ||
    daily.length < 30 ||
    fourHour.length < 30 ||
    fifteenMinute.length < 30
  ) {
    return null;
  }

  const dailyBias = getMarketStructure(daily);
  const h4Structure = getMarketStructure(fourHour);
  const m15Structure = getMarketStructure(fifteenMinute);

  // Do not permit signals when the higher timeframes disagree,
  // are ranging, or do not have enough confirmed swing structure.
  if (
    !["BULLISH", "BEARISH"].includes(dailyBias) ||
    h4Structure !== dailyBias
  ) {
    return null;
  }

  return {
    bias: dailyBias,
    direction: dailyBias === "BULLISH" ? "BUY" : "SELL",
    dailyBias,
    h4Structure,
    // M15 structure is supplied as context. Each strategy still
    // applies its own M15 trigger (sweep, displacement, rejection, etc.).
    m15Structure,
    alignment: "D1_H4_ALIGNED",
    confirmations: [
      `D1 directional bias: ${dailyBias}`,
      `H4 market structure agrees: ${h4Structure}`,
      `M15 entry context: ${m15Structure}`
    ]
  };
}
