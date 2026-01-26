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

## Upcoming Endpoints

### Sprint 2: Accounts
- `GET /accounts` - List all household accounts
- `POST /accounts` - Create manual account
- `PATCH /accounts/:id` - Update account
- `DELETE /accounts/:id` - Delete account

### Sprint 3: Transactions
- `GET /transactions` - List transactions (with filters)
- `POST /transactions` - Create manual transaction
- `PATCH /transactions/:id` - Update transaction
- `DELETE /transactions/:id` - Delete transaction

### Sprint 4: Categories
- `GET /categories` - List categories
- `POST /categories` - Create category
- `PATCH /categories/:id` - Update category
- `DELETE /categories/:id` - Delete category

*See [SPRINTS.md](./SPRINTS.md) for full roadmap.*
