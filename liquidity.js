import {
  findSwings,
  isDisplacement,
  getMarketStructure
} from "./analysisUtils.js";

// Tolerance for identifying similar highs and lows
function getTolerance(symbol) {
  return symbol.includes("JPY") ? 0.03 : 0.0003;
}

// Find clusters of similar swing highs and lows on H4
function findEqualLevels(candles, symbol) {
  const { highs, lows } = findSwings(candles, 3);
  const tolerance = getTolerance(symbol);

  const equalHighs = [];
  const equalLows = [];

  for (let i = 0; i < highs.length - 1; i++) {
    for (let j = i + 1; j < highs.length; j++) {
      if (
        Math.abs(highs[i].price - highs[j].price) <= tolerance
      ) {
        equalHighs.push({
          price: (highs[i].price + highs[j].price) / 2,
          firstIndex: highs[i].index,
          secondIndex: highs[j].index
        });
      }
    }
  }

  for (let i = 0; i < lows.length - 1; i++) {
    for (let j = i + 1; j < lows.length; j++) {
      if (
        Math.abs(lows[i].price - lows[j].price) <= tolerance
      ) {
        equalLows.push({
          price: (lows[i].price + lows[j].price) / 2,
          firstIndex: lows[i].index,
          secondIndex: lows[j].index
        });
      }
    }
  }

  return { equalHighs, equalLows };
}

export function analyzeLiquidity(
  symbol,
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

  const dailyTrend = getMarketStructure(daily);

  if (!["BULLISH", "BEARISH"].includes(dailyTrend)) {
    return null;
  }

  const { equalHighs, equalLows } =
    findEqualLevels(fourHour, symbol);

  const recentM15 = fifteenMinute.slice(-5);
  const latest = recentM15.at(-1);

  if (!latest) return null;

  // Look for a sweep of equal lows: possible BUY setup
  const sellSideSweep = equalLows
    .filter(level =>
      latest.low < level.price &&
      latest.close > level.price
    )
    .at(-1);

  // Look for a sweep of equal highs: possible SELL setup
  const buySideSweep = equalHighs
    .filter(level =>
      latest.high > level.price &&
      latest.close < level.price
    )
    .at(-1);

  let direction = null;
  let sweptLevel = null;
  let liquidityType = null;

  if (sellSideSweep && dailyTrend === "BULLISH") {
    direction = "BUY";
    sweptLevel = sellSideSweep.price;
    liquidityType = "SELL-SIDE LIQUIDITY";
  } else if (buySideSweep && dailyTrend === "BEARISH") {
    direction = "SELL";
    sweptLevel = buySideSweep.price;
    liquidityType = "BUY-SIDE LIQUIDITY";
  } else {
    return null;
  }

  const expectedDisplacement =
    direction === "BUY" ? "BULLISH" : "BEARISH";

  const displacement = isDisplacement(fifteenMinute);

  if (displacement !== expectedDisplacement) {
    return null;
  }

  const m15Structure = getMarketStructure(fifteenMinute);

  if (m15Structure !== expectedDisplacement) {
    return null;
  }

  return {
    strategy: "LIQUIDITY",
    symbol,
    direction,
    timeframe: "15M",
    trend: dailyTrend,
    liquidityType,
    sweptLevel,
    entry: latest.close,
    confirmations: [
      "Daily directional bias",
      "H4 equal highs/lows identified",
      "M15 liquidity sweep",
      "M15 displacement confirmation",
      "M15 market structure confirmation"
    ],
    status: "CONFIRMED_SETUP",
    timestamp: latest.datetime
  };
}
