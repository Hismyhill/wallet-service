# Wallet Service API Testing Guide

This document outlines all available endpoints and how to test them.

## Authentication Methods

The API supports two authentication methods:

1. **JWT** (from Google Sign-in) - for users
2. **API Keys** - for service-to-service access

### JWT Authentication

Use header: `Authorization: Bearer <jwt_token>`

### API Key Authentication

Use header: `x-api-key: <api_key>`

---

## 1. Google Authentication (JWT)

### Get Google Auth URL

```bash
GET http://localhost:4000/auth/google
```

Response:

```json
{
  "google_auth_url": "https://accounts.google.com/o/oauth2/v2/auth?..."
}
```

### Google Callback (Automatic)

After user authenticates with Google, they're redirected to:

```
GET http://localhost:4000/auth/google/callback?code=<auth_code>
```

Response:

```json
{
  "user_id": 1,
  "email": "user@example.com",
  "name": "User Name",
  "picture": "https://...",
  "token": "eyJhbGc..."
}
```

Save the `token` for subsequent requests.

---

## 2. API Key Management

### Create API Key

```bash
POST http://localhost:4000/keys/create
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "name": "wallet-service",
  "permissions": ["deposit", "transfer", "read"],
  "expiry": "1D"
}
```

**Expiry Format Options:**

- `1H` - 1 Hour
- `1D` - 1 Day
- `1M` - 1 Month
- `1Y` - 1 Year

**Valid Permissions:**

- `read` - Read wallet balance and transaction history
- `deposit` - Initiate deposits
- `transfer` - Transfer funds between wallets

Response:

```json
{
  "api_key": "sk_live_...",
  "expires_at": "2025-01-10T12:00:00Z",
  "name": "wallet-service",
  "permissions": ["deposit", "transfer", "read"]
}
```

### List API Keys

```bash
GET http://localhost:4000/keys/list
Authorization: Bearer <jwt_token>
```

Response:

```json
[
  {
    "id": 1,
    "name": "wallet-service",
    "permissions": ["deposit", "transfer", "read"],
    "expires_at": "2025-01-10T12:00:00Z",
    "revoked": false,
    "createdAt": "2025-01-09T12:00:00Z"
  }
]
```

### Revoke API Key

```bash
POST http://localhost:4000/keys/revoke/:id
Authorization: Bearer <jwt_token>
```

Response:

```json
{
  "status": "success",
  "message": "API key revoked"
}
```

### Rollover Expired API Key

```bash
POST http://localhost:4000/keys/rollover
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "expired_key_id": 1,
  "expiry": "1M"
}
```

Response:

```json
{
  "api_key": "sk_live_...",
  "expires_at": "2025-02-09T12:00:00Z",
  "name": "wallet-service (rolled over)",
  "permissions": ["deposit", "transfer", "read"]
}
```

---

## 3. Wallet Operations

### Get Wallet Balance

```bash
GET http://localhost:4000/wallet/balance
Authorization: Bearer <jwt_token>
# OR
x-api-key: <api_key_with_read_permission>
```

Response:

```json
{
  "balance": 15000,
  "wallet_number": "abc123xyz789"
}
```

### Initiate Deposit (Paystack)

```bash
POST http://localhost:4000/payments/paystack/initiate
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "amount": 5000
}
```

**Using API Key (requires `deposit` permission):**

```bash
POST http://localhost:4000/payments/paystack/initiate
x-api-key: <api_key>
Content-Type: application/json

{
  "amount": 5000
}
```

Response:

```json
{
  "reference": "T123456789",
  "authorization_url": "https://paystack.co/checkout/..."
}
```

The user should visit the `authorization_url` to complete the payment.

### Paystack Webhook Handler

Paystack sends a webhook when payment is completed:

```bash
POST http://localhost:4000/payments/paystack/webhook
x-paystack-signature: <signature>
Content-Type: application/json

{
  "event": "charge.success",
  "data": {
    "reference": "T123456789",
    "status": "success",
    "amount": 5000,
    "paid_at": "2025-01-09T12:00:00Z"
  }
```

**Note:**

