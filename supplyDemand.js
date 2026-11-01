import {
  getMarketStructure,
  isDisplacement
} from "./analysisUtils.js";

// Identify supply and demand zones on H4
function findSupplyDemandZones(candles) {
  const zones = [];

  if (candles.length < 30) return zones;

  const recent = candles.slice(-60);

  const averageBody =
    recent.reduce(
      (sum, candle) =>
        sum + Math.abs(candle.close - candle.open),
      0
    ) / recent.length;

  for (let i = 2; i < candles.length - 1; i++) {
    const base = candles[i - 1];
    const impulse = candles[i];

    const impulseBody = Math.abs(
      impulse.close - impulse.open
    );

    // Require strong movement away from the base
    if (impulseBody < averageBody * 1.5) continue;

    // Demand zone: bearish base followed by bullish impulse
    if (
      base.close < base.open &&
      impulse.close > impulse.open
    ) {
      zones.push({
        type: "DEMAND",
        low: base.low,
        high: base.high,
        index: i - 1
      });
    }

    // Supply zone: bullish base followed by bearish impulse
    if (
      base.close > base.open &&
      impulse.close < impulse.open
    ) {
      zones.push({
        type: "SUPPLY",
        low: base.low,
        high: base.high,
        index: i - 1
      });
    }
  }

  return zones;
}

export function analyzeSupplyDemand(
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

  // 1. Daily directional bias
  const trend = getMarketStructure(daily);

  if (!["BULLISH", "BEARISH"].includes(trend)) {
    return null;
  }

  // 2. Identify H4 zones
  const zones = findSupplyDemandZones(fourHour);

  const latestM15 = fifteenMinute.at(-1);
  const previousM15 = fifteenMinute.at(-2);

  // 3. Find a fresh zone matching the daily direction
  const requiredZone =
    trend === "BULLISH" ? "DEMAND" : "SUPPLY";

  const currentZone = zones
    .filter(zone => zone.type === requiredZone)
    .filter(zone => zone.index >= fourHour.length - 40)
    .filter(zone => {
      const latestH4Index = fourHour.length - 1;

      // Zone must not have been revisited before
      const laterCandles = fourHour.slice(
        zone.index + 1,
        latestH4Index
      );

      const alreadyMitigated = laterCandles.some(candle =>
        candle.low <= zone.high &&
        candle.high >= zone.low
      );

      return !alreadyMitigated;
    })
    .at(-1);

  if (!currentZone) return null;

  // 4. Check whether M15 price reaches the zone
  const priceTouchesZone =
    latestM15.low <= currentZone.high &&
    latestM15.high >= currentZone.low;

  if (!priceTouchesZone) return null;

  // 5. Confirm rejection and displacement
  const bullishReaction =
    requiredZone === "DEMAND" &&
    latestM15.close > latestM15.open &&
    latestM15.close > previousM15.close;

  const bearishReaction =
    requiredZone === "SUPPLY" &&
    latestM15.close < latestM15.open &&
    latestM15.close < previousM15.close;

  if (!bullishReaction && !bearishReaction) {
    return null;
  }

  const expectedDirection =
    trend === "BULLISH" ? "BULLISH" : "BEARISH";

  if (
    isDisplacement(fifteenMinute) !== expectedDirection
  ) {
    return null;
  }

  return {
    strategy: "SUPPLY_DEMAND",
    symbol: null,
    direction: trend === "BULLISH" ? "BUY" : "SELL",
    timeframe: "15M",
    trend,

    zone: {
      type: currentZone.type,
      low: currentZone.low,
      high: currentZone.high
    },

    entry: latestM15.close,

    confirmations: [
      "Daily directional bias",
      "H4 supply/demand zone",
      "Fresh zone detection",
      "M15 zone reaction",
      "M15 displacement"
    ],

    status: "CONFIRMED_SETUP",
    timestamp: latestM15.datetime
  };
}
