const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const axios = require('axios');
const auth = require('../middleware/auth');
const User = require('../models/User');
const GameTransaction = require('../models/GameTransaction');
const KEYS = require('../config/keys');

const ROYALBET_API_URL = process.env.ROYALBET_API_URL || 'http://localhost:4000';
const OPERATOR_ID = process.env.OPERATOR_ID || 'GapWala_Pro';

function generateSignature(payload) {
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(JSON.stringify(payload));
  return signer.sign(KEYS.OPERATOR_PRIVATE_KEY, 'base64');
}

// POST /api/game/launch — Generate a seamless launch URL
router.post('/launch', auth, async (req, res) => {
  const user = await User.findById(req.user._id);
  if (!user) return res.status(404).json({ success: false, message: 'User not found' });

  const gameId = req.body.gameId || 'royalbet-elevator';
  const targetApiUrl = gameId === 'ludo-classic' ? 'http://localhost:8080' : ROYALBET_API_URL;

  const payload = {
    operatorId: OPERATOR_ID,
    userId: user._id,        // Stable external user ID
    username: user.username,
    balance: user.balance,
    currency: user.currency,
    platformId: 'web',
    gameId: gameId,
    clientIp: req.ip || '127.0.0.1',
  };

  const signature = generateSignature(payload);

  try {
    const response = await axios.post(`${targetApiUrl}/api/operator/login`, payload, {
      headers: { 'Content-Type': 'application/json', 'Signature': signature }
    });

    if (response.data && response.data.status === 1) {
      return res.json({ success: true, gameUrl: response.data.url });
    } else {
      return res.status(400).json({ success: false, error: response.data.errorDescription || 'Auth failed' });
    }
  } catch (err) {
    console.error('Launch error:', err.response?.data || err.message);
    return res.status(500).json({ success: false, error: err.response?.data?.message || 'RoyalBet connection failed' });
  }
});

// GET /api/game/transactions — Get transaction history for logged-in user
router.get('/transactions', auth, async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [txns, total] = await Promise.all([
    GameTransaction.find({ userId: req.user.username })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit)),
    GameTransaction.countDocuments({ userId: req.user.username }),
  ]);

  res.json({
    success: true,
    data: txns,
    meta: { total, page: parseInt(page), limit: parseInt(limit), totalPages: Math.ceil(total / parseInt(limit)) }
  });
});

module.exports = router;