- The webhook MUST have a valid Paystack signature
- Only the webhook can credit wallets (not manual API calls)
- Webhooks are idempotent (won't double-credit)

Response:

```json
{
  "status": true
}
```

### Get Deposit Status (Optional)

```bash
GET http://localhost:4000/payments/paystack/T123456789/status
```

Response:

```json
{
  "reference": "T123456789",
  "status": "success",
  "amount": 5000,
  "paid_at": "2025-01-09T12:00:00Z"
}
```

**Note:** This endpoint does NOT credit wallets - only the webhook does.

### Transfer Funds

```bash
POST http://localhost:4000/wallet/transfer
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "wallet_number": "recipient_wallet_number",
  "amount": 3000
}
```

**Using API Key (requires `transfer` permission):**

```bash
POST http://localhost:4000/wallet/transfer
x-api-key: <api_key>
Content-Type: application/json

{
  "wallet_number": "recipient_wallet_number",
  "amount": 3000
}
```

Response:

```json
{
  "status": "success",
  "message": "Transfer completed",
  "reference": "TRF_1704816000000_abc123",
  "new_balance": 12000
}
```

**Error Cases:**

- Insufficient balance: `400 Insufficient balance`
- Recipient wallet not found: `404 Recipient wallet not found`
- Transfer to own wallet: `400 Cannot transfer to your own wallet`

### Get Transaction History

```bash
GET http://localhost:4000/wallet/transactions?limit=50
Authorization: Bearer <jwt_token>
```

**Using API Key (requires `read` permission):**

```bash
GET http://localhost:4000/wallet/transactions?limit=50
x-api-key: <api_key>
```

Response:

```json
[
  {
    "id": 1,
    "reference": "T123456789",
    "type": "deposit",
    "amount": 5000,
    "status": "success",
    "paid_at": "2025-01-09T12:00:00Z",
    "createdAt": "2025-01-09T12:00:00Z"
  },
  {
    "id": 2,
    "reference": "TRF_1704816000000_abc123",
    "type": "transfer",
    "amount": 3000,
    "status": "success",
    "paid_at": "2025-01-09T12:01:00Z",
    "createdAt": "2025-01-09T12:01:00Z"
  }
]
```

---

## Error Responses

### 401 Unauthorized

```json
{ "error": "No authentication method provided" }
{ "error": "Invalid API key" }
{ "error": "API key has expired" }
{ "error": "Not authorized, token failed" }
```

### 403 Forbidden

```json
{
  "error": "Insufficient permissions",
  "required": ["deposit"],
  "have": ["read"]
}
```

### 400 Bad Request

```json
{ "error": "Amount must be an integer representing the smallest currency unit (minimum 100)." }
{ "error": "wallet_number and amount are required" }
{ "error": "Insufficient balance" }
{ "error": "expiry must be in format: 1H, 1D, 1M, or 1Y" }
{ "error": "Maximum 5 active API keys allowed per user. Revoke one to create a new key." }
```

### 404 Not Found

```json
{ "error": "Recipient wallet not found" }
{ "error": "Transaction not found" }
{ "error": "API key not found" }
```

### 409 Conflict

```json
{
  "message": "You already have a pending transaction. Please complete or wait for it to expire.",
  "authorization_url": "https://paystack.co/checkout/...",
  "reference": "T123456789"
}
```

---

## Example Flow

### 1. User Sign-in with Google

- User visits `/auth/google` to get auth URL
- User authenticates with Google
- Redirected to `/auth/google/callback?code=...`
- Receives JWT token

### 2. Create Wallet

- Wallet is automatically created on first wallet access
- User can check balance with: `GET /wallet/balance`

### 3. Deposit Funds

- Call `POST /payments/paystack/initiate` with amount
- Receive reference and authorization_url
- User completes payment on Paystack
- Paystack sends webhook to `/payments/paystack/webhook`
- Wallet is credited automatically

### 4. Create API Key for Service

- User calls `POST /keys/create` with permissions
- Receives api_key
- Service uses api_key to access wallet endpoints

### 5. Transfer Funds

- Get recipient's wallet_number
- Call `POST /wallet/transfer` with wallet_number and amount
- Wallet balances are updated atomically

---

## Security Notes

1. **API Keys are secrets** - Treat them like passwords
2. **JWT Expiry** - JWTs expire after 30 days
3. **API Key Expiry** - API keys must have explicit expiry
4. **Permissions** - API keys can only access endpoints they have permission for
5. **Webhook Validation** - All webhooks are verified with HMAC SHA512
6. **Idempotency** - Webhooks won't double-credit wallets
7. **Atomic Transfers** - Transfers are atomic; no partial debits

---

## Testing with cURL

### Get Auth URL

```bash
curl http://localhost:4000/auth/google
```

### Create API Key (replace with real JWT)

```bash
curl -X POST http://localhost:4000/keys/create \
  -H "Authorization: Bearer your_jwt_token" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "test-key",
    "permissions": ["read", "deposit", "transfer"],
    "expiry": "1D"
  }'
```

### Get Balance with API Key

```bash
curl http://localhost:4000/wallet/balance \
  -H "x-api-key: sk_live_your_api_key"
```

### Get Transactions

```bash
curl "http://localhost:4000/wallet/transactions?limit=10" \
  -H "Authorization: Bearer your_jwt_token"
```
