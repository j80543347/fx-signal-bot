
import {
  findSwings,
  detectLiquiditySweeps,
  isDisplacement,
  getMarketStructure
} from "./analysisUtils.js";

// Find the most recent H4 order block
function findOrderBlock(candles, direction) {
  const start = Math.max(1, candles.length - 8);

  for (let i = candles.length - 2; i >= start; i--) {
    const candle = candles[i];

    if (direction === "BULLISH" && candle.close < candle.open) {
      return {
        type: "BULLISH_ORDER_BLOCK",
        low: candle.low,
        high: candle.high,
        index: i
      };
    }

    if (direction === "BEARISH" && candle.close > candle.open) {
      return {
        type: "BEARISH_ORDER_BLOCK",
        low: candle.low,
        high: candle.high,
        index: i
      };
    }
  }

  return null;
}

// Detect a market structure break
function detectStructureBreak(candles, direction) {
  const { highs, lows } = findSwings(candles, 3);

  const latest = candles.at(-1);

  if (direction === "BULLISH" && highs.length) {
    const level = highs.at(-1);

    if (latest.close > level.price) {
      return {
        type: "BULLISH_BOS",
        level: level.price
      };
    }
  }

  if (direction === "BEARISH" && lows.length) {
    const level = lows.at(-1);

    if (latest.close < level.price) {
      return {
        type: "BEARISH_BOS",
        level: level.price
      };
    }
  }

  return null;
}

export function analyzeSMC(daily, fourHour, fifteenMinute) {
  if (
    daily.length < 30 ||
    fourHour.length < 30 ||
    fifteenMinute.length < 30
  ) {
    return null;
  }

  // 1. Daily trend
  const trend = getMarketStructure(daily);

  if (!["BULLISH", "BEARISH"].includes(trend)) {
    return null;
  }

  // 2. H4 structure confirmation
  const h4Break = detectStructureBreak(fourHour, trend);

  if (!h4Break) return null;

  // 3. H4 order block
  const orderBlock = findOrderBlock(fourHour, trend);

  if (!orderBlock) return null;

  // 4. M15 liquidity sweep
  const sweeps = detectLiquiditySweeps(fifteenMinute);

  const requiredSweep =
    trend === "BULLISH"
      ? "SELL_SIDE_SWEEP"
      : "BUY_SIDE_SWEEP";

  const sweep = sweeps.find(item =>
    item.type === requiredSweep &&
    item.index >= fifteenMinute.length - 5
  );

  if (!sweep) return null;

  // 5. M15 displacement
  const displacement = isDisplacement(fifteenMinute);

  if (displacement !== trend) return null;

  // 6. M15 structure shift
  const m15Break = detectStructureBreak(
    fifteenMinute,
    trend
  );

  if (!m15Break) return null;

  // 7. M15 structure direction
  const m15Structure = getMarketStructure(fifteenMinute);

  if (m15Structure !== trend) return null;

  const latest = fifteenMinute.at(-1);

  return {
    strategy: "SMC",
    symbol: null,
    direction: trend === "BULLISH" ? "BUY" : "SELL",
    timeframe: "15M",
    trend,

    entry: latest.close,

    orderBlock: {
      type: orderBlock.type,
      low: orderBlock.low,
      high: orderBlock.high
    },

    h4Structure: h4Break,
    m15Structure: m15Break,

    confirmations: [
      "Daily market direction",
      "H4 Break of Structure",
      "H4 Order Block",
      "M15 Liquidity Sweep",
      "M15 Displacement",
      "M15 Market Structure Shift"
    ],

    status: "CONFIRMED_SETUP",
    timestamp: latest.datetime
  };
}
