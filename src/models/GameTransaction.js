const mongoose = require('mongoose');

const gameTransactionSchema = new mongoose.Schema(
  {
    userId:              { type: String, required: true, index: true },
    type: {
      type: String,
      enum: ['bet', 'win', 'refund', 'deposit', 'withdraw', 'loss', 'rollback'],
      required: true,
    },
    amount:              { type: Number, required: true },
    balanceAfter:        { type: Number },
    currency:            { type: String, required: true, default: 'INR' },
    gap_gameId:          { type: String, default: null },
    gap_RequestId:       { type: String, default: null },
    gap_transactionId:   { type: String, default: null },
    gap_gameRoundId:     { type: String, default: null },
    sessionToken:        { type: String, default: null, index: true },
    idempotencyKey:      { type: String, required: true },
    processedAt:         { type: Date, default: Date.now },
    remarks:             { type: String, default: '' },
  },
  { timestamps: true }
);

gameTransactionSchema.index({ userId: 1, createdAt: -1 });
gameTransactionSchema.index({ gap_transactionId: 1 });
gameTransactionSchema.index({ idempotencyKey: 1 });

module.exports = mongoose.model('GameTransaction', gameTransactionSchema);
