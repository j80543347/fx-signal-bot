
import WebSocket from "ws";

const URL =
  "wss://api.derivws.com/trading/v1/options/ws/public";

const ws = new WebSocket(URL);

ws.on("open", () => {
  console.log("Connected to Deriv!");

  ws.send(JSON.stringify({
    active_symbols: "brief",
    req_id: 1
  }));
});

ws.on("message", message => {
  const data = JSON.parse(message.toString());

  if (data.req_id === 1) {
    if (data.error) {
      console.error("Symbol error:", data.error.message);
      ws.close();
      return;
    }

    const symbols = data.active_symbols || [];

    const forex = symbols.filter(item =>
      String(item.underlying_symbol || "")
        .toLowerCase()
        .startsWith("frx")
    );

    console.log("\nAvailable Deriv Forex symbols:");

    forex.forEach(item => {
      console.log(
        `${item.underlying_symbol} - ${item.underlying_symbol_name}`
      );
    });

    const eurusd = forex.find(item =>
      item.underlying_symbol === "frxEURUSD"
    );

    if (!eurusd) {
      console.log("\nEUR/USD was not found in the returned list.");
      ws.close();
      return;
    }

    console.log("\nRequesting EUR/USD candles...");

    ws.send(JSON.stringify({
      ticks_history: eurusd.underlying_symbol,
      count: 10,
      end: "latest",
      style: "candles",
      granularity: 900,
      req_id: 2
    }));
  }

  if (data.req_id === 2) {
    if (data.error) {
      console.error("Candle error:", data.error.message);
    } else {
      console.log("\nEUR/USD 15-minute candles:");

      console.log(
        JSON.stringify(data.candles, null, 2)
      );
    }

    ws.close();
  }
});

ws.on("error", error => {
  console.error("Deriv connection error:", error.message);
});

ws.on("close", () => {
  console.log("\nDeriv test finished.");
});
