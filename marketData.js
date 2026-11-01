
import WebSocket from "ws";

const DERIV_WS_URL =
  "wss://api.derivws.com/trading/v1/options/ws/public";

export const FOREX_PAIRS = [
  "EUR/USD",
  "GBP/USD",
  "USD/JPY",
  "AUD/USD",
  "USD/CAD",
  "NZD/USD",
  "USD/CHF"
];

const TIMEFRAMES = {
  daily: 86400,
  fourHour: 14400,
  fifteenMinute: 900
};

let requestId = 1;

function connectToDeriv() {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(DERIV_WS_URL);

    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error("Deriv connection timed out"));
    }, 15000);

    ws.once("open", () => {
      clearTimeout(timeout);
      resolve(ws);
    });

    ws.once("error", error => {
      clearTimeout(timeout);
      reject(error);
    });
  });
}

function requestData(ws, request) {
  return new Promise((resolve, reject) => {
    const id = requestId++;
    const timeout = setTimeout(() => {
      ws.off("message", onMessage);
      reject(new Error("Deriv request timed out"));
    }, 20000);

    function onMessage(rawMessage) {
      let data;

      try {
        data = JSON.parse(rawMessage.toString());
      } catch {
        return;
      }

      if (data.req_id !== id) return;

      clearTimeout(timeout);
      ws.off("message", onMessage);

      if (data.error) {
        reject(new Error(data.error.message));
        return;
      }

      resolve(data);
    }

    ws.on("message", onMessage);

    ws.send(JSON.stringify({
      ...request,
      req_id: id
    }), error => {
      if (error) {
        clearTimeout(timeout);
        ws.off("message", onMessage);
        reject(error);
      }
    });
  });
}

function normalizePair(value) {
  return String(value || "")
    .replace(/[^A-Z]/gi, "")
    .toUpperCase();
}

async function getDerivSymbol(ws, pair) {
  const response = await requestData(ws, {
    active_symbols: "brief"
  });

  const symbols = response.active_symbols || [];
  const wantedPair = normalizePair(pair);

  const match = symbols.find(item => {
    const code = normalizePair(item.underlying_symbol);
    const name = normalizePair(item.underlying_symbol_name);

    return (
      code === `FRX${wantedPair}` ||
      code === wantedPair ||
      name === wantedPair
    );
  });

  if (!match) {
    throw new Error(
      `Deriv does not currently list ${pair} as an active symbol`
    );
  }

  return match.underlying_symbol;
}

async function getCandles(ws, symbol, granularity) {
  const response = await requestData(ws, {
    ticks_history: symbol,
    count: 101,
    end: "latest",
    style: "candles",
    granularity
  });

  if (!Array.isArray(response.candles)) {
    throw new Error(
      `No candle data returned for ${symbol}`
    );
  }

  const candles = response.candles
    .map(candle => ({
      epoch: Number(candle.epoch),
      datetime: new Date(
        Number(candle.epoch) * 1000
      ).toISOString(),
      open: Number(candle.open),
      high: Number(candle.high),
      low: Number(candle.low),
      close: Number(candle.close)
    }))
    .filter(candle =>
      Number.isFinite(candle.epoch) &&
      Number.isFinite(candle.open) &&
      Number.isFinite(candle.high) &&
      Number.isFinite(candle.low) &&
      Number.isFinite(candle.close)
    )
    .sort((a, b) => a.epoch - b.epoch);

  // Exclude the newest candle because it may still be forming.
  candles.pop();

  if (candles.length < 30) {
    throw new Error(
      `Not enough completed candles for ${symbol}`
    );
  }

  return candles;
}

export async function getMarketSnapshot(pair) {
  console.log(`Downloading Deriv data for ${pair}`);

  const ws = await connectToDeriv();

  try {
    const symbol = await getDerivSymbol(ws, pair);

    console.log(`${pair} maps to Deriv symbol ${symbol}`);

    const daily = await getCandles(
      ws,
      symbol,
      TIMEFRAMES.daily
    );

    const fourHour = await getCandles(
      ws,
      symbol,
      TIMEFRAMES.fourHour
    );

    const fifteenMinute = await getCandles(
      ws,
      symbol,
      TIMEFRAMES.fifteenMinute
    );

    return {
      symbol: pair,
      derivSymbol: symbol,
      daily,
      fourHour,
      fifteenMinute,
      updatedAt: new Date().toISOString()
    };
  } finally {
    ws.close();
  }
}
