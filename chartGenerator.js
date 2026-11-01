
import { Resvg } from "@resvg/resvg-js";

// Create a PNG chart from real market candles and signal levels
export function generateSignalChart(signal, candles) {
  if (!signal || !Array.isArray(candles) || candles.length < 10) {
    throw new Error("Insufficient data to generate signal chart");
  }

  const width = 1100;
  const height = 650;

  const chartLeft = 80;
  const chartRight = 850;
  const chartTop = 90;
  const chartBottom = 535;

  const recentCandles = candles.slice(-60);

  const levels = [
    Number(signal.stopLoss),
    Number(signal.entry),
    Number(signal.tp1),
    Number(signal.tp2)
  ];

  if (levels.some(value => !Number.isFinite(value))) {
    throw new Error("Invalid signal price levels");
  }

  const candleHigh = Math.max(...recentCandles.map(c => c.high));
  const candleLow = Math.min(...recentCandles.map(c => c.low));

  const highest = Math.max(candleHigh, ...levels);
  const lowest = Math.min(candleLow, ...levels);

  const padding = (highest - lowest) * 0.12 || 0.001;

  const maxPrice = highest + padding;
  const minPrice = lowest - padding;

  const priceToY = price =>
    chartBottom -
    ((price - minPrice) / (maxPrice - minPrice)) *
      (chartBottom - chartTop);

  const candleWidth = Math.min(
    10,
    (chartRight - chartLeft) / recentCandles.length * 0.55
  );

  const spacing =
    (chartRight - chartLeft) / recentCandles.length;

  const parts = [];

  parts.push(`
    <svg xmlns="http://www.w3.org/2000/svg"
         width="${width}" height="${height}"
         viewBox="0 0 ${width} ${height}">

      <rect width="100%" height="100%" fill="#07111f"/>

      <text x="40" y="42" fill="#ffffff"
            font-size="26" font-weight="bold">
        ${escapeXml(signal.symbol)} — ${escapeXml(signal.strategy)}
      </text>

      <text x="40" y="72" fill="#a9bdd3" font-size="17">
        15 MINUTE CHART
      </text>
  `);

  // Background grid
  for (let i = 0; i <= 5; i++) {
    const y = chartTop +
      (chartBottom - chartTop) * i / 5;

    const price =
      maxPrice - (maxPrice - minPrice) * i / 5;

    parts.push(`
      <line x1="${chartLeft}" y1="${y}"
            x2="${chartRight}" y2="${y}"
            stroke="#203147" stroke-width="1"/>

      <text x="${chartRight + 15}" y="${y + 5}"
            fill="#b9c7d8" font-size="14">
        ${price.toFixed(signal.symbol.includes("JPY") ? 3 : 5)}
      </text>
    `);
  }

  // Candlesticks
  recentCandles.forEach((candle, index) => {
    const x = chartLeft + spacing * index + spacing / 2;

    const openY = priceToY(candle.open);
    const closeY = priceToY(candle.close);
    const highY = priceToY(candle.high);
    const lowY = priceToY(candle.low);

    const bullish = candle.close >= candle.open;
    const color = bullish ? "#16c784" : "#ea3943";

    const bodyTop = Math.min(openY, closeY);
    const bodyHeight = Math.max(2, Math.abs(openY - closeY));

    parts.push(`
      <line x1="${x}" y1="${highY}"
            x2="${x}" y2="${lowY}"
            stroke="${color}" stroke-width="2"/>

      <rect x="${x - candleWidth / 2}"
            y="${bodyTop}"
            width="${candleWidth}"
            height="${bodyHeight}"
            fill="${color}"/>
    `);
  });

  // Draw signal levels
  const drawLevel = (name, price, color) => {
    const y = priceToY(price);

    parts.push(`
      <line x1="${chartLeft}" y1="${y}"
            x2="${chartRight}" y2="${y}"
            stroke="${color}" stroke-width="3"
            stroke-dasharray="9 6"/>

      <rect x="875" y="${y - 17}"
            width="205" height="34"
            rx="7" fill="${color}"/>

      <text x="887" y="${y + 6}"
            fill="#07111f" font-size="16"
            font-weight="bold">
        ${name}: ${price.toFixed(signal.symbol.includes("JPY") ? 3 : 5)}
      </text>
    `);
  };

  drawLevel("TP2", Number(signal.tp2), "#16c784");
  drawLevel("TP1", Number(signal.tp1), "#35d99b");
  drawLevel("ENTRY", Number(signal.entry), "#f5b942");
  drawLevel("SL", Number(signal.stopLoss), "#ea3943");

  const directionColor =
    signal.direction === "BUY" ? "#16c784" : "#ea3943";

  parts.push(`
      <rect x="40" y="565" width="1040" height="55"
            rx="12" fill="#142438"/>

      <text x="65" y="601" fill="${directionColor}"
            font-size="25" font-weight="bold">
        ${escapeXml(signal.direction)} ${escapeXml(signal.symbol)}
      </text>

      <text x="500" y="601" fill="#ffffff" font-size="18">
        Entry • SL • TP1 • TP2
      </text>

    </svg>
  `);

  const svg = parts.join("");

  const png = new Resvg(svg, {
    fitTo: {
      mode: "width",
      value: width
    }
  }).render().asPng();

  return png;
}

function escapeXml(value) {
  return String(value ?? "").replace(/[<>&"']/g, character => {
    const entities = {
      "<": "&lt;",
      ">": "&gt;",
      "&": "&amp;",
      '"': "&quot;",
      "'": "&apos;"
    };

    return entities[character];
  });
}
