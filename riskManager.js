
function calculateATR(candles, period = 14) {
  if (candles.length < period + 1) {
    throw new Error("Not enough candles to calculate ATR");
  }

  const recent = candles.slice(-(period + 1));
  const trueRanges = [];

  for (let i = 1; i < recent.length; i++) {
    const current = recent[i];
    const previous = recent[i - 1];

    const trueRange = Math.max(
      current.high - current.low,
      Math.abs(current.high - previous.close),
      Math.abs(current.low - previous.close)
    );

    trueRanges.push(trueRange);
  }

  return trueRanges.reduce(
    (sum, value) => sum + value,
    0
  ) / trueRanges.length;
}

export function addRiskLevels(signal, candles) {
  if (!signal || !["BUY", "SELL"].includes(signal.direction)) {
    return null;
  }

  const entry = Number(signal.entry);

  if (!Number.isFinite(entry) || entry <= 0) {
    return null;
  }

  const atr = calculateATR(candles);

  // Stop distance is 1.5 times the 15M ATR
  const riskDistance = atr * 1.5;

  if (!Number.isFinite(riskDistance) || riskDistance <= 0) {
    return null;
  }

  const isBuy = signal.direction === "BUY";

  const stopLoss = isBuy
    ? entry - riskDistance
    : entry + riskDistance;

  const tp1 = isBuy
    ? entry + riskDistance
    : entry - riskDistance;

  const tp2 = isBuy
    ? entry + riskDistance * 2
    : entry - riskDistance * 2;

  // Forex price precision
  const digits = signal.symbol?.includes("JPY") ? 3 : 5;

  return {
    ...signal,
    entry: Number(entry.toFixed(digits)),
    stopLoss: Number(stopLoss.toFixed(digits)),
    tp1: Number(tp1.toFixed(digits)),
    tp2: Number(tp2.toFixed(digits)),
    riskReward: {
      tp1: "1:1",
      tp2: "1:2"
    },
    atr: Number(atr.toFixed(digits))
  };
}
