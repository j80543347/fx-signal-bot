
import {
  findFairValueGaps,
  detectLiquiditySweeps,
  isDisplacement,
  getMarketStructure
} from "./analysisUtils.js";

function getDailyTrend(candles) {
  return getMarketStructure(candles);
}

function findRecentFVG(candles, direction) {
  const gaps = findFairValueGaps(candles);

  return gaps
    .filter(gap => gap.type === direction)
    .filter(gap => gap.index >= candles.length - 10)
    .at(-1);
}

export function analyzeICT(daily, fourHour, fifteenMinute) {
  if (
    daily.length < 30 ||
    fourHour.length < 30 ||
    fifteenMinute.length < 30
  ) {
    return null;
  }

  // 1. Daily directional bias
  const trend = getDailyTrend(daily);

  if (!["BULLISH", "BEARISH"].includes(trend)) {
    return null;
  }

  // 2. H4 ICT point of interest
  const direction = trend === "BULLISH" ? "BULLISH" : "BEARISH";

  const h4FVG = findRecentFVG(fourHour, direction);

  if (!h4FVG) return null;

  // 3. M15 liquidity sweep
  const sweeps = detectLiquiditySweeps(fifteenMinute);

  const requiredSweep =
    direction === "BULLISH"
      ? "SELL_SIDE_SWEEP"
      : "BUY_SIDE_SWEEP";

  const sweep = sweeps.find(
    item => item.type === requiredSweep &&
    item.index >= fifteenMinute.length - 5
  );

  if (!sweep) return null;

  // 4. M15 displacement
  const displacement = isDisplacement(fifteenMinute);

  if (displacement !== direction) return null;

  // 5. M15 market structure confirmation
  const m15Structure = getMarketStructure(fifteenMinute);

  if (m15Structure !== direction) return null;

  // 6. M15 Fair Value Gap
  const m15FVG = findRecentFVG(fifteenMinute, direction);

  if (!m15FVG) return null;

  const latest = fifteenMinute.at(-1);

  return {
    strategy: "ICT",
    symbol: null,
    direction: direction === "BULLISH" ? "BUY" : "SELL",
    timeframe: "15M",
    trend,
    entry: latest.close,
    referenceZone: {
      low: m15FVG.low,
      high: m15FVG.high
    },
    h4POI: {
      type: "FAIR_VALUE_GAP",
      low: h4FVG.low,
      high: h4FVG.high
    },
    confirmations: [
      "Daily directional bias",
      "H4 Fair Value Gap",
      "M15 liquidity sweep",
      "M15 displacement",
      "M15 market structure confirmation",
      "M15 Fair Value Gap"
    ],
    status: "CONFIRMED_SETUP",
    timestamp: latest.datetime
  };
}
