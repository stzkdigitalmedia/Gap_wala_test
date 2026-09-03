# GapWala Pro — RoyalBet B2B Operator Integration

A complete MongoDB-backed operator platform for testing and production B2B integration with RoyalBet.

## Setup

```bash
# Make sure MongoDB is running locally
node index.js
# Open: http://localhost:5000
```

## Registering this Operator in RoyalBet Admin

In the RoyalBet Admin panel → Operators → Create:

| Field        | Value                  |
|---|---|
| Name         | GapWala Pro            |
| Operator ID  | GapWala_Pro            |
| Callback URL | http://localhost:5000  |
| Public Key   | (see src/config/keys.js → OPERATOR_PUBLIC_KEY) |

## Architecture

- `index.js` — Express server + Lobby UI
- `src/models/User.js` — MongoDB user schema (balance, currency, password)
- `src/models/GameTransaction.js` — Game transaction schema (bet/win/loss)
- `src/routes/auth.js` — Register, Login, Balance update
- `src/routes/game.js` — Seamless game launch, transaction history
- `src/routes/webhook.js` — Balance/Bet/Win callbacks from RoyalBet
- `src/config/keys.js` — RSA key pair (NEW keys, different from demo)

## API Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | /api/auth/register | No | Create account with custom balance |
| POST | /api/auth/login | No | Login, get JWT |
| GET  | /api/auth/me | JWT | Get current user |
| PATCH| /api/auth/balance | JWT | Set new balance directly |
| POST | /api/game/launch | JWT | Get seamless game URL |
| GET  | /api/game/transactions | JWT | Get bet/win history |
| POST | /royalbet-callback/balance | RSA | Balance check webhook |
| POST | /royalbet-callback/betrequest | RSA | Debit (bet) webhook |
| POST | /royalbet-callback/resultrequest | RSA | Credit (win) webhook |
# Gap_wala_test
