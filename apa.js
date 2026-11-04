import {
  findSwings,
  getMarketStructure
} from "./analysisUtils.js";

// APA uses directional structure, a measured H4 pullback,
// and an M15 candlestick confirmation. It does not require
// an order block or liquidity sweep.

function getLastSwingLeg(candles, direction) {
  const { highs, lows } = findSwings(candles, 3);

  if (direction === "BULLISH") {
    const high = highs.at(-1);
    const low = lows.filter(item => high && item.index < high.index).at(-1);

    if (!high || !low || high.price <= low.price) return null;
    return { low: low.price, high: high.price, startIndex: low.index, endIndex: high.index };
  }

  const low = lows.at(-1);
  const high = highs.filter(item => low && item.index < low.index).at(-1);

  if (!high || !low || high.price <= low.price) return null;
  return { low: low.price, high: high.price, startIndex: high.index, endIndex: low.index };
}

function hasBullishConfirmation(candles) {
  const current = candles.at(-1);
  const previous = candles.at(-2);
  if (!current || !previous || current.close <= current.open) return false;

  const body = Math.abs(current.close - current.open);
  const range = current.high - current.low;
  if (range <= 0) return false;

  const bullishEngulfing =
    previous.close < previous.open &&
    current.open <= previous.close &&
    current.close >= previous.open;

  const lowerWick = Math.min(current.open, current.close) - current.low;
  const bullishRejection =
    lowerWick >= body * 1.5 &&
    current.close >= current.low + range * 0.65;

  const momentumClose = current.close > previous.high && body / range >= 0.5;

  return bullishEngulfing || bullishRejection || momentumClose;
}

function hasBearishConfirmation(candles) {
  const current = candles.at(-1);
  const previous = candles.at(-2);
  if (!current || !previous || current.close >= current.open) return false;

  const body = Math.abs(current.close - current.open);
  const range = current.high - current.low;
  if (range <= 0) return false;

  const bearishEngulfing =
    previous.close > previous.open &&
    current.open >= previous.close &&
    current.close <= previous.open;

  const upperWick = current.high - Math.max(current.open, current.close);
  const bearishRejection =
    upperWick >= body * 1.5 &&
    current.close <= current.low + range * 0.35;

  const momentumClose = current.close < previous.low && body / range >= 0.5;

  return bearishEngulfing || bearishRejection || momentumClose;
}

export function analyzeAPA(daily, fourHour, fifteenMinute) {
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

  // 1. D1 and H4 must show the same directional structure.
  const dailyTrend = getMarketStructure(daily);
  const h4Trend = getMarketStructure(fourHour);

  if (!["BULLISH", "BEARISH"].includes(dailyTrend) || dailyTrend !== h4Trend) {
    return null;
  }

  // 2. Measure the latest completed H4 impulse leg.
  const leg = getLastSwingLeg(fourHour, h4Trend);
  if (!leg) return null;

  const legSize = leg.high - leg.low;
  if (legSize <= 0) return null;

  // 3. Price must pull back into the 61.8%-65% Fibonacci Golden Zone.
  const latestM15 = fifteenMinute.at(-1);
  const recentM15 = fifteenMinute.slice(-4);
  const zoneLow = h4Trend === "BULLISH"
    ? leg.high - legSize * 0.65
    : leg.low + legSize * 0.618;
  const zoneHigh = h4Trend === "BULLISH"
    ? leg.high - legSize * 0.618
    : leg.low + legSize * 0.65;

  const touchedPullbackZone = recentM15.some(candle =>
    candle.low <= zoneHigh && candle.high >= zoneLow
  );

  if (!touchedPullbackZone) return null;

  // 4. Require a clear M15 rejection, engulfing, or momentum candle.
  const confirmed = h4Trend === "BULLISH"
    ? hasBullishConfirmation(fifteenMinute)
    : hasBearishConfirmation(fifteenMinute);

  if (!confirmed) return null;

  return {
    strategy: "APA",
    symbol: null,
    direction: h4Trend === "BULLISH" ? "BUY" : "SELL",
    timeframe: "15M",
    trend: dailyTrend,
    setup: "H4_IMPULSE_M15_GOLDEN_ZONE_PRICE_ACTION",
    entry: latestM15.close,
    keyLevel: h4Trend === "BULLISH" ? zoneLow : zoneHigh,
    confirmations: [
      "D1 and H4 market structure agree",
      "H4 impulse leg identified from confirmed swings",
      "M15 pullback reached the 61.8%-65% Fibonacci Golden Zone",
      "M15 rejection, engulfing, or momentum candle confirmed"
    ],
    status: "CONFIRMED_SETUP",
    timestamp: latestM15.datetime
  };
}
