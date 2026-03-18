require('dotenv').config();

console.log("🚀 Starting bot...");

const TelegramBot = require('node-telegram-bot-api');
const sqlite3 = require('sqlite3').verbose();
const { ChartJSNodeCanvas } = require('chartjs-node-canvas');
require('chart.js/auto');

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });
const db = new sqlite3.Database('./database.db');

// ===== CONFIG: Replace with your private channel =====
const CHANNEL = -1003861424843; // or numeric ID like -1001234567890

const chartCanvas = new ChartJSNodeCanvas({
  width: 800,
  height: 400
});

// ===== DATABASE =====
db.serialize(() => {
  db.run(`
  CREATE TABLE IF NOT EXISTS signals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    multiplier REAL,
    result REAL,
    status TEXT
  )`);
  console.log("✅ Database ready");
});

// ===== SIGNAL GENERATOR =====
function generateSignal() {
  const r = Math.random();
  if (r < 0.6) return parseFloat((Math.random()*1.5 + 1.2).toFixed(2));
  if (r < 0.9) return parseFloat((Math.random()*2 + 2).toFixed(2));
  return parseFloat((Math.random()*4 + 4).toFixed(2));
}

// ===== CHART GENERATOR =====
async function generateChart(multiplier) {
  let data = [];
  let value = 1;

  for (let i = 0; i < 20; i++) {
    value = Math.max(0, value + (Math.random() - 0.5) * 0.5);
    data.push(parseFloat(value.toFixed(2)));
  }

  data.push(multiplier);

  return await chartCanvas.renderToBuffer({
    type: 'line',
    data: {
      labels: data.map((_, i) => i + 1),
      datasets: [{
        label: 'AI Market Trend',
        data: data,
        borderColor: 'rgba(75, 192, 192, 1)',
        backgroundColor: 'rgba(75, 192, 192, 0.2)',
        tension: 0.4
      }]
    }
  });
}

// ===== MESSAGES =====
function signalMessage(id, m) {
  return `
🤖 *AI SIGNAL #${id}*

🎯 Entry: *${m}x*

📊 Confidence: ${m <= 2 ? "🟢 Strong" : m <= 4 ? "🟡 Medium" : "🔴 High Risk"}

━━━━━━━━━━━━━━━
⏱ Result in 15 sec
`;
}

function resultMessage(m, r, status) {
  return `
📊 *RESULT*

🎯 Entry: *${m}x*
💥 Result: *${r}x*

${status === "WIN" ? "✅ WIN" : "❌ LOSS"}
━━━━━━━━━━━━━━━
`;
}

// ===== START BOT =====
async function startBot() {
  async function autoPost() {
    console.log("⏱ Sending signal...");

    const multiplier = generateSignal();

    db.run(`INSERT INTO signals (multiplier) VALUES (?)`, [multiplier], async function () {
      const id = this.lastID;
      const chart = await generateChart(multiplier);

      bot.sendPhoto(CHANNEL, chart, {
        caption: signalMessage(id, multiplier),
        parse_mode: "Markdown"
      }).catch(err => console.log("❌ Send error:", err.message));

      // Send result after 15 seconds
      setTimeout(() => {
        const crash = parseFloat((Math.random()*5 + 1).toFixed(2));
        const status = crash >= multiplier ? "WIN" : "LOSS";

        db.run(`UPDATE signals SET result=?, status=? WHERE id=?`,
          [crash, status, id]);

        bot.sendMessage(CHANNEL,
          resultMessage(multiplier, crash, status),
          { parse_mode: "Markdown" }
        );
      }, 15000);

    });
  }

  autoPost();
  setInterval(autoPost, 30000);
}

// ===== /start COMMAND =====
bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id, `
🤖 Bot Ready

📊 Signals every 30 seconds  
📈 AI-style charts  
🔥 Posting directly to your private channel
  `);
});

// ===== POLLING ERRORS =====
bot.on("polling_error", console.log);

// ===== RUN BOT =====
startBot();