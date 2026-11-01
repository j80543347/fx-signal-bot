
export function findSwings(candles, strength = 3) {
  const highs = [];
  const lows = [];

  for (let i = strength; i < candles.length - strength; i++) {
    const candle = candles[i];

    const left = candles.slice(i - strength, i);
    const right = candles.slice(i + 1, i + strength + 1);

    const swingHigh = [...left, ...right]
      .every(item => candle.high > item.high);

    const swingLow = [...left, ...right]
      .every(item => candle.low < item.low);

    if (swingHigh) {
      highs.push({ index: i, price: candle.high });
    }

    if (swingLow) {
      lows.push({ index: i, price: candle.low });
    }
  }

  return { highs, lows };
}

export function findFairValueGaps(candles) {
  const gaps = [];

  for (let i = 2; i < candles.length; i++) {
    const first = candles[i - 2];
    const third = candles[i];

    // Bullish FVG
    if (third.low > first.high) {
      gaps.push({
        type: "BULLISH",
        low: first.high,
        high: third.low,
        index: i
      });
    }

    // Bearish FVG
    if (third.high < first.low) {
      gaps.push({
        type: "BEARISH",
        low: third.high,
        high: first.low,
        index: i
      });
    }
  }

  return gaps;
}

export function detectLiquiditySweeps(candles, strength = 3) {
  if (candles.length < 10) return [];

  const { highs, lows } = findSwings(candles, strength);
  const sweeps = [];

  for (let i = Math.max(0, candles.length - 5); i < candles.length; i++) {
    const candle = candles[i];

    const previousHigh = highs
      .filter(level => level.index < i)
      .at(-1);

    const previousLow = lows
      .filter(level => level.index < i)
      .at(-1);

    if (
      previousHigh &&
      candle.high > previousHigh.price &&
      candle.close < previousHigh.price
    ) {
      sweeps.push({
        type: "BUY_SIDE_SWEEP",
        price: previousHigh.price,
        index: i
      });
    }

    if (
      previousLow &&
      candle.low < previousLow.price &&
      candle.close > previousLow.price
    ) {
      sweeps.push({
        type: "SELL_SIDE_SWEEP",
        price: previousLow.price,
        index: i
      });
    }
  }

  return sweeps;
}

export function isDisplacement(candles, index = candles.length - 1) {
  if (index < 10) return null;

  const candle = candles[index];

  const body = Math.abs(candle.close - candle.open);
  const ranges = candles
    .slice(index - 10, index)
    .map(item => Math.abs(item.close - item.open));

  const averageBody =
    ranges.reduce((sum, value) => sum + value, 0) / ranges.length;

  if (!averageBody || body < averageBody * 1.5) {
    return null;
  }

  if (candle.close > candle.open) return "BULLISH";
  if (candle.close < candle.open) return "BEARISH";

  return null;
}

export function getMarketStructure(candles) {
  const { highs, lows } = findSwings(candles, 3);

  if (highs.length < 2 || lows.length < 2) {
    return "UNCONFIRMED";
  }

  const lastHighs = highs.slice(-2);
  const lastLows = lows.slice(-2);

  const higherHigh =
    lastHighs[1].price > lastHighs[0].price;

  const higherLow =
    lastLows[1].price > lastLows[0].price;

  const lowerHigh =
    lastHighs[1].price < lastHighs[0].price;

  const lowerLow =
    lastLows[1].price < lastLows[0].price;

  if (higherHigh && higherLow) return "BULLISH";
  if (lowerHigh && lowerLow) return "BEARISH";

  return "RANGING";
}
