# API Specification

## Base URL

- **Development:** `http://localhost:4000/api`
- **Production:** `https://app.otter.money/api`

## Authentication

All endpoints except `/api/auth/*` require authentication.

Include the access token in the Authorization header:
```
Authorization: Bearer <access_token>
```

## Response Format

### Success Response
```json
{
  "data": { ... }
}
```

### Error Response
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid email format",
    "details": { ... }
  }
}
```

## Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `VALIDATION_ERROR` | 400 | Request validation failed |
| `UNAUTHORIZED` | 401 | Missing or invalid token |
| `FORBIDDEN` | 403 | Insufficient permissions / No household |
| `NOT_FOUND` | 404 | Resource not found |
| `CONFLICT` | 409 | Resource already exists |
| `RATE_LIMITED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Server error |

---

## Auth Endpoints

### POST /auth/register
Create a new account and household. User becomes the ORGANIZER.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123",
  "name": "John Doe"
}
```

**Response (201):**
```json
{
  "data": {
    "user": {
      "id": "abc123",
      "email": "user@example.com",
      "name": "John Doe",
      "householdId": "hh123",
      "householdRole": "ORGANIZER"
    },
    "household": {
      "id": "hh123",
      "name": "John Doe's Household",
      "inviteCode": "xyz789"
    },
    "accessToken": "eyJhbG..."
  }
}
```

---

### POST /auth/register/join
Create a new account and join an existing household. User becomes a PARTNER.

**Request:**
```json
{
  "email": "partner@example.com",
  "password": "securePassword123",
  "name": "Jane Doe",
  "inviteCode": "xyz789"
}
```

**Response (201):**
```json
{
  "data": {
    "user": {
      "id": "abc456",
      "email": "partner@example.com",
      "name": "Jane Doe",
      "householdId": "hh123",
      "householdRole": "PARTNER"
    },
    "household": {
      "id": "hh123",
      "name": "John Doe's Household",
      "inviteCode": "xyz789"
    },
    "accessToken": "eyJhbG..."
  }
}
```

**Errors:**
- `404` - Invalid invite code
- `403` - Household already has 2 members

---

### POST /auth/login
Authenticate and receive access token.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

**Response (200):**
```json
{
  "data": {
    "user": { ... },
    "household": { ... },
    "accessToken": "eyJhbG..."
  }
}
```

**Errors:**
- `401` - Invalid credentials

---

### POST /auth/logout
Invalidate the current session. Requires authentication.

**Response (200):**
```json
{
  "data": {
    "success": true
  }
}
```

---

### POST /auth/refresh
Refresh the access token using HTTP-only cookie.

**Response (200):**
```json
{
  "data": {
    "accessToken": "eyJhbG..."
  }
}
```

---

### POST /auth/forgot-password
Request a password reset email.

**Request:**
```json
{
  "email": "user@example.com"
}
```

**Response (200):**
```json
{
  "data": {
    "success": true,
    "message": "If an account exists, a reset email has been sent"
  }
}
```

---

### POST /auth/reset-password
Reset password using token from email.

**Request:**
```json
{
  "token": "reset-token-from-email",
  "password": "newSecurePassword123"
}
```

**Response (200):**
```json
{
  "data": {
    "success": true,
    "message": "Password has been reset"
  }
}
```

**Errors:**
- `400` - Invalid or expired token

---

## Household Endpoints

All household endpoints require authentication.

### GET /household
Get the current user's household.

**Response (200):**
```json
{
  "data": {
    "id": "hh123",
    "name": "John Doe's Household",
    "inviteCode": "xyz789",
    "createdAt": "2024-01-15T10:00:00Z",
    "updatedAt": "2024-01-15T10:00:00Z"
  }
}
```

**Errors:**
- `403` - No household associated (user was removed or left)

---

### GET /household/members
Get all members of the household.

**Response (200):**
```json
{
  "data": [
    {
      "id": "abc123",
      "email": "user@example.com",
      "name": "John Doe",
      "avatarUrl": null,
      "householdRole": "ORGANIZER",
      "isCurrentUser": true,
      "createdAt": "2024-01-15T10:00:00Z"
    },
    {
      "id": "abc456",
      "email": "partner@example.com",
      "name": "Jane Doe",
      "avatarUrl": null,
      "householdRole": "PARTNER",
      "isCurrentUser": false,
      "createdAt": "2024-01-15T11:00:00Z"
    }
  ]
}
```

---

### GET /household/invite
Get the household invite code and URL.

**Response (200):**
```json
{
  "data": {
    "inviteCode": "xyz789",
    "inviteUrl": "https://app.otter.money/join/xyz789"
  }
}
```

---

### POST /household/invite/regenerate
Generate a new invite code. **Organizer only.**

**Response (200):**
```json
{
  "data": {
    "inviteCode": "newcode123",
    "inviteUrl": "https://app.otter.money/join/newcode123"
  }
}
```

**Errors:**
- `403` - Only the household organizer can perform this action

---

### POST /household/create
Create a new household. **For users without a household only.**

Use this when a user has been removed from a household or left voluntarily.

**Response (201):**
```json
{
  "data": {
    "household": {
      "id": "hh456",
      "name": "Jane Doe's Household",
      "inviteCode": "abc123",
      "createdAt": "2024-01-16T10:00:00Z",
      "updatedAt": "2024-01-16T10:00:00Z"
    }
  }
}
```

**Errors:**
- `409` - You are already in a household

---

### POST /household/join
Join an existing household with invite code. **For users without a household only.**

**Request:**
```json
{
  "inviteCode": "xyz789"
}
```

**Response (200):**
```json
{
  "data": {
    "household": {
      "id": "hh123",
      "name": "John Doe's Household",
      "inviteCode": "xyz789",
      "createdAt": "2024-01-15T10:00:00Z",
      "updatedAt": "2024-01-15T10:00:00Z"
    }
  }
}
```

**Errors:**
- `409` - You are already in a household. Leave or dissolve it first.
- `404` - Invalid invite code
- `403` - Household already has 2 members

---

### POST /household/leave
Leave the current household. **Partner only.**

Accounts owned by the partner become joint accounts.

**Response (200):**
```json
{
  "data": {
    "success": true,
    "message": "You have left the household. Your accounts are now joint accounts."
  }
}
```

**Errors:**
- `403` - Organizers cannot leave. Use dissolve to delete the household.

---

### GET /household/dissolve/impact
Preview what will be deleted when dissolving. **Organizer only.**

**Response (200):**
```json
{
  "data": {
    "impact": {
      "memberCount": 2,
      "accountCount": 5,
      "transactionCount": 150
    }
  }
}
```

---

### POST /household/dissolve
Permanently delete the household and all data. **Organizer only.**

This deletes:
- All accounts
- All transactions
- All budgets, goals, categories, and rules
- Removes all members from the household

**Response (200):**
```json
{
  "data": {
    "success": true,
    "message": "Household has been dissolved. All data has been deleted."
  }
}
```

**Errors:**
- `403` - Only the household organizer can perform this action

---

### GET /household/members/:memberId/removal-impact
Preview the impact of removing a partner. **Organizer only.**

**Response (200):**
```json
{
  "data": {
    "member": {
      "id": "abc456",
      "name": "Jane Doe",
      "email": "partner@example.com"
    },
    "impact": {
      "accountCount": 2,
      "transactionCount": 45
    }
  }
}
```

**Errors:**
- `404` - Member not found
- `403` - Cannot remove the household organizer

---

### DELETE /household/members/:memberId
Remove a partner from the household. **Organizer only.**

The partner's accounts become joint accounts.

**Response (200):**
```json
{
  "data": {
    "success": true,
    "message": "Partner has been removed from the household. Their accounts are now joint accounts."
  }
}
```

**Errors:**
- `404` - Member not found
- `403` - Cannot remove the household organizer

---

## Accounts Endpoints

All account endpoints require authentication and household membership.

### GET /accounts
List all accounts in the household.

**Response (200):**
```json
{
  "data": [
    {
      "id": "acc123",
      "householdId": "hh123",
      "ownerId": "abc123",
      "name": "Chase Checking",
      "type": "CHECKING",
      "subtype": null,
      "connectionType": "MANUAL",
      "connectionStatus": "ACTIVE",
      "lastSyncedAt": null,
      "currentBalance": 5000.00,
      "availableBalance": 5000.00,
      "currency": "USD",
      "isHidden": false,
      "excludeFromBudget": false,
      "excludeFromNetWorth": false,
      "displayOrder": 1,
      "owner": {
        "id": "abc123",
        "name": "John Doe",
        "avatarUrl": null
      }
    }
  ]
}
```

---

### GET /accounts/summary/totals
Get aggregated totals for the household's accounts.

**Response (200):**
```json
{
  "data": {
    "totalAssets": 25000.00,
    "totalLiabilities": 5000.00,
    "netWorth": 20000.00,
    "byPartner": {
      "abc123": { "assets": 15000.00, "liabilities": 2000.00 },
      "abc456": { "assets": 5000.00, "liabilities": 3000.00 },
      "joint": { "assets": 5000.00, "liabilities": 0 }
    }
  }
}
```

---

### GET /accounts/:id
Get a single account by ID.

**Response (200):**
```json
{
  "data": {
    "id": "acc123",
    "name": "Chase Checking",
    "type": "CHECKING",
    "currentBalance": 5000.00,
    "owner": { "id": "abc123", "name": "John Doe", "avatarUrl": null }
  }
}
```

**Errors:**
- `404` - Account not found
- `403` - Account belongs to another household

---

### POST /accounts
Create a new manual account.

**Request:**
```json
{
  "name": "Chase Checking",
  "type": "CHECKING",
  "ownerId": "abc123",
  "currentBalance": 5000.00,
  "currency": "USD",
  "isHidden": false,
  "excludeFromBudget": false,
  "excludeFromNetWorth": false
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| name | string | Yes | Account name (1-100 chars) |
| type | enum | Yes | CHECKING, SAVINGS, CREDIT, INVESTMENT, LOAN, MORTGAGE, ASSET, OTHER |
| ownerId | string | No | Owner user ID. Null for joint accounts. |
| currentBalance | number | Yes | Initial balance |
| currency | string | No | Currency code (default: USD) |
| isHidden | boolean | No | Hide from views (default: false) |
| excludeFromBudget | boolean | No | Exclude from budget (default: false) |
| excludeFromNetWorth | boolean | No | Exclude from net worth (default: false) |

**Response (201):**
```json
{
  "data": {
    "id": "acc123",
    "name": "Chase Checking",
    "type": "CHECKING",
    "currentBalance": 5000.00,
    "owner": { "id": "abc123", "name": "John Doe", "avatarUrl": null }
  }
}
```

**Errors:**
- `400` - Owner must be a member of the household

---

### PATCH /accounts/:id
Update an existing account.

**Request:**
```json
{
  "name": "Updated Account Name",
  "ownerId": null
}
```

All fields are optional. Cannot change `type` for connected (Plaid/SimpleFin) accounts.

**Response (200):**
```json
{
  "data": {
    "id": "acc123",
    "name": "Updated Account Name",
    "ownerId": null,
    "owner": null
  }
}
```

---

### DELETE /accounts/:id
Delete an account. For manual accounts, this deletes the account and all transactions. For connected accounts, this marks them as disconnected.

**Response (200):**
```json
{
  "data": {
    "message": "Account deleted"
  }
}
```

---

### POST /accounts/:id/balance
Update the balance of a manual account. Creates an adjustment transaction.

**Request:**
```json
{
  "newBalance": 5500.00,
  "note": "End of month reconciliation"
}
```

**Response (200):**
```json
{
  "data": {
    "id": "acc123",
    "currentBalance": 5500.00,
    "availableBalance": 5500.00
  }
}
```

**Errors:**
- `400` - Balance can only be manually updated for manual accounts

---

## Dashboard Endpoints

### GET /dashboard/summary
Get aggregated dashboard data for the household.

**Response (200):**
```json
{
  "data": {
    "netWorth": 20000.00,
    "totalAssets": 25000.00,
    "totalLiabilities": 5000.00,
    "byPartner": {
      "abc123": { "assets": 15000.00, "liabilities": 2000.00, "netWorth": 13000.00 },
      "joint": { "assets": 5000.00, "liabilities": 0, "netWorth": 5000.00 }
    },
    "memberNames": {
      "abc123": "John Doe",
      "abc456": "Jane Doe",
      "joint": "Joint"
    },
    "recentTransactions": [],
    "accountCount": 3
  }
}
```

---

### GET /dashboard/networth/history
Get net worth history for charting.

**Response (200):**
```json
{
  "data": [
    { "date": "2024-01", "total": 18000, "assets": 23000, "liabilities": 5000 },
    { "date": "2024-02", "total": 19000, "assets": 24000, "liabilities": 5000 },
    { "date": "2024-03", "total": 20000, "assets": 25000, "liabilities": 5000 }
  ]
}
```

---

## Rules Endpoints

### GET /api/rules
Get all categorization rules for the household.

**Authentication:** Required

**Response:**
```json
{
  "data": [
    {
      "id": "rule123",
      "householdId": "hh123",
      "categoryId": "cat456",
      "category": {
        "id": "cat456",
        "name": "Coffee",
        "type": "EXPENSE",
        "icon": "☕",
        "color": "#8B4513"
      },
      "conditions": {
        "merchantContains": "starbucks",
        "operator": "AND"
      },
      "priority": 10,
      "isEnabled": true,
      "createdAt": "2025-01-27T..."
    }
  ]
}
```

### GET /api/rules/:id
Get a single rule by ID.

**Authentication:** Required

**Response:**
```json
{
  "data": {
    "id": "rule123",
    "householdId": "hh123",
    "categoryId": "cat456",
    "category": { ... },
    "conditions": { ... },
    "priority": 10,
    "isEnabled": true,
    "createdAt": "2025-01-27T..."
  }
}
```

### POST /api/rules
Create a new categorization rule.

**Authentication:** Required

**Request Body:**
```json
{
  "categoryId": "cat456",
  "conditions": {
    "merchantContains": "starbucks",
    "amountMax": -3,
    "operator": "AND"
  },
  "priority": 10,
  "isEnabled": true
}
```

**Condition Fields:**
- `merchantContains` - Case-insensitive substring match on merchant name
- `merchantExactly` - Case-insensitive exact match on merchant name
- `descriptionContains` - Case-insensitive substring match on description
- `descriptionExactly` - Case-insensitive exact match on description
- `amountMin` - Minimum amount (inclusive)
- `amountMax` - Maximum amount (inclusive)
- `amountExactly` - Exact amount match
- `accountIds` - Array of account IDs to match
- `accountTypes` - Array of account types to match
- `ownerIds` - Array of user IDs (account owners) to match
- `operator` - "AND" (default) or "OR" for combining conditions

**Response:** Same as GET /api/rules/:id

### PATCH /api/rules/:id
Update an existing rule.

**Authentication:** Required

**Request Body:** Same fields as POST (all optional)

**Response:** Updated rule

### DELETE /api/rules/:id
Delete a rule.

**Authentication:** Required

**Response:**
```json
{
  "data": {
    "message": "Rule deleted"
  }
}
```

### POST /api/rules/test
Test rule conditions without saving.

**Authentication:** Required

**Request Body:**
```json
{
  "conditions": {
    "merchantContains": "starbucks"
  },
  "limit": 5
}
```

**Response:**
```json
{
  "data": {
    "matchCount": 15,
    "sampleMatches": [
      // First 5 matching transactions
    ]
  }
}
```

### POST /api/rules/:id/apply
Apply a rule retroactively to existing transactions.

**Authentication:** Required

**Query Parameters:**
- `force=true` - Apply to ALL transactions (not just uncategorized)

**Response:**
```json
{
  "data": {
    "message": "Rule applied to 42 transactions",
    "count": 42
  }
}
```

### POST /api/rules/apply-to-transactions
Apply all rules to specific transactions.

**Authentication:** Required

**Request Body:**
```json
{
  "transactionIds": ["tx1", "tx2", "tx3"]
}
```

**Response:**
```json
{
  "data": {
    "message": "Categorized 2 of 3 transactions",
    "categorizedCount": 2,
    "totalCount": 3
  }
}
```

---

## Recurring Transactions Endpoints

All recurring endpoints require authentication and household membership.

### GET /recurring
List all recurring transactions for the household.

**Query Parameters:**
- `status` - Filter by status: DETECTED, CONFIRMED, DISMISSED, ENDED
- `isPaused` - Filter by paused state: true, false

**Response (200):**
```json
{
  "data": [
    {
      "id": "rec123",
      "householdId": "hh123",
      "merchantName": "netflix",
      "description": null,
      "frequency": "MONTHLY",
      "expectedAmount": 15.99,
      "amountVariance": 5,
      "dayOfMonth": 15,
      "dayOfWeek": null,
      "nextExpectedDate": "2026-02-15",
      "lastOccurrence": "2026-01-15",
      "accountId": "acc123",
      "categoryId": "cat456",
      "status": "CONFIRMED",
      "isManual": false,
      "isPaused": false,
      "occurrenceCount": 12,
      "confidence": 0.95,
      "notes": null,
      "account": { "id": "acc123", "name": "Chase Checking", "type": "CHECKING", "ownerId": "abc123" },
      "category": { "id": "cat456", "name": "Subscriptions", "type": "EXPENSE", "icon": "📺", "color": "#e74c3c" }
    }
  ]
}
```

---

### GET /recurring/upcoming
Get upcoming bills for the next N days (for dashboard widget).

**Query Parameters:**
- `days` - Number of days to look ahead (default: 30)
- `limit` - Max number of results (default: 5)

**Response (200):**
```json
{
  "data": [
    {
      "id": "rec123",
      "merchantName": "netflix",
      "expectedAmount": 15.99,
      "nextExpectedDate": "2026-02-15",
      "frequency": "MONTHLY",
      "status": "CONFIRMED",
      "categoryId": "cat456",
      "categoryName": "Subscriptions",
      "categoryColor": "#e74c3c",
      "accountId": "acc123",
      "accountName": "Chase Checking",
      "isPaused": false,
      "daysUntilDue": 14
    }
  ]
}
```

---

### GET /recurring/:id
Get a single recurring transaction with linked transactions.

**Response (200):**
```json
{
  "data": {
    "id": "rec123",
    "merchantName": "netflix",
    "frequency": "MONTHLY",
    "expectedAmount": 15.99,
    "linkedTransactions": [
      {
        "id": "tx123",
        "date": "2026-01-15",
        "amount": -15.99,
        "merchantName": "Netflix",
        "description": "Netflix Subscription"
      }
    ]
  }
}
```

---

### POST /recurring
Create a manual recurring transaction.

**Request:**
```json
{
  "merchantName": "Gym Membership",
  "description": "Monthly gym fee",
  "frequency": "MONTHLY",
  "expectedAmount": 50.00,
  "amountVariance": 5,
  "dayOfMonth": 1,
  "nextExpectedDate": "2026-02-01",
  "accountId": "acc123",
  "categoryId": "cat456",
  "notes": "Can cancel anytime"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| merchantName | string | Yes | Merchant/payee name |
| description | string | No | Additional description |
| frequency | enum | Yes | WEEKLY, BIWEEKLY, MONTHLY, QUARTERLY, SEMIANNUAL, ANNUAL |
| expectedAmount | number | Yes | Expected transaction amount |
| amountVariance | number | No | Allowed variance % (default: 5) |
| dayOfMonth | number | No | Expected day of month (1-31) |
| dayOfWeek | number | No | Expected day of week (0-6, Sunday=0) |
| nextExpectedDate | string | Yes | Next expected date (ISO format) |
| accountId | string | No | Associated account |
| categoryId | string | No | Associated category |
| notes | string | No | Additional notes |

**Response (201):** Created recurring transaction

---

### PATCH /recurring/:id
Update a recurring transaction.

**Request:** Same fields as POST (all optional)

**Response (200):** Updated recurring transaction

---

### DELETE /recurring/:id
Delete a recurring transaction.

**Response (200):**
```json
{
  "data": { "message": "Recurring transaction deleted" }
}
```

---

### POST /recurring/:id/confirm
Confirm a detected recurring pattern.

**Response (200):** Updated recurring transaction with status "CONFIRMED"

---

### POST /recurring/:id/dismiss
Dismiss a detected recurring pattern.

**Response (200):** Updated recurring transaction with status "DISMISSED"

---

### POST /recurring/:id/pause
Pause a recurring transaction (stops appearing in upcoming bills).

**Response (200):** Updated recurring transaction with isPaused=true

---

### POST /recurring/:id/resume
Resume a paused recurring transaction.

**Response (200):** Updated recurring transaction with isPaused=false

---

### POST /recurring/:id/end
Mark a recurring transaction as ended (cancelled subscription, etc.).

**Response (200):** Updated recurring transaction with status "ENDED"

---

### POST /recurring/detect
Run the detection algorithm to find recurring patterns in transaction history.

**Response (200):**
```json
{
  "data": {
    "detected": 5,
    "updated": 2,
    "message": "Detected 5 new recurring patterns, updated 2 existing"
  }
}
```

---

### POST /recurring/from-transaction/:transactionId
Create a recurring pattern from a specific transaction.

**Request:**
```json
{
  "frequency": "MONTHLY",
  "expectedAmount": 15.99,
  "dayOfMonth": 15
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| frequency | enum | Yes | WEEKLY, BIWEEKLY, MONTHLY, QUARTERLY, SEMIANNUAL, ANNUAL |
| expectedAmount | number | No | Override amount from transaction |
| dayOfMonth | number | No | Expected day of month |
| dayOfWeek | number | No | Expected day of week |

**Response (201):** Created recurring transaction

---

## Goals Endpoints

All goals endpoints require authentication and household membership.

### GET /goals
List all goals for the household.

**Query Parameters:**
- `includeCompleted` - Include completed goals (default: false)

**Response (200):**
```json
{
  "data": [
    {
      "id": "goal123",
      "householdId": "hh123",
      "name": "Emergency Fund",
      "targetAmount": 10000,
      "currentAmount": 5000,
      "targetDate": "2026-12-31T00:00:00.000Z",
      "icon": "💰",
      "color": "#9F6FBA",
      "isCompleted": false,
      "completedAt": null,
      "createdAt": "2026-01-01T00:00:00.000Z",
      "updatedAt": "2026-01-15T00:00:00.000Z",
      "percentComplete": 50,
      "remaining": 5000
    }
  ]
}
```

---

### GET /goals/:id
Get a single goal by ID.

**Response (200):**
```json
{
  "data": {
    "id": "goal123",
    "householdId": "hh123",
    "name": "Emergency Fund",
    "targetAmount": 10000,
    "currentAmount": 5000,
    "targetDate": "2026-12-31T00:00:00.000Z",
    "icon": "💰",
    "color": "#9F6FBA",
    "isCompleted": false,
    "completedAt": null,
    "createdAt": "2026-01-01T00:00:00.000Z",
    "updatedAt": "2026-01-15T00:00:00.000Z",
    "percentComplete": 50,
    "remaining": 5000
  }
}
```

**Errors:**
- `404` - Goal not found
- `403` - Goal belongs to another household

---

### POST /goals
Create a new goal.

**Request:**
```json
{
  "name": "Emergency Fund",
  "targetAmount": 10000,
  "currentAmount": 0,
  "targetDate": "2026-12-31T00:00:00.000Z",
  "icon": "💰",
  "color": "#9F6FBA"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| name | string | Yes | Goal name (1-100 chars) |
| targetAmount | number | Yes | Target amount (positive) |
| currentAmount | number | No | Initial amount saved (default: 0) |
| targetDate | string | No | Target completion date (ISO format) |
| icon | string | No | Goal icon (emoji) |
| color | string | No | Goal color (hex) |

**Response (201):** Created goal

---

### PATCH /goals/:id
Update an existing goal.

**Request:** Same fields as POST (all optional except id)

**Response (200):** Updated goal

---

### DELETE /goals/:id
Delete a goal.

**Response (200):**
```json
{
  "data": {
    "message": "Goal deleted"
  }
}
```

---

### POST /goals/:id/add
Add funds to a goal.

**Request:**
```json
{
  "amount": 500
}
```

**Response (200):**
```json
{
  "data": {
    "id": "goal123",
    "name": "Emergency Fund",
    "targetAmount": 10000,
    "currentAmount": 5500,
    "percentComplete": 55,
    "remaining": 4500,
    "amountAdded": 500,
    "justCompleted": false
  }
}
```

---

### POST /goals/:id/withdraw
Withdraw funds from a goal.

**Request:**
```json
{
  "amount": 200
}
```

**Response (200):**
```json
{
  "data": {
    "id": "goal123",
    "name": "Emergency Fund",
    "targetAmount": 10000,
    "currentAmount": 4800,
    "percentComplete": 48,
    "remaining": 5200,
    "amountWithdrawn": 200
  }
}
```

---

### GET /goals/summary/dashboard
Get goal summary for the dashboard widget.

**Response (200):**
```json
{
  "data": {
    "goals": [
      {
        "id": "goal123",
        "name": "Emergency Fund",
        "targetAmount": 10000,
        "currentAmount": 5000,
        "percentComplete": 50,
        "remaining": 5000,
        "targetDate": "2026-12-31T00:00:00.000Z",
        "icon": "💰",
        "color": "#9F6FBA"
      }
    ],
    "totalActiveGoals": 3,
    "completedThisMonth": 1,
    "totalSaved": 15000,
    "totalTarget": 30000,
    "overallProgress": 50
  }
}
```

---

## Vehicle Endpoints

All vehicle endpoints require authentication and household membership. Vehicles are tracked as ASSET accounts with market valuations powered by MarketCheck and VIN decoding via NHTSA.

### POST /vehicles/decode-vin
Decode a VIN using the free NHTSA vPIC API. Does not use MarketCheck quota.

**Request:**
```json
{
  "vin": "19XFL1H86NE021192"
}
```

**Response (200):**
```json
{
  "data": {
    "year": 2022,
    "make": "Honda",
    "model": "Civic",
    "trim": "Sport Touring",
    "bodyClass": "Hatchback/Liftback/Notchback",
    "driveType": "4x2",
    "fuelType": "Gasoline",
    "engineCylinders": 4,
    "displacement": "1.5",
    "transmission": "Continuously Variable Transmission (CVT)"
  }
}
```

---

### GET /vehicles
List all vehicles in the household.

**Response (200):**
```json
{
  "data": [
    {
      "id": "veh123",
      "householdId": "hh123",
      "accountId": "acc456",
      "vin": "19XFL1H86NE021192",
      "year": 2022,
      "make": "Honda",
      "model": "Civic",
      "trim": "Sport Touring",
      "mileage": 60000,
      "zipCode": "90210",
      "purchasePrice": 28000,
      "purchaseDate": "2022-06-15",
      "lastValuationAt": "2026-02-14T19:00:00.000Z",
      "account": {
        "id": "acc456",
        "name": "2022 Honda Civic",
        "currentBalance": 23580,
        "ownerId": "abc123"
      },
      "owner": { "id": "abc123", "name": "John Doe", "avatarUrl": null },
      "latestValuation": {
        "id": "val789",
        "vehicleId": "veh123",
        "date": "2026-02-14",
        "mileageAtValuation": 60000,
        "marketValue": 23580,
        "msrp": 32851
      }
    }
  ]
}
```

---

### GET /vehicles/:id
Get a single vehicle with details.

**Response (200):** Same shape as list item above.

**Errors:**
- `404` - Vehicle not found
- `403` - Vehicle belongs to another household

---

### POST /vehicles
Add a vehicle. Creates an ASSET account, a Vehicle record, and fetches an initial valuation from MarketCheck.

**Request:**
```json
{
  "vin": "19XFL1H86NE021192",
  "year": 2022,
  "make": "Honda",
  "model": "Civic",
  "trim": "Sport Touring",
  "mileage": 60000,
  "zipCode": "90210",
  "purchasePrice": 28000,
  "purchaseDate": "2022-06-15",
  "ownerId": "abc123",
  "name": "Our Civic"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| vin | string | Yes | 17-character VIN (no I, O, Q) |
| year | number | Yes | Model year (1900-2100) |
| make | string | Yes | Vehicle make |
| model | string | Yes | Vehicle model |
| trim | string | No | Trim level |
| mileage | number | Yes | Current odometer reading |
| zipCode | string | Yes | ZIP code for regional pricing |
| purchasePrice | number | No | What you paid for the vehicle |
| purchaseDate | string | No | Purchase date (YYYY-MM-DD) |
| ownerId | string | No | Owner user ID (null = joint) |
| name | string | No | Custom display name (defaults to "Year Make Model") |

**Response (201):** Created vehicle with initial valuation.

**Errors:**
- `409` - A vehicle with this VIN already exists in the household

---

### PATCH /vehicles/:id
Update vehicle info. Does not trigger a new valuation.

**Request:**
```json
{
  "trim": "EX-L",
  "zipCode": "90211",
  "ownerId": null,
  "name": "Family Car"
}
```

**Response (200):** Updated vehicle.

---

### DELETE /vehicles/:id
Delete a vehicle, its account, all transactions, and valuation history.

**Response (200):**
```json
{
  "data": { "message": "Vehicle deleted" }
}
```

---

### POST /vehicles/:id/update-mileage
Update mileage and trigger a fresh MarketCheck valuation. Creates a valuation snapshot and updates the account balance.

**Request:**
```json
{
  "mileage": 62000
}
```

**Response (200):**
```json
{
  "data": {
    "id": "veh123",
    "mileage": 62000,
    "account": { "currentBalance": 23100 },
    "latestValuation": {
      "date": "2026-02-14",
      "mileageAtValuation": 62000,
      "marketValue": 23100,
      "msrp": 32851
    },
    "previousValue": 23580,
    "valueChange": -480,
    "valueChangePercent": -2.03
  }
}
```

**Errors:**
- `400` - New mileage cannot be less than current mileage
- `503` - MarketCheck API unavailable

---

### GET /vehicles/:id/valuations
Get valuation history for charts.

**Query Parameters:**
- `limit` - Max results (default: 48, max: 100)

**Response (200):**
```json
{
  "data": [
    {
      "id": "val789",
      "vehicleId": "veh123",
      "date": "2026-01-14",
      "mileageAtValuation": 58000,
      "marketValue": 24100,
      "msrp": 32851
    },
    {
      "id": "val790",
      "vehicleId": "veh123",
      "date": "2026-02-14",
      "mileageAtValuation": 60000,
      "marketValue": 23580,
      "msrp": 32851
    }
  ]
}
```

---

## Upcoming Endpoints

### Sprint 10: SimpleFin Integration
- `GET /simplefin/status` - Get connection status
- `POST /simplefin/connect` - Set up SimpleFin connection
- `POST /simplefin/sync` - Manual sync
- `DELETE /simplefin` - Remove SimpleFin connection

### Sprint 11: Wally AI
- `POST /wally/chat` - Send message, get response
- `GET /wally/conversations` - List past conversations
- `GET /wally/conversations/:id` - Get conversation
- `DELETE /wally/conversations/:id` - Delete conversation

*See [SPRINTS.md](./SPRINTS.md) for full roadmap.*
