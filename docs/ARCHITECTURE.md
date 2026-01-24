# Technical Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         Client Layer                             │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │              React SPA (Mobile-First)                    │    │
│  │  • TypeScript • Tailwind CSS • React Query • Zustand    │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                         API Layer                                │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │              Node.js + Express/Fastify                   │    │
│  │  • TypeScript • JWT Auth • Rate Limiting • Validation   │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                              │
          ┌───────────────────┼───────────────────┐
          ▼                   ▼                   ▼
┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
│    PostgreSQL    │ │      Redis       │ │  External APIs   │
│   (Prisma ORM)   │ │  (Cache/Queue)   │ │ Plaid/SimpleFin  │
└──────────────────┘ └──────────────────┘ │    Claude AI     │
                                          └──────────────────┘
```

---

## Technology Stack

### Frontend
| Technology | Purpose |
|------------|---------|
| React 18 | UI framework |
| TypeScript | Type safety |
| Tailwind CSS | Styling (mobile-first) |
| React Query (TanStack) | Server state management |
| Zustand | Client state management |
| React Router | Navigation |
| Recharts | Charts and visualizations |
| Headless UI | Accessible components |

### Backend
| Technology | Purpose |
|------------|---------|
| Node.js 20+ | Runtime |
| Express or Fastify | HTTP framework |
| TypeScript | Type safety |
| Prisma | ORM and migrations |
| Zod | Request validation |
| jsonwebtoken | Authentication |
| bcrypt | Password hashing |
| Bull/BullMQ | Job queue |

### Infrastructure
| Technology | Purpose |
|------------|---------|
| PostgreSQL 15+ | Primary database |
| Redis | Caching, sessions, job queue |
| Docker | Containerization |
| Nginx | Reverse proxy |

### External Services
| Service | Purpose |
|---------|---------|
| Plaid | Bank connections (primary) |
| SimpleFin Bridge | Bank connections (alternative) |
| Anthropic Claude | Wally AI assistant |
| SendGrid/Resend | Transactional email |

---

## Database Schema

### Core Entities

```prisma
// User and Authentication
model User {
  id            String    @id @default(cuid())
  email         String    @unique
  passwordHash  String
  name          String
  emailVerified Boolean   @default(false)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  accounts      Account[]
  categories    Category[]
  budgets       Budget[]
  goals         Goal[]
  rules         CategorizationRule[]
  conversations Conversation[]
}

// Financial Accounts
model Account {
  id              String      @id @default(cuid())
  userId          String
  user            User        @relation(fields: [userId], references: [id])

  name            String
  type            AccountType
  subtype         String?

  // For connected accounts
  plaidItemId     String?
  plaidAccountId  String?
  simplefinId     String?
  connectionStatus ConnectionStatus @default(ACTIVE)
  lastSyncedAt    DateTime?

  // Balances
  currentBalance  Decimal     @db.Decimal(19, 4)
  availableBalance Decimal?   @db.Decimal(19, 4)
  currency        String      @default("USD")

  // Settings
  isHidden        Boolean     @default(false)
  excludeFromBudget Boolean   @default(false)
  excludeFromNetWorth Boolean @default(false)
  displayOrder    Int         @default(0)

  isManual        Boolean     @default(false)

  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt

  transactions    Transaction[]
}

enum AccountType {
  CHECKING
  SAVINGS
  CREDIT
  INVESTMENT
  LOAN
  MORTGAGE
  ASSET
  OTHER
}

enum ConnectionStatus {
  ACTIVE
  REQUIRES_REAUTH
  DISCONNECTED
  ERROR
}

