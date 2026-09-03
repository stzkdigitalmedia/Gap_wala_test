const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const auth = require('../middleware/auth');

const JWT_SECRET = process.env.JWT_SECRET || 'gapwala_super_secret_jwt_key_2026';

// POST /api/auth/register
router.post('/register', async (req, res) => {
  const { username, email, password, balance, currency } = req.body;
  if (!username || !email || !password) {
    return res.status(400).json({ success: false, message: 'Username, email and password are required' });
  }

  try {
    const existing = await User.findOne({ $or: [{ email }, { username }] });
    if (existing) {
      return res.status(409).json({ success: false, message: 'Username or email already taken' });
    }

    const user = new User({
      username,
      email,
      password,
      balance: parseFloat(balance) || 0,
      currency: currency || 'INR',
    });
    await user.save();

    const token = jwt.sign({ id: user._id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });

    return res.json({
      success: true,
      message: 'Account created successfully',
      token,
      user: { id: user._id, username: user.username, balance: user.balance, currency: user.currency }
    });
  } catch (err) {
    console.error('Register error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ success: false, message: 'Username and password required' });
  }

  try {
    const user = await User.findOne({ $or: [{ username }, { email: username }] });
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: user._id, username: user.username }, JWT_SECRET, { expiresIn: '7d' });

    return res.json({
      success: true,
      token,
      user: { id: user._id, username: user.username, balance: user.balance, currency: user.currency }
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

// GET /api/auth/me
router.get('/me', auth, async (req, res) => {
  const user = await User.findById(req.user._id).select('-password');
  res.json({ success: true, user });
});

// PATCH /api/auth/balance  — Update balance directly (admin tool)
router.patch('/balance', auth, async (req, res) => {
  const { balance } = req.body;
  if (balance === undefined || isNaN(parseFloat(balance))) {
    return res.status(400).json({ success: false, message: 'Valid balance required' });
  }

  const updatedBalance = parseFloat(balance);
  const user = await User.findByIdAndUpdate(
    req.user._id,
    { balance: updatedBalance },
    { new: true }
  ).select('-password');

  return res.json({ success: true, user });
});

module.exports = router;
