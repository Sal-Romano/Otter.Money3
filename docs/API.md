# API Specification

> Detailed API documentation will be added as endpoints are implemented.
> See [ARCHITECTURE.md](./ARCHITECTURE.md) for API overview.

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

All responses follow this structure:

### Success Response
```json
{
  "data": { ... },
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 100
  }
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
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `RATE_LIMITED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Server error |

---

## Endpoints

*Documentation will be added per sprint as endpoints are implemented.*

### Sprint 1: Authentication
- `POST /api/auth/register` - *TBD*
- `POST /api/auth/login` - *TBD*
- `POST /api/auth/logout` - *TBD*
- `POST /api/auth/refresh` - *TBD*

### Sprint 2: Accounts
- `GET /api/accounts` - *TBD*
- `POST /api/accounts` - *TBD*
- `PATCH /api/accounts/:id` - *TBD*
- `DELETE /api/accounts/:id` - *TBD*

### Sprint 3: Transactions
- `GET /api/transactions` - *TBD*
- `POST /api/transactions` - *TBD*
- `PATCH /api/transactions/:id` - *TBD*
- `DELETE /api/transactions/:id` - *TBD*

*... continued in later sprints*