// Transactions
model Transaction {
  id              String    @id @default(cuid())
  accountId       String
  account         Account   @relation(fields: [accountId], references: [id])

  // Plaid/SimpleFin reference
  externalId      String?   @unique

  date            DateTime  @db.Date
  amount          Decimal   @db.Decimal(19, 4)  // Negative = expense
  currency        String    @default("USD")

  merchantName    String?
  description     String

  categoryId      String?
  category        Category? @relation(fields: [categoryId], references: [id])

  // For manual transactions
  isManual        Boolean   @default(false)
  isAdjustment    Boolean   @default(false)  // Balance adjustment

  // Metadata
  isPending       Boolean   @default(false)
  notes           String?

  // For split transactions
  parentId        String?
  parent          Transaction?  @relation("SplitTransactions", fields: [parentId], references: [id])
  splits          Transaction[] @relation("SplitTransactions")

  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  @@index([accountId, date])
  @@index([categoryId])
}

// Categories
model Category {
  id          String        @id @default(cuid())
  userId      String?       // null = system default
  user        User?         @relation(fields: [userId], references: [id])

  name        String
  type        CategoryType
  icon        String?
  color       String?

  parentId    String?
  parent      Category?     @relation("SubCategories", fields: [parentId], references: [id])
  children    Category[]    @relation("SubCategories")

  isSystem    Boolean       @default(false)

  transactions Transaction[]
  budgets      Budget[]
  rules        CategorizationRule[]

  @@unique([userId, name])
}

enum CategoryType {
  INCOME
  EXPENSE
  TRANSFER
}

// Categorization Rules
model CategorizationRule {
  id          String    @id @default(cuid())
  userId      String
  user        User      @relation(fields: [userId], references: [id])

  categoryId  String
  category    Category  @relation(fields: [categoryId], references: [id])

  // Rule conditions (JSON for flexibility)
  conditions  Json      // { merchantContains?: string, amountMin?: number, ... }

  priority    Int       @default(0)
  isEnabled   Boolean   @default(true)

  createdAt   DateTime  @default(now())

  @@index([userId])
}

// Budgets
model Budget {
  id          String    @id @default(cuid())
  userId      String
  user        User      @relation(fields: [userId], references: [id])

  categoryId  String
  category    Category  @relation(fields: [categoryId], references: [id])

  amount      Decimal   @db.Decimal(19, 4)
  period      String    // "2024-01" format for monthly

  rollover    Boolean   @default(false)

  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  @@unique([userId, categoryId, period])
}

// Goals
model Goal {
  id            String    @id @default(cuid())
  userId        String
  user          User      @relation(fields: [userId], references: [id])

  name          String
  targetAmount  Decimal   @db.Decimal(19, 4)
  currentAmount Decimal   @db.Decimal(19, 4) @default(0)
  targetDate    DateTime?

  icon          String?
  color         String?

  isCompleted   Boolean   @default(false)
  completedAt   DateTime?

  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt
}

// Plaid Items (for token management)
model PlaidItem {
  id              String    @id @default(cuid())
  userId          String

  itemId          String    @unique  // Plaid's item_id
  accessToken     String              // Encrypted
  institutionId   String?
  institutionName String?

  consentExpiresAt DateTime?

  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  @@index([userId])
}

// Wally Conversations
model Conversation {
  id        String    @id @default(cuid())
  userId    String
  user      User      @relation(fields: [userId], references: [id])

  messages  Message[]

  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
}

