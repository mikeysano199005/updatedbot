require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const sqlite3 = require('sqlite3').verbose();
const { ChartJSNodeCanvas } = require('chartjs-node-canvas');
const Chart = require('chart.js');
const express = require('express');

// ===== EXPRESS KEEP-ALIVE SERVER =====
const app = express();
app.get('/', (req, res) => res.send('Bot is running'));
app.listen(process.env.PORT || 3000);

// ===== TELEGRAM BOT =====
const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });
const db = new sqlite3.Database('./database.db');
const chartCanvas = new ChartJSNodeCanvas({ width: 800, height: 400 });

// ===== CHANNEL SETUP =====
let CHANNEL = process.env.CHANNEL ? Number(process.env.CHANNEL) : null;

// ===== DATABASE =====
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    )`);

  db.run(`
    CREATE TABLE IF NOT EXISTS signals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      multiplier REAL,
      result REAL,
      status TEXT
    )`);

  console.log("✅ Database ready");
});

// ===== SAVE CHANNEL =====
function saveChannel(id) {
  CHANNEL = id;
  db.run(`INSERT OR REPLACE INTO settings (key,value) VALUES ('channel', ?)`, [id]);
}

// ===== START COMMAND =====
bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id, `
🤖 Bot Ready

📊 Signals every 30 seconds  
📈 AI-style charts  
🔥 Stay tuned...
  `);
});

// ===== SIGNAL GENERATION =====
function generateSignal() {
  const r = Math.random();
  if (r < 0.6) return (Math.random() * 1.5 + 1.2).toFixed(2);
  if (r < 0.9) return (Math.random() * 2 + 2).toFixed(2);
  return (Math.random() * 4 + 4).toFixed(2);
}

// ===== CHART GENERATION =====
async function generateChart(multiplier) {
  let data = [];
  let value = 1;

  for (let i = 0; i < 20; i++) {
    value += (Math.random() - 0.3);
    data.push(value);
  }

  data.push(Number(multiplier));

  return await chartCanvas.renderToBuffer({
    type: 'line',
    data: {
      labels: data.map((_, i) => i + 1),
      datasets: [{
        label: 'AI Market Trend',
        data: data,
        tension: 0.4
      }]
    }
  });
}

// ===== MESSAGE FORMATTING =====
function signalMessage(id, m) {
  return `
🤖 *AI SIGNAL #${id}*

🎯 Entry: *${m}x*

📊 Confidence:
${m <= 2 ? "🟢 Strong" : m <= 4 ? "🟡 Medium" : "🔴 High Risk"}

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

// ===== MAIN LOOP =====
function startBot() {
  if (!CHANNEL) {
    console.log("⚠️ No channel set. Set CHANNEL env variable to your numeric channel ID.");
    return;
  }

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

      setTimeout(() => {
        const crash = (Math.random() * 5 + 1).toFixed(2);
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

// ===== POLLING ERRORS =====
bot.on("polling_error", console.log);

// ===== START BOT =====
startBot();