const TelegramBot = require('node-telegram-bot-api');
const CryptoJS = require('crypto-js');
const express = require('express');
const mongoose = require('mongoose');
const axios = require('axios');

// ==========================================
// TES 3 CLÉS SECRÈTES SONT INTÉGRÉES ICI
// ==========================================
const TELEGRAM_TOKEN = '8356686051:AAG8oLxmyh5ydQECJsLHGx6NuX0usrp9tws'; 
const CRYPTO_TOKEN = '560322:AANNiutBDEetjqJWYimbnnzKYEigyogf0uh'; 
const MONGO_URL = 'mongodb+srv://speedmintcrypto01_db_user:p5iRYhy1X8rGsS5F@cluster0.rup8j1v.mongodb.net/minesbot?appName=Cluster0';
// ==========================================

// --- BASE DE DONNÉES (MongoDB) ---
mongoose.connect(MONGO_URL)
  .then(() => console.log('✅ Base de données connectée !'))
  .catch(err => console.log('❌ Erreur DB:', err));

const userSchema = new mongoose.Schema({
  userId: Number,
  expireAt: Date
});
const User = mongoose.model('User', userSchema);

// --- SERVEUR WEB (Render + Webhook Crypto) ---
const app = express();
app.use(express.json());

app.get('/', (req, res) => res.send('Bot VIP en ligne avec le menu des tarifs !'));

// La porte secrète pour recevoir l'argent
app.post('/crypto-webhook', async (req, res) => {
  const update = req.body;
  
  if (update.update_type === 'invoice_paid') {
    const payloadInfo = update.payload.payload; // Format: "IDCLIENT_JOURS" (ex: "123456_30")
    const parts = payloadInfo.split('_');
    const userId = parseInt(parts[0]);
    const daysToAdd = parseInt(parts[1]); 
    
    // On cherche l'utilisateur pour voir s'il a déjà du temps restant
    let user = await User.findOne({ userId: userId });
    let newExpiration = new Date();
    
    if (user && user.expireAt > new Date()) {
        // S'il est déjà VIP, on ajoute les jours à son temps restant
        newExpiration = new Date(user.expireAt);
    }
    newExpiration.setDate(newExpiration.getDate() + daysToAdd);

    await User.findOneAndUpdate(
      { userId: userId },
      { expireAt: newExpiration },
      { upsert: true, new: true }
    );

    bot.sendMessage(userId, `🎉 **Paiement reçu avec succès !**\n\nTon accès VIP a été prolongé de ${daysToAdd} jours.\nTu peux maintenant utiliser l'algorithme avec la commande \`/check\`.`, {parse_mode: "Markdown"});
  }
  res.sendStatus(200);
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`🚀 Serveur actif sur le port ${port}`));

// --- LE BOT TELEGRAM ---
const bot = new TelegramBot(TELEGRAM_TOKEN, {polling: true});

// --- FONCTION POUR GÉNÉRER LA FACTURE (EN USD) ---
async function createInvoice(userId, priceStr, days) {
  try {
    const response = await axios.post('https://pay.crypt.bot/api/createInvoice', {
      amount: priceStr,
      currency_type: 'fiat', // On demande à CryptoBot de gérer la conversion USD -> Crypto
      fiat: 'USD',
      payload: `${userId}_${days}` // On cache l'ID et le nombre de jours
    }, {
      headers: { 'Crypto-Pay-API-Token': CRYPTO_TOKEN }
    });
    return response.data.result.pay_url;
  } catch (error) {
    console.error('Erreur facture:', error.response ? error.response.data : error.message);
    return null;
  }
}

// --- VÉRIFICATION VIP ---
async function checkVIP(userId) {
  const user = await User.findOne({ userId: userId });
  if (!user) return false;
  return user.expireAt > new Date();
}

// --- COMMANDES TELEGRAM ---
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId, "🤖 **Bienvenue sur Mines VIP Checker !**\n\nPour utiliser l'algorithme, tu as besoin d'un accès VIP.\n\n💰 Envoie la commande `/pay` pour voir nos offres.\n💎 Si tu es déjà VIP, envoie `/check` suivi de tes paramètres.", {parse_mode: "Markdown"});
});

// Le menu interactif des paiements
bot.onText(/\/pay/, (msg) => {
  const chatId = msg.chat.id;
  
  const options = {
    reply_markup: {
      inline_keyboard: [
        [{ text: '🔘 1 Mois - 14.99$', callback_data: 'pay_30_14.99' }],
        [{ text: '🔘 3 Mois - 34.99$', callback_data: 'pay_90_34.99' }],
        [{ text: '🔘 6 Mois - 59.99$', callback_data: 'pay_180_59.99' }],
        [{ text: '🔘 1 An - 99.99$', callback_data: 'pay_365_99.99' }]
      ]
    }
  };
  
  bot.sendMessage(chatId, "💳 **Choisis ton abonnement VIP :**\n\n*Tu pourras payer avec la cryptomonnaie de ton choix (USDT, TON, BTC...) à l'étape suivante.*", options);
});

// Quand le client clique sur un bouton
bot.on('callback_query', async (callbackQuery) => {
  const msg = callbackQuery.message;
  const data = callbackQuery.data; // ex: 'pay_30_14.99'
  const chatId = msg.chat.id;

  // On dit à Telegram qu'on a bien reçu le clic (enlève le petit rond de chargement sur le bouton)
  bot.answerCallbackQuery(callbackQuery.id);

  if (data.startsWith('pay_')) {
    const parts = data.split('_');
    const days = parts[1];
    const price = parts[2];

    bot.sendMessage(chatId, `⏳ Création de ta facture de ${price}$ pour ${days} jours...`);
    
    const payUrl = await createInvoice(chatId, price, days);
    
    if (payUrl) {
      bot.sendMessage(chatId, `✅ **Ta facture est prête !**\n\n👉 ${payUrl}\n\n*Clique sur le lien, choisis ta crypto, et l'accès se débloquera automatiquement après le paiement.*`, {parse_mode: "Markdown"});
    } else {
      bot.sendMessage(chatId, "❌ Impossible de créer la facture pour le moment. Réessaie plus tard.");
    }
  }
});

// --- TA LOGIQUE DE JEU MINES ---
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

bot.onText(/\/check (.+) (.+) (.+) (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;

  const isVip = await checkVIP(chatId);
  if (!isVip) {
    bot.sendMessage(chatId, "❌ **Accès Refusé.**\nTon abonnement n'est pas actif ou a expiré.\n\nEnvoie `/pay` pour voir nos offres et devenir VIP.", {parse_mode: "Markdown"});
    return;
  }

  const game_seed = match[1];
  const client_seed = match[2];
  const server_seed = match[3];
  const mines_count = parseInt(match[4]);

  if (isNaN(mines_count) || mines_count < 1 || mines_count > 24) {
      bot.sendMessage(chatId, "❌ Le nombre de mines doit être entre 1 et 24.");
      return;
  }

  const mines = generateMines({ serverSeed: server_seed, clientSeed: client_seed, gameSeed: game_seed, minesCount: mines_count });

  let gridText = "✅ **Résultat VIP validé :**\n\n";
  for (let i = 0; i < 25; i++) {
    gridText += mines.includes(i) ? "💣 " : "💎 ";
    if ((i + 1) % 5 === 0) gridText += "\n";
  }

  bot.sendMessage(chatId, gridText, {parse_mode: "Markdown"});
});