model Message {
  id             String       @id @default(cuid())
  conversationId String
  conversation   Conversation @relation(fields: [conversationId], references: [id])

  role           String       // "user" | "assistant"
  content        String

  createdAt      DateTime     @default(now())
}
```

---

## API Design

### Authentication
```
POST   /api/auth/register      # Create account
POST   /api/auth/login         # Login
POST   /api/auth/logout        # Logout
POST   /api/auth/refresh       # Refresh token
POST   /api/auth/forgot        # Request password reset
POST   /api/auth/reset         # Reset password
GET    /api/auth/verify/:token # Verify email
```

### Accounts
```
GET    /api/accounts           # List all accounts
POST   /api/accounts           # Create manual account
GET    /api/accounts/:id       # Get account details
PATCH  /api/accounts/:id       # Update account
DELETE /api/accounts/:id       # Remove account
POST   /api/accounts/:id/balance  # Update balance (manual accounts)
POST   /api/accounts/:id/sync  # Trigger sync (connected accounts)
```

### Plaid Integration
```
POST   /api/plaid/link-token   # Create link token
POST   /api/plaid/exchange     # Exchange public token
POST   /api/plaid/webhook      # Webhook handler
DELETE /api/plaid/item/:id     # Remove Plaid item
```

### Transactions
```
GET    /api/transactions       # List (with filters)
GET    /api/transactions/:id   # Get transaction
PATCH  /api/transactions/:id   # Update (category, notes)
POST   /api/transactions       # Create manual transaction
DELETE /api/transactions/:id   # Delete (manual only)
POST   /api/transactions/:id/split  # Split transaction
```

### Categories
```
GET    /api/categories         # List all categories
POST   /api/categories         # Create category
PATCH  /api/categories/:id     # Update category
DELETE /api/categories/:id     # Delete category
POST   /api/categories/merge   # Merge categories
```

### Rules
```
GET    /api/rules              # List rules
POST   /api/rules              # Create rule
PATCH  /api/rules/:id          # Update rule
DELETE /api/rules/:id          # Delete rule
POST   /api/rules/:id/apply    # Apply rule retroactively
```

### Budgets
```
GET    /api/budgets            # List budgets (current period)
GET    /api/budgets/:period    # List budgets for period
POST   /api/budgets            # Create/update budget
DELETE /api/budgets/:id        # Delete budget
```

### Goals
```
GET    /api/goals              # List goals
POST   /api/goals              # Create goal
PATCH  /api/goals/:id          # Update goal
DELETE /api/goals/:id          # Delete goal
POST   /api/goals/:id/add      # Add funds to goal
```

### Dashboard
```
GET    /api/dashboard/summary  # Aggregated dashboard data
GET    /api/dashboard/networth # Net worth history
GET    /api/dashboard/spending # Spending by category
GET    /api/dashboard/recurring # Recurring transactions
```

### Wally AI
```
POST   /api/wally/chat         # Send message, get response
GET    /api/wally/conversations # List past conversations
GET    /api/wally/conversations/:id # Get conversation
DELETE /api/wally/conversations/:id # Delete conversation
```

---

## Security Considerations

### Authentication
- Passwords hashed with bcrypt (cost factor 12)
- JWT tokens with 15-minute expiry
- Refresh tokens stored in HTTP-only cookies
- Rate limiting: 5 attempts per minute on auth endpoints

### Data Protection
- All Plaid access tokens encrypted at rest (AES-256)
- Database connections use TLS
- API served over HTTPS only
- CORS restricted to app domain

### API Security
- All endpoints require authentication (except auth routes)
- Input validation with Zod schemas
- SQL injection prevented via Prisma ORM
- XSS prevented via React's default escaping

---

## Deployment Architecture

### Development
```
localhost:3000  →  React dev server
localhost:4000  →  API server
localhost:5432  →  PostgreSQL
localhost:6379  →  Redis
```

### Production
```
app.otter.money  →  Nginx  →  React (static files)
                          →  API (Node.js)
                          →  PostgreSQL (managed)
                          →  Redis (managed)
```

---

## Background Jobs

Using BullMQ for job processing:

| Job | Schedule | Purpose |
|-----|----------|---------|
| `sync-transactions` | Webhook-triggered | Fetch new transactions from Plaid |
| `apply-rules` | On new transactions | Auto-categorize transactions |
| `refresh-balances` | Every 4 hours | Update account balances |
| `detect-recurring` | Daily | Identify recurring transactions |
| `cleanup-sessions` | Daily | Remove expired sessions |

---

## Monitoring & Logging

- **Application Logs:** Structured JSON logs with request IDs
- **Error Tracking:** Sentry integration
- **Metrics:** Response times, error rates, sync success rates
- **Health Checks:** `/api/health` endpoint for uptime monitoring
