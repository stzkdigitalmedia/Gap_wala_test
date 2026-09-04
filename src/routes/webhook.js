const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const User = require('../models/User');
const GameTransaction = require('../models/GameTransaction');
const KEYS = require('../config/keys');

// ─── Signature Verification Middleware ────────────────────────────────────────
function verifySignature(req, res, next) {
  const signature = req.headers['signature'] || req.headers['x-signature'];

  // Dev bypass for local testing from browser / Postman
  if (signature === 'MOCK_BYPASS_FOR_DEVELOPMENT') return next();

  // If in local development and no signature is provided, allow with a warning
  if (process.env.NODE_ENV !== 'production' && !signature) {
    console.warn(`[WEBHOOK] ⚠️ [DEV MODE] No signature header provided for ${req.path}. Bypassing verification.`);
    return next();
  }

  if (!signature || !req.rawBody) {
    console.error('[WEBHOOK] ❌ Missing signature or rawBody');
    return res.status(401).json({ status: 'OP_FAILED', message: 'Missing signature' });
  }

  try {
    const verifier = crypto.createVerify('RSA-SHA256');
    verifier.update(req.rawBody);
    const isValid = verifier.verify(KEYS.ROYALBET_PUBLIC_KEY, signature, 'base64');
    if (!isValid) {
      console.error('[WEBHOOK] ❌ Signature invalid');
      return res.status(401).json({ status: 'OP_FAILED', message: 'Invalid signature' });
    }
  } catch (err) {
    console.error('[WEBHOOK] ❌ Signature error:', err.message);
    return res.status(401).json({ status: 'OP_FAILED', message: 'Signature verification error' });
  }

  console.log(`[WEBHOOK] ✅ Signature verified for ${req.path}`);
  next();
}

router.use(verifySignature);

// ─── Helper to record a transaction ───────────────────────────────────────────
async function recordTransaction(userId, type, amount, balanceAfter, body, remarks = '') {
  const txnType = type === 'bet' ? 'bet' : type === 'rollback' ? 'rollback' : 'result';
  const txn = new GameTransaction({
    userId,
    type,
    amount,
    balanceAfter,
    currency: body.currency || 'INR',
    gap_gameId: body.gameId || null,
    gap_RequestId: body.reqId || null,
    gap_transactionId: body.transactionId || null,
    gap_gameRoundId: body.roundId || null,
    sessionToken: body.token || null,
    idempotencyKey: `${txnType}:${body.transactionId || body.reqId || Date.now()}:${userId}`,
    remarks,
  });
  await txn.save();
  return txn;
}

// ─── /balance ─────────────────────────────────────────────────────────────────
router.post(['/balance', '/getbalance'], async (req, res) => {
  const userId = req.body.userId || req.body.username;
  console.log(`[WEBHOOK] /balance | User: ${userId}`);

  const user = await User.findOne({ username: userId });
  if (!user) return res.json({ status: 'USER_NOT_FOUND', balance: 0, currency: 'INR' });

  return res.json({ status: 'OP_SUCCESS', success: true, balance: user.balance, currency: user.currency });
});

// ─── /betrequest (DEBIT) ──────────────────────────────────────────────────────
router.post(['/betrequest', '/bet'], async (req, res) => {
  const userId = req.body.userId || req.body.username;
  const debitAmount = Number(req.body.debitAmount ?? req.body.amount ?? 0);
  const transactionId = req.body.transactionId || req.body.reqId || req.body.betId;
  console.log(`[WEBHOOK] /betrequest | User: ${userId} | Amount: ₹${debitAmount} | TxId: ${transactionId}`);

  // Idempotency check – avoid processing the same bet twice
  const existingTxn = await GameTransaction.findOne({ idempotencyKey: `bet:${transactionId}:${userId}` });
  if (existingTxn) {
    console.log(`[WEBHOOK] ♻️  Idempotent bet: ${transactionId}`);
    const user = await User.findOne({ username: userId });
    return res.json({ status: 'OP_SUCCESS', success: true, balance: user ? user.balance : 0, message: 'Already processed' });
  }

  // 1. First ensure user exists to get accurate failure reason
  const existingUser = await User.findOne({ username: userId });
  if (!existingUser) {
    console.error(`[WEBHOOK] ❌ User ${userId} not found`);
    return res.json({ status: 'USER_NOT_FOUND', balance: 0 });
  }

  if (existingUser.balance < debitAmount) {
    return res.json({ status: 'INSUFFICIENT_FUNDS', balance: existingUser.balance, message: 'Insufficient balance' });
  }

  // 2. ATOMICALLY deduct balance to prevent race conditions during rapid simultaneous bets
  const user = await User.findOneAndUpdate(
    { username: userId, balance: { $gte: debitAmount } },
    { $inc: { balance: -debitAmount } },
    { new: true } // Return the updated document
  );

  // If user is null here, it means in the millisecond between step 1 and 2, their balance dropped below debitAmount
  if (!user) {
    return res.json({ status: 'INSUFFICIENT_FUNDS', balance: existingUser.balance, message: 'Insufficient balance' });
  }

  // Format to 2 decimal places in JS just in case floats got messy
  user.balance = parseFloat((user.balance).toFixed(2));
  await user.save(); // Just saving the formatting fix, not strictly necessary for the math

  await recordTransaction(userId, 'bet', debitAmount, user.balance, req.body, `Bet placed via RoyalBet`);
  console.log(`[WEBHOOK] ✅ Debit OK | New Balance: ₹${user.balance}`);

  return res.json({ status: 'OP_SUCCESS', success: true, balance: user.balance, message: 'Deduction successful' });
});

