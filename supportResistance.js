import {
  findSwings,
  getMarketStructure,
  isDisplacement
} from "./analysisUtils.js";

// Identify important H4 support and resistance levels
function findLevels(candles) {
  const { highs, lows } = findSwings(candles, 3);

  return {
    resistance: highs.map(item => item.price),
    support: lows.map(item => item.price)
  };
}

// Find the closest relevant price level
function findNearestLevel(price, levels) {
  if (!levels.length) return null;

  return levels
    .map(level => ({
      price: level,
      distance: Math.abs(price - level)
    }))
    .sort((a, b) => a.distance - b.distance)[0];
}

export function analyzeSupportResistance(
  daily,
  fourHour,
  fifteenMinute
) {
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

  // 2. H4 support and resistance
  const levels = findLevels(fourHour);

  const latestH4 = fourHour.at(-1);
  const latestM15 = fifteenMinute.at(-1);
  const previousM15 = fifteenMinute.at(-2);

  const currentPrice = latestM15.close;

  const nearestSupport = findNearestLevel(
    currentPrice,
    levels.support
  );

  const nearestResistance = findNearestLevel(
    currentPrice,
    levels.resistance
  );

  if (!nearestSupport || !nearestResistance) {
    return null;
  }

  // Use H4 average range to avoid distant levels
  const recentRanges = fourHour
    .slice(-20)
    .map(candle => candle.high - candle.low);

  const averageRange =
    recentRanges.reduce((sum, value) => sum + value, 0) /
    recentRanges.length;

  const tolerance = averageRange * 0.15;

  // 3. Bullish support bounce
  const bullishBounce =
    trend === "BULLISH" &&
    previousM15.low <= nearestSupport.price + tolerance &&
    latestM15.close > nearestSupport.price &&
    latestM15.close > latestM15.open;

  // 4. Bearish resistance rejection
  const bearishBounce =
    trend === "BEARISH" &&
    previousM15.high >= nearestResistance.price - tolerance &&
    latestM15.close < nearestResistance.price &&
    latestM15.close < latestM15.open;

  // 5. Breakout confirmation
  const bullishBreakout =
    trend === "BULLISH" &&
    latestM15.close > nearestResistance.price &&
    previousM15.close <= nearestResistance.price;

  const bearishBreakout =
    trend === "BEARISH" &&
    latestM15.close < nearestSupport.price &&
    previousM15.close >= nearestSupport.price;

  let direction = null;
  let setup = null;
  let level = null;

  if (bullishBounce) {
    direction = "BUY";
    setup = "SUPPORT_BOUNCE";
    level = nearestSupport.price;
  } else if (bearishBounce) {
    direction = "SELL";
    setup = "RESISTANCE_REJECTION";
    level = nearestResistance.price;
  } else if (bullishBreakout) {
    direction = "BUY";
    setup = "BULLISH_BREAKOUT";
    level = nearestResistance.price;
  } else if (bearishBreakout) {
    direction = "SELL";
    setup = "BEARISH_BREAKOUT";
    level = nearestSupport.price;
  }

  if (!direction) return null;

  // 6. Require M15 displacement
  const expectedDirection =
    direction === "BUY" ? "BULLISH" : "BEARISH";

  if (isDisplacement(fifteenMinute) !== expectedDirection) {
    return null;
  }

  return {
    strategy: "SUPPORT_RESISTANCE",
    symbol: null,
    direction,
    timeframe: "15M",
    trend,
    setup,
    entry: latestM15.close,
    keyLevel: level,
    confirmations: [
      "Daily directional trend",
      "H4 support/resistance level",
      "M15 price reaction or breakout",
      "M15 displacement"
    ],
    status: "CONFIRMED_SETUP",
    timestamp: latestM15.datetime
  };
}
