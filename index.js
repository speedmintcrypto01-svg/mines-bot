const TelegramBot = require('node-telegram-bot-api');
const CryptoJS = require('crypto-js');
const express = require('express');

// 1. --- SERVEUR WEB POUR RENDER ---
const app = express();
app.get('/', (req, res) => res.send('Le Bot Mines est en ligne !'));
const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Serveur actif sur le port ${port}`));

// 2. --- CONFIGURATION DU BOT ---
// Ton token est maintenant intégré
const token = '8356686051:AAG8oLxmyh5ydQECJsLHGx6NuX0usrp9tws'; 
const bot = new TelegramBot(token, {polling: true});

// 3. --- LOGIQUE DE CALCUL (TON CODE) ---
const bits = 53;
const bytes = Math.floor(bits / 4);
const maxValue = Math.pow(2, bits - 1);

function getHash({ gameId = "mines", serverSeed, clientSeed, gameSeed, cursor }) {
  return CryptoJS.HmacSHA256(`${gameId}:${clientSeed}:${gameSeed}:${cursor}`, serverSeed);
}

function generateMines({ serverSeed, clientSeed, gameSeed, minesCount, gridSize = 25 }) {
  const positions = Array.from({ length: gridSize }, (_, i) => i);
  let cursor = 0;
  let hashCursor = 0;
  let hash = getHash({ serverSeed, clientSeed, gameSeed, cursor }).toString();

  for (let i = positions.length - 1; i > 0; i--) {
    let outcome = hash.slice(hashCursor, hashCursor + bytes);
    if (outcome.length < bytes) {
      cursor++;
      hash = getHash({ serverSeed, clientSeed, gameSeed, cursor }).toString();
      hashCursor = 0;
      outcome = hash.slice(hashCursor, hashCursor + bytes);
    }
    outcome = parseInt(outcome, 16) / maxValue;
    const j = Math.floor(outcome * (i + 1));
    [positions[i], positions[j]] = [positions[j], positions[i]];
    hashCursor += bytes;
  }
  return positions.slice(0, minesCount);
}

// 4. --- COMMANDES TELEGRAM ---
bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id, "🤖 Bienvenue ! Envoie la commande :\n`/check game_seed client_seed server_seed mines_count`", {parse_mode: "Markdown"});
});

bot.onText(/\/check (.+) (.+) (.+) (.+)/, (msg, match) => {
  const chatId = msg.chat.id;
  const game_seed = match[1];
  const client_seed = match[2];
  const server_seed = match[3];
  const mines_count = parseInt(match[4]);

  if (isNaN(mines_count) || mines_count < 1 || mines_count > 24) {
      bot.sendMessage(chatId, "❌ Le nombre de mines doit être entre 1 et 24.");
      return;
  }

  const mines = generateMines({ serverSeed: server_seed, clientSeed: client_seed, gameSeed: game_seed, minesCount: mines_count });

  let gridText = "✅ **Résultat des Mines :**\n\n";
  for (let i = 0; i < 25; i++) {
    gridText += mines.includes(i) ? "💣 " : "💎 ";
    if ((i + 1) % 5 === 0) gridText += "\n";
  }

  bot.sendMessage(chatId, gridText, {parse_mode: "Markdown"});
});
