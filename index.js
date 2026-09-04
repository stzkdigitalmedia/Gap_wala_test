/**
 * GapWala Operator Platform — Full Stack Integration Server
 * =========================================================
 * - MongoDB-backed user management (register/login/balance)
 * - RSA-signed seamless login to RoyalBet
 * - Webhook callbacks for balance/bet/win stored in MongoDB
 * - Beautiful lobby UI served at http://localhost:5000
 *
 * SETUP:
 *   npm install
 *   node index.js
 */

require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const path = require('path');

const authRoutes = require('./src/routes/auth');
const gameRoutes = require('./src/routes/game');
const webhookRoutes = require('./src/routes/webhook');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── Raw body capture for RSA verification ────────────────────────────────────
app.use(express.json({
  verify: (req, res, buf) => { req.rawBody = buf; }
}));

// ─── MongoDB ──────────────────────────────────────────────────────────────────
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/gapwala_operator';
mongoose.connect(MONGODB_URI)
  .then(() => console.log('✅ MongoDB connected:', MONGODB_URI))
  .catch(err => { console.error('❌ MongoDB connection failed:', err.message); process.exit(1); });

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/game', gameRoutes);
app.use('/api', webhookRoutes);

// ─── Lobby Frontend ───────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>GapWala Pro — Casino Lobby</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;700;800;900&family=Playfair+Display:ital,wght@0,700;1,700&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #070913; --surface: #0e1225; --surface2: #151b35;
      --primary: #f59e0b; --primary-d: #d97706;
      --accent: #6366f1; --accent-d: #4f46e5;
      --success: #10b981; --danger: #ef4444;
      --text: #f1f5f9; --muted: #64748b; --border: rgba(255,255,255,0.06);
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: var(--bg); color: var(--text); font-family: 'Outfit', sans-serif; min-height: 100vh; }

    /* ── HEADER ── */
    header {
      background: rgba(14,18,37,0.9); backdrop-filter: blur(16px);
      border-bottom: 1px solid var(--border);
      padding: 0 5%; height: 68px;
      display: flex; align-items: center; justify-content: space-between;
      position: sticky; top: 0; z-index: 200;
    }
    .logo { font-family: 'Playfair Display', serif; font-size: 1.7rem; font-weight: 700; font-style: italic; }
    .logo em { color: var(--primary); font-style: normal; }
    .header-right { display: flex; align-items: center; gap: 12px; }
    .balance-badge {
      background: rgba(99,102,241,.15); border: 1px solid rgba(99,102,241,.3);
      border-radius: 99px; padding: 8px 18px; font-weight: 700; font-size: 0.95rem;
      display: flex; align-items: center; gap: 8px;
    }
    .balance-amount { color: var(--primary); font-size: 1.05rem; }
    .btn {
      border: none; border-radius: 12px; padding: 10px 20px;
      font-weight: 700; font-family: 'Outfit', sans-serif; cursor: pointer; transition: all .2s;
    }
    .btn-primary { background: var(--primary); color: #000; }
    .btn-primary:hover { background: var(--primary-d); }
    .btn-accent  { background: var(--accent);  color: #fff; }
    .btn-accent:hover  { background: var(--accent-d); }
    .btn-danger  { background: var(--danger);  color: #fff; }
    .btn-ghost   { background: rgba(255,255,255,.07); color: var(--text); }
    .btn-ghost:hover { background: rgba(255,255,255,.12); }
    .btn-sm      { padding: 7px 14px; font-size: 0.85rem; border-radius: 10px; }

    /* ── AUTH OVERLAY ── */
    .auth-overlay {
      position: fixed; inset: 0; z-index: 300;
      background: rgba(7,9,19,.96); backdrop-filter: blur(6px);
      display: flex; align-items: center; justify-content: center; padding: 1rem;
    }
    .auth-box {
      background: var(--surface); border: 1px solid var(--border);
      border-radius: 28px; padding: 2.5rem; width: 100%; max-width: 440px;
      box-shadow: 0 32px 80px rgba(0,0,0,.6);
    }
    .auth-box h2 { font-size: 1.8rem; font-weight: 800; margin-bottom: 0.25rem; }
    .auth-box p  { color: var(--muted); font-size: 0.9rem; margin-bottom: 1.75rem; }
    .form-group  { margin-bottom: 1.1rem; }
    .form-group label { display: block; font-weight: 600; font-size: 0.85rem; color: var(--muted); margin-bottom: 6px; }
    .form-group input, .form-group select {
      width: 100%; background: var(--bg); border: 1.5px solid rgba(255,255,255,.1);
      border-radius: 12px; padding: 12px 16px; color: var(--text);
      font-family: 'Outfit', sans-serif; font-size: 1rem; outline: none;
      transition: border-color .2s;
    }
    .form-group input:focus, .form-group select:focus { border-color: var(--accent); }
    .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .auth-toggle { text-align: center; margin-top: 1.25rem; color: var(--muted); font-size: 0.9rem; }
    .auth-toggle span { color: var(--accent); cursor: pointer; font-weight: 600; }
    .auth-toggle span:hover { text-decoration: underline; }
    .auth-submit { width: 100%; padding: 14px; font-size: 1rem; border-radius: 14px; margin-top: 0.5rem; }
    .alert { border-radius: 10px; padding: 10px 14px; font-size: 0.9rem; font-weight: 600; margin-bottom: 1rem; }
    .alert-error   { background: rgba(239,68,68,.12); border: 1px solid rgba(239,68,68,.3); color: #fca5a5; }
    .alert-success { background: rgba(16,185,129,.12); border: 1px solid rgba(16,185,129,.3); color: #6ee7b7; }

    /* ── MAIN ── */
    main { max-width: 1200px; margin: 0 auto; padding: 3rem 5%; display: flex; flex-direction: column; gap: 3rem; }

    /* ── HERO ── */
    .hero {
      background: linear-gradient(135deg, rgba(99,102,241,.12), rgba(245,158,11,.06));
      border: 1px solid var(--border); border-radius: 28px;
      padding: 4rem 3rem; text-align: center; position: relative; overflow: hidden;
    }
    .hero::before {
      content: ''; position: absolute; top: -80px; right: -80px;
      width: 350px; height: 350px; border-radius: 50%;
      background: radial-gradient(circle, rgba(99,102,241,.15), transparent 70%);
    }
    .hero h1 { font-size: clamp(2rem, 4vw, 3.2rem); font-weight: 900; letter-spacing: -.02em; margin-bottom: .75rem; }
    .hero h1 em { font-style: normal; background: linear-gradient(90deg, var(--primary), #fbbf24); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    .hero p { color: var(--muted); font-size: 1.05rem; max-width: 550px; margin: 0 auto 2rem; line-height: 1.6; }
    .user-greeting { font-size: 1.15rem; font-weight: 600; color: var(--success); margin-bottom: 1.5rem; }

    /* ── WALLET PANEL ── */
    .wallet-panel {
      background: var(--surface); border: 1px solid var(--border); border-radius: 24px;
      padding: 1.75rem 2rem; display: flex; flex-wrap: wrap; gap: 1.25rem; align-items: flex-end;
    }
    .wallet-panel h3 { width: 100%; font-size: 1rem; font-weight: 700; color: var(--muted); margin-bottom: -.25rem; }
    .wp-field { display: flex; flex-direction: column; gap: 6px; flex: 1; min-width: 160px; }
    .wp-field label { font-weight: 600; font-size: 0.82rem; color: var(--muted); }
    .wp-field input {
      background: var(--bg); border: 1.5px solid rgba(255,255,255,.1); border-radius: 12px;
      padding: 11px 14px; color: var(--text); font-family: 'Outfit',sans-serif; font-size: .95rem; outline: none;
      transition: border-color .2s;
    }
    .wp-field input:focus { border-color: var(--primary); }

    /* ── GAMES GRID ── */
    .section-title {
      font-size: 1.6rem; font-weight: 800; position: relative; padding-left: 14px;
    }
    .section-title::before {
      content: ''; position: absolute; left: 0; top: 50%; transform: translateY(-50%);
      width: 4px; height: 22px; background: var(--primary); border-radius: 4px;
    }
    .games-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1.5rem; }
    .game-card {
      background: var(--surface); border: 1px solid var(--border); border-radius: 22px;
      overflow: hidden; transition: all .3s ease; display: flex; flex-direction: column;
    }
    .game-card:hover { transform: translateY(-5px); border-color: rgba(245,158,11,.25); box-shadow: 0 16px 40px rgba(0,0,0,.5); }
    .game-thumb {
      height: 175px; background: linear-gradient(135deg, #1a1040, #0f1d40);
      display: flex; align-items: center; justify-content: center; position: relative;
    }
    .game-thumb-icon { font-size: 4rem; transition: transform .4s ease; }
    .game-card:hover .game-thumb-icon { transform: scale(1.15) rotate(5deg); }
    .game-badge {
      position: absolute; top: 12px; left: 12px; background: var(--accent);
      font-size: .7rem; font-weight: 800; text-transform: uppercase; letter-spacing: .07em;
      padding: 4px 10px; border-radius: 6px;
    }
    .game-info { padding: 1.5rem; flex: 1; display: flex; flex-direction: column; gap: .8rem; }
    .game-info h3 { font-size: 1.15rem; font-weight: 700; }
    .game-info p  { color: var(--muted); font-size: .875rem; line-height: 1.5; flex: 1; }

    /* ── TX HISTORY PANEL ── */
    .txn-panel {
      background: var(--surface); border: 1px solid var(--border); border-radius: 24px; overflow: hidden;
    }
    .txn-panel-header {
      padding: 1.5rem 2rem; display: flex; align-items: center; justify-content: space-between;
      border-bottom: 1px solid var(--border);
    }
    .txn-panel-header h3 { font-size: 1.1rem; font-weight: 800; }
    .txn-table { width: 100%; border-collapse: collapse; font-size: .875rem; }
    .txn-table th {
      padding: 12px 20px; text-align: left; color: var(--muted);
      font-weight: 600; font-size: .8rem; text-transform: uppercase; letter-spacing: .05em;
      border-bottom: 1px solid var(--border);
    }
    .txn-table td { padding: 13px 20px; border-bottom: 1px solid rgba(255,255,255,.03); }
    .txn-table tr:last-child td { border-bottom: none; }
    .txn-table tr:hover td { background: rgba(255,255,255,.02); }
    .type-badge {
      padding: 3px 10px; border-radius: 6px; font-size: .75rem; font-weight: 800;
      text-transform: uppercase; letter-spacing: .05em;
    }
    .type-bet    { background: rgba(239,68,68,.15);   color: #fca5a5; }
    .type-win    { background: rgba(16,185,129,.15);  color: #6ee7b7; }
    .type-loss   { background: rgba(100,116,139,.15); color: #94a3b8; }
    .type-refund { background: rgba(99,102,241,.15);  color: #a5b4fc; }

    /* ── GAME OVERLAY ── */
    .game-overlay {
      position: fixed; inset: 0; z-index: 400; background: #000;
      display: none; flex-direction: column;
    }
    .game-overlay.active { display: flex; }
    .game-overlay-bar {
      background: #090b18; border-bottom: 1px solid var(--border);
      height: 60px; padding: 0 5%;
      display: flex; align-items: center; justify-content: space-between; flex-shrink: 0;
    }
    .game-iframe { width: 100%; flex: 1; border: none; }
  </style>
</head>
<body>

<!-- HEADER -->
<header>
  <div class="logo">Gap<em>Wala</em> Pro</div>
  <div class="header-right">
    <div class="balance-badge" id="balanceBadge" style="display:none">
      <span>💰</span>
      <span class="balance-amount" id="headerBalance">₹0</span>
    </div>
    <button class="btn btn-ghost btn-sm" id="txnBtn" style="display:none" onclick="loadTxns()">History</button>
    <button class="btn btn-danger  btn-sm" id="logoutBtn" style="display:none" onclick="logout()">Logout</button>
    <button class="btn btn-accent  btn-sm" id="loginHeaderBtn" onclick="showAuth('login')">Login</button>
  </div>
</header>

<!-- AUTH OVERLAY -->
<div class="auth-overlay" id="authOverlay">
  <div class="auth-box">
    <div id="authAlert" style="display:none"></div>

    <!-- LOGIN FORM -->
    <div id="loginForm">
      <h2>Welcome Back 👋</h2>
      <p>Sign in to access your GapWala Pro account</p>
      <div class="form-group">
        <label>Username or Email</label>
        <input type="text" id="loginUsername" placeholder="yourname">
      </div>
      <div class="form-group">
        <label>Password</label>
        <input type="password" id="loginPassword" placeholder="••••••••">
      </div>
      <button class="btn btn-primary auth-submit" onclick="doLogin()">Sign In</button>
      <div class="auth-toggle">
        Don't have an account? <span onclick="switchForm('register')">Create one</span>
      </div>
    </div>

    <!-- REGISTER FORM -->
    <div id="registerForm" style="display:none">
      <h2>Create Account 🎮</h2>
      <p>Join GapWala Pro and start playing with seamless wallet integration</p>
      <div class="form-group">
        <label>Username</label>
        <input type="text" id="regUsername" placeholder="player123">
      </div>
      <div class="form-group">
        <label>Email</label>
        <input type="email" id="regEmail" placeholder="you@email.com">
      </div>
      <div class="form-group">
        <label>Password</label>
        <input type="password" id="regPassword" placeholder="••••••••">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label>Opening Balance (₹)</label>
          <input type="number" id="regBalance" value="10000" min="0" placeholder="10000">
        </div>
        <div class="form-group">
          <label>Currency</label>
          <select id="regCurrency">
            <option value="INR">INR (₹)</option>
            <option value="USD">USD ($)</option>
          </select>
        </div>
      </div>
      <button class="btn btn-primary auth-submit" onclick="doRegister()">Create Account</button>
      <div class="auth-toggle">
        Already have an account? <span onclick="switchForm('login')">Sign in</span>
      </div>
    </div>
  </div>
</div>

<!-- LOBBY -->
<main>
  <div class="hero">
    <div id="guestHero">
      <h1>The <em>Premium</em> Gaming Lobby</h1>
      <p>Sign in or create an account to access seamless wallet-integrated crash games powered by RoyalBet Engine.</p>
      <button class="btn btn-primary" style="padding: 14px 36px; font-size: 1rem;" onclick="showAuth('register')">Get Started →</button>
    </div>
    <div id="userHero" style="display:none">
      <p class="user-greeting">Hello, <span id="heroUsername"></span>! Ready to play? 🎲</p>
      <h1>Your <em>Balance</em> is Live</h1>
      <p>Your wallet is connected and live. Every bet and win updates your balance instantly via seamless wallet callbacks.</p>
    </div>
  </div>

  <!-- WALLET MANAGEMENT (shown only when logged in) -->
  <div class="wallet-panel" id="walletPanel" style="display:none">
    <h3>💳 Wallet Management</h3>
    <div class="wp-field">
      <label>Set New Balance (₹)</label>
      <input type="number" id="newBalance" placeholder="e.g. 5000">
    </div>
    <button class="btn btn-primary" onclick="updateBalance()">Update Balance</button>
    <div class="wp-field" style="min-width: 80px; max-width: 80px; align-items: center; justify-content: flex-end;">
      <label style="opacity:0">.</label>
      <button class="btn btn-ghost" onclick="loadTxns()" style="width:100%">🔄 History</button>
    </div>
  </div>

  <!-- GAMES -->
  <div>
    <h2 class="section-title">Featured Games</h2>
    <div class="games-grid">
      <div class="game-card">
        <div class="game-thumb">
          <span class="game-badge">Crash Game</span>
          <span class="game-thumb-icon">🛗</span>
        </div>
        <div class="game-info">
          <h3>Elevator Royale</h3>
          <p>Multiplayer crash game. Predict the floor before crash and cash out up to 100x! Integrated via seamless wallet.</p>
          <button class="btn btn-primary" onclick="launchGame('royalbet-elevator', this)">▶ Play Now</button>
        </div>
      </div>
      <div class="game-card">
        <div class="game-thumb">
          <span class="game-badge">Board Game</span>
          <span class="game-thumb-icon">🎲</span>
        </div>
        <div class="game-info">
          <h3>Classic Ludo</h3>
          <p>Play the classic board game against real players. Roll the dice and win big! Integrated via seamless wallet.</p>
          <button class="btn btn-primary" onclick="launchGame('ludo-classic', this)">▶ Play Now</button>
        </div>
      </div>
      <div class="game-card" style="opacity:.5">
        <div class="game-thumb">
          <span class="game-badge" style="background:#374151">Coming Soon</span>
          <span class="game-thumb-icon">🎰</span>
        </div>
        <div class="game-info">
          <h3>Fortune Slots</h3>
          <p>Vegas-style slot machine with wild symbols and bonus rounds. Coming soon to GapWala Pro.</p>
          <button class="btn btn-ghost" disabled>Locked</button>
        </div>
      </div>
    </div>
  </div>

  <!-- TRANSACTION HISTORY PANEL -->
  <div class="txn-panel" id="txnPanel" style="display:none">
    <div class="txn-panel-header">
      <h3>📋 Transaction History</h3>
      <button class="btn btn-ghost btn-sm" onclick="document.getElementById('txnPanel').style.display='none'">Close ✕</button>
    </div>
    <div style="overflow-x:auto">
      <table class="txn-table">
        <thead>
          <tr>
            <th>Time</th>
            <th>Type</th>
            <th>Amount</th>
            <th>Balance After</th>
            <th>Round ID</th>
            <th>Remarks</th>
          </tr>
        </thead>
        <tbody id="txnTableBody">
          <tr><td colspan="6" style="text-align:center;padding:2rem;color:var(--muted)">Loading...</td></tr>
        </tbody>
      </table>
    </div>
  </div>
</main>

<!-- GAME OVERLAY -->
<div class="game-overlay" id="gameOverlay">
  <div class="game-overlay-bar">
    <div class="logo" style="font-size:1.3rem">Gap<em style="color:var(--primary)">Wala</em> Pro</div>
    <div style="display:flex;align-items:center;gap:12px">
      <div class="balance-badge" style="padding:6px 14px;font-size:.9rem">
        <span>💰</span>
        <span class="balance-amount" id="overlayBalance">₹0</span>
      </div>
      <button class="btn btn-danger btn-sm" onclick="closeGame()">Exit Game</button>
    </div>
  </div>
  <iframe class="game-iframe" id="gameIframe" src="about:blank"></iframe>
</div>

<script>
  let token = localStorage.getItem('gw_token');
  let currentUser = null;

  // ── Auth UI ────────────────────────────────────────────────────────────────
  function showAuth(mode = 'login') {
    document.getElementById('authOverlay').style.display = 'flex';
    switchForm(mode);
    clearAlert();
  }
  function switchForm(mode) {
    document.getElementById('loginForm').style.display    = mode === 'login'    ? '' : 'none';
    document.getElementById('registerForm').style.display = mode === 'register' ? '' : 'none';
    clearAlert();
  }
  function clearAlert() {
    const el = document.getElementById('authAlert');
    el.style.display = 'none';
    el.className = 'alert';
    el.innerHTML = '';
  }
  function showAlert(msg, type = 'error') {
    const el = document.getElementById('authAlert');
    el.style.display = '';
    el.className = 'alert alert-' + type;
    el.textContent = msg;
  }
  function loginHeaderBtn(show) {
    document.getElementById('loginHeaderBtn').style.display = show ? '' : 'none';
  }

  // ── Set User State ─────────────────────────────────────────────────────────
  function setUser(user, tok) {
    currentUser = user;
    if (tok) { token = tok; localStorage.setItem('gw_token', tok); }
    document.getElementById('authOverlay').style.display = 'none';
    document.getElementById('balanceBadge').style.display = '';
    document.getElementById('txnBtn').style.display       = '';
    document.getElementById('logoutBtn').style.display    = '';
    document.getElementById('loginHeaderBtn').style.display = 'none';
    document.getElementById('walletPanel').style.display  = '';
    document.getElementById('guestHero').style.display    = 'none';
    document.getElementById('userHero').style.display     = '';
    document.getElementById('heroUsername').textContent   = user.username;
    updateBalanceDisplay(user.balance, user.currency);
  }
  function updateBalanceDisplay(bal, cur) {
    const sym = cur === 'INR' ? '₹' : '$';
    const formatted = sym + Math.round(bal).toLocaleString('en-IN');
    document.getElementById('headerBalance').textContent  = formatted;
    document.getElementById('overlayBalance').textContent = formatted;
    if (currentUser) currentUser.balance = bal;
  }

  // ── Login ──────────────────────────────────────────────────────────────────
  async function doLogin() {
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value;
    if (!username || !password) return showAlert('Please fill all fields');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (!data.success) return showAlert(data.message || 'Login failed');
      setUser(data.user, data.token);
    } catch (e) { showAlert('Server error'); }
  }

  // ── Register ───────────────────────────────────────────────────────────────
  async function doRegister() {
    const username = document.getElementById('regUsername').value.trim();
    const email    = document.getElementById('regEmail').value.trim();
    const password = document.getElementById('regPassword').value;
    const balance  = document.getElementById('regBalance').value;
    const currency = document.getElementById('regCurrency').value;
    if (!username || !email || !password) return showAlert('Please fill all required fields');
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password, balance: parseFloat(balance)||0, currency })
      });
      const data = await res.json();
      if (!data.success) return showAlert(data.message || 'Registration failed');
      showAlert('Account created! Welcome ' + data.user.username, 'success');
      setTimeout(() => setUser(data.user, data.token), 800);
    } catch (e) { showAlert('Server error'); }
  }

  // ── Update Balance ─────────────────────────────────────────────────────────
  async function updateBalance() {
    const bal = parseFloat(document.getElementById('newBalance').value);
    if (isNaN(bal) || bal < 0) return alert('Enter a valid balance');
    try {
      const res = await fetch('/api/auth/balance', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({ balance: bal })
      });
      const data = await res.json();
      if (data.success) {
        updateBalanceDisplay(data.user.balance, data.user.currency);
        document.getElementById('newBalance').value = '';
        alert('Balance updated to ₹' + Math.round(data.user.balance).toLocaleString('en-IN'));
      }
    } catch (e) { alert('Update failed'); }
  }

  // ── Launch Game ─────────────────────────────────────────────────────────────
  async function launchGame(gameId, btn) {
    if (!token) return showAuth('login');
    const originalText = btn.textContent;
    btn.textContent = 'Launching...'; btn.disabled = true;
    try {
      const res = await fetch('/api/game/launch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({ gameId })
      });
      const data = await res.json();
      if (data.success && data.gameUrl) {
        document.getElementById('gameIframe').src = data.gameUrl;
        document.getElementById('gameOverlay').classList.add('active');
      } else {
        alert('Launch failed: ' + (data.error || 'Server error'));
      }
    } catch (e) { alert('Failed to connect to Game Server'); }
    finally { btn.textContent = originalText; btn.disabled = false; }
  }
  function closeGame() {
    document.getElementById('gameOverlay').classList.remove('active');
    document.getElementById('gameIframe').src = 'about:blank';
    // Re-fetch balance to show updated value
    fetchMe();
  }

  // ── Load Transactions ───────────────────────────────────────────────────────
  async function loadTxns() {
    document.getElementById('txnPanel').style.display = '';
    document.getElementById('txnTableBody').innerHTML =
      '<tr><td colspan="6" style="text-align:center;padding:2rem;color:var(--muted)">Loading...</td></tr>';
    try {
      const res  = await fetch('/api/game/transactions?limit=30', {
        headers: { 'Authorization': 'Bearer ' + token }
      });
      const data = await res.json();
      if (!data.success || !data.data.length) {
        document.getElementById('txnTableBody').innerHTML =
          '<tr><td colspan="6" style="text-align:center;padding:2rem;color:var(--muted)">No transactions yet. Play a game!</td></tr>';
        return;
      }
      document.getElementById('txnTableBody').innerHTML = data.data.map(t => {
        const sign   = t.type === 'bet' ? '-' : t.type === 'win' ? '+' : '';
        const clr    = t.type === 'win' ? 'var(--success)' : t.type === 'bet' ? 'var(--danger)' : 'var(--muted)';
        const badges = { bet:'type-bet', win:'type-win', loss:'type-loss', refund:'type-refund' };
        return \`<tr>
          <td style="color:var(--muted);font-size:.8rem">\${new Date(t.createdAt).toLocaleString('en-IN')}</td>
          <td><span class="type-badge \${badges[t.type] || ''}">\${t.type}</span></td>
          <td style="font-weight:700;color:\${clr}">\${sign}₹\${Math.round(t.amount).toLocaleString('en-IN')}</td>
          <td style="font-weight:600">₹\${Math.round(t.balanceAfter||0).toLocaleString('en-IN')}</td>
          <td style="color:var(--muted);font-size:.8rem;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">\${t.gap_gameRoundId||'—'}</td>
          <td style="color:var(--muted);font-size:.85rem">\${t.remarks||'—'}</td>
        </tr>\`;
      }).join('');
    } catch (e) { console.error(e); }
  }

  // ── Logout ─────────────────────────────────────────────────────────────────
  function logout() {
    token = null; currentUser = null;
    localStorage.removeItem('gw_token');
    location.reload();
  }

  // ── Fetch current user on load ─────────────────────────────────────────────
  async function fetchMe(silent = false) {
    if (!token) { showAuth('login'); return; }
    try {
      const res  = await fetch('/api/auth/me', { headers: { 'Authorization': 'Bearer ' + token } });
      const data = await res.json();
      if (data.success) { setUser(data.user, null); }
      else { showAuth('login'); }
    } catch (e) { showAuth('login'); }
  }

  // On page load
  if (token) { fetchMe(); } else { showAuth('login'); }

  // Poll balance every 5 seconds
  setInterval(() => {
    if (token && document.getElementById('lobby-view').classList.contains('active')) {
      fetchMe(true);
    }
  }, 5000);

</script>
</body>
</html>`);
});

// ─── Start Server ─────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log('');
  console.log('🎰 GapWala Pro Operator Platform');
  console.log('--------------------------------------------------');
  console.log('Lobby:     http://localhost:' + PORT);
  console.log('Callbacks: http://localhost:' + PORT + '/api/*');
  console.log('MongoDB:   ' + MONGODB_URI);
  console.log('--------------------------------------------------');
  console.log('');
});