// ─── /resultrequest (CREDIT WIN) ─────────────────────────────────────────────
router.post(['/resultrequest', '/result'], async (req, res) => {
  const userId = req.body.userId || req.body.username;
  const creditAmount = Number(req.body.creditAmount ?? req.body.amount ?? req.body.winAmount ?? 0);
  const transactionId = req.body.transactionId || req.body.reqId || req.body.betId;
  console.log(`[WEBHOOK] /resultrequest | User: ${userId} | Amount: ₹${creditAmount} | TxId: ${transactionId}`);

  // Idempotency check
  const existingTxn = await GameTransaction.findOne({ idempotencyKey: `result:${transactionId}:${userId}` });
  if (existingTxn) {
    console.log(`[WEBHOOK] ♻️  Idempotent win: ${transactionId}`);
    const user = await User.findOne({ username: userId });
    return res.json({ status: 'OP_SUCCESS', success: true, balance: user ? user.balance : 0, message: 'Already processed' });
  }

  // ATOMICALLY credit balance to prevent race conditions when multiple wins hit at the exact same millisecond
  const user = await User.findOneAndUpdate(
    { username: userId },
    { $inc: { balance: creditAmount } },
    { new: true }
  );

  if (!user) {
    console.error(`[WEBHOOK] ❌ User ${userId} not found`);
    return res.json({ status: 'USER_NOT_FOUND', balance: 0 });
  }

  // Format to 2 decimal places in JS
  user.balance = parseFloat((user.balance).toFixed(2));
  await user.save();

  const type = creditAmount > 0 ? 'win' : 'loss';

  await recordTransaction(userId, type, creditAmount, user.balance, req.body,
    creditAmount > 0 ? `Win credited from RoyalBet` : `Round ended – no win`);
  console.log(`[WEBHOOK] ✅ Credit OK | New Balance: ₹${user.balance}`);

  return res.json({ status: 'OP_SUCCESS', success: true, balance: user.balance, message: 'Payout credited successfully' });
});

// ─── /rollback (CREDIT / REFUND) ────────────────────────────────────────────────
router.post(['/rollback', '/rollbackrequest'], async (req, res) => {
  const userId = req.body.userId || req.body.username;
  const rollbackAmount = Number(req.body.rollbackAmount ?? req.body.amount ?? req.body.debitAmount ?? 0);
  const transactionId = req.body.transactionId || req.body.reqId || req.body.betId || Date.now();
  const reason = req.body.reason || req.body.remark || req.body.message || 'Transaction reversed';
  console.log(`[WEBHOOK] /rollback | User: ${userId} | Amount: ₹${rollbackAmount} | TxId: ${transactionId} | Reason: ${reason}`);

  // Idempotency check
  const existingTxn = await GameTransaction.findOne({ idempotencyKey: `rollback:${transactionId}:${userId}` });
  if (existingTxn) {
    console.log(`[WEBHOOK] ♻️  Idempotent rollback: ${transactionId}`);
    const user = await User.findOne({ username: userId });
    return res.json({ status: 'OP_SUCCESS', success: true, balance: user ? user.balance : 0, message: 'Already processed' });
  }

  // ATOMICALLY credit balance to prevent race conditions
  const user = await User.findOneAndUpdate(
    { username: userId },
    { $inc: { balance: rollbackAmount } },
    { new: true }
  );

  if (!user) {
    console.error(`[WEBHOOK] ❌ User ${userId} not found`);
    return res.json({ status: 'USER_NOT_FOUND', balance: 0 });
  }

  // Format to 2 decimal places in JS
  user.balance = parseFloat((user.balance).toFixed(2));
  await user.save();

  // Create idempotency key specific to rollback
  const bodyClone = { ...req.body, transactionId: `${transactionId}` };

  await recordTransaction(userId, 'rollback', rollbackAmount, user.balance, bodyClone,
    `Rollback: ${reason}`);

  console.log(`[WEBHOOK] ✅ Rollback OK | New Balance: ₹${user.balance}`);

  return res.json({ status: 'OP_SUCCESS', success: true, balance: user.balance, message: 'Rollback processed successfully' });
});

module.exports = router;