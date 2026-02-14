# Technical Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         Client Layer                             │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │         React SPA (Mobile-First) + Capacitor            │    │
│  │  • TypeScript • Tailwind CSS • React Query • Zustand    │    │
│  └─────────────────────────────────────────────────────────┘    │
│                    ↓                    ↓                        │
│              [iOS App]            [Android App]                  │
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
└──────────────────┘ └──────────────────┘ │ MarketCheck/NHTSA│
                                          │    Claude AI     │
                                          └──────────────────┘
```

---

## Brand & Design Tokens

```css
/* Primary Colors */
--color-primary: #9F6FBA;        /* rgb(159, 111, 186) */
--color-primary-light: #B88FCE;
--color-primary-dark: #7A5090;

/* Neutral */
--color-white: #FFFFFF;
--color-gray-50: #F9FAFB;
--color-gray-900: #111827;

/* Semantic */
--color-success: #10B981;
--color-warning: #F59E0B;
--color-error: #EF4444;
```

---

## Technology Stack

### Frontend
| Technology | Purpose |
|------------|---------|
| React 18 | UI framework |
| TypeScript | Type safety |
| Tailwind CSS | Styling (mobile-first) |
| Capacitor | iOS/Android native wrapper |
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
| Plaid | Bank connections (per-user, multiple) |
| SimpleFin Bridge | Bank connections (per-household, single) |
| Anthropic Claude | Wally AI assistant |
| MarketCheck | Vehicle market value predictions (500 req/month free) |
| NHTSA vPIC | VIN decoding (free, unlimited, no API key) |
| AWS SES | Transactional email (password reset, notifications) |

---

## Database Schema

### Core Entities

```prisma
// ============================================
// HOUSEHOLD & USERS
// ============================================

model Household {
  id            String    @id @default(cuid())
  name          String?   // "The Smiths" or null for default
  inviteCode    String    @unique @default(cuid())

  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  // Relations
  members       User[]
  accounts      Account[]
  categories    Category[]
  budgets       Budget[]
  goals         Goal[]
  rules         CategorizationRule[]
  simplefinConnection SimplefinConnection?
  conversations Conversation[]
}

model User {
  id            String         @id @default(cuid())
  email         String         @unique
  passwordHash  String
  name          String
  avatarUrl     String?
  emailVerified Boolean        @default(false)

  householdId   String?
  household     Household?     @relation(fields: [householdId], references: [id])
  householdRole HouseholdRole  @default(PARTNER)

  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  // User-specific relations
  plaidItems    PlaidItem[]
  ownedAccounts Account[] @relation("AccountOwner")

  @@index([householdId])
}

enum HouseholdRole {
  ORGANIZER  // Created the household, can manage members
  PARTNER    // Invited member, full data access
}

// ============================================
// FINANCIAL ACCOUNTS
// ============================================

model Account {
  id              String      @id @default(cuid())

  // Belongs to household
  householdId     String
  household       Household   @relation(fields: [householdId], references: [id])

  // Owned by specific user (or joint)
  ownerId         String?     // null = joint account
  owner           User?       @relation("AccountOwner", fields: [ownerId], references: [id])

  name            String
  type            AccountType
  subtype         String?

  // Connection info
  connectionType  ConnectionType  @default(MANUAL)
  plaidItemId     String?
  plaidAccountId  String?
  simplefinAccountId String?
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

  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt

  transactions    Transaction[]

  @@index([householdId])
  @@index([ownerId])
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

enum ConnectionType {
  PLAID
  SIMPLEFIN
  MANUAL
}

enum ConnectionStatus {
  ACTIVE
  REQUIRES_REAUTH
  DISCONNECTED
  ERROR
}

// ============================================
// TRANSACTIONS
// ============================================

model Transaction {
  id              String    @id @default(cuid())
  accountId       String
  account         Account   @relation(fields: [accountId], references: [id])

  // External reference (Plaid/SimpleFin)
  externalId      String?   @unique

  date            DateTime  @db.Date
  amount          Decimal   @db.Decimal(19, 4)  // Negative = expense
  currency        String    @default("USD")

  merchantName    String?
  description     String

  categoryId      String?
  category        Category? @relation(fields: [categoryId], references: [id])

  // Manual vs synced
  isManual        Boolean   @default(false)
  isAdjustment    Boolean   @default(false)  // Balance adjustment for manual accounts

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

// ============================================
// CATEGORIES & RULES
// ============================================

model Category {
  id          String        @id @default(cuid())

  // null householdId = system default category
  householdId String?
  household   Household?    @relation(fields: [householdId], references: [id])

  name        String
  type        CategoryType
  icon        String?
  color       String?

  parentId    String?
  parent      Category?     @relation("SubCategories", fields: [parentId], references: [id])
  children    Category[]    @relation("SubCategories")

  isSystem    Boolean       @default(false)  // Can't be deleted

  transactions Transaction[]
  budgets      Budget[]
  rules        CategorizationRule[]

  @@unique([householdId, name])
}

enum CategoryType {
  INCOME
  EXPENSE
  TRANSFER
}

model CategorizationRule {
  id          String    @id @default(cuid())
  householdId String
  household   Household @relation(fields: [householdId], references: [id])

  categoryId  String
  category    Category  @relation(fields: [categoryId], references: [id])

  // Rule conditions
  conditions  Json      // { merchantContains?: string, amountMin?: number, ... }

  priority    Int       @default(0)
  isEnabled   Boolean   @default(true)

  createdAt   DateTime  @default(now())

  @@index([householdId])
}

// ============================================
// BUDGETS & GOALS
// ============================================

model Budget {
  id          String    @id @default(cuid())
  householdId String
  household   Household @relation(fields: [householdId], references: [id])

  categoryId  String
  category    Category  @relation(fields: [categoryId], references: [id])

  amount      Decimal   @db.Decimal(19, 4)
  period      String    // "2024-01" format for monthly

  rollover    Boolean   @default(false)

  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  @@unique([householdId, categoryId, period])
}

model Goal {
  id            String    @id @default(cuid())
  householdId   String
  household     Household @relation(fields: [householdId], references: [id])

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

// ============================================
// INTEGRATIONS
// ============================================

// Plaid - multiple per user
model PlaidItem {
  id              String    @id @default(cuid())
  userId          String
  user            User      @relation(fields: [userId], references: [id])

  itemId          String    @unique  // Plaid's item_id
  accessToken     String              // Encrypted
  institutionId   String?
  institutionName String?

  consentExpiresAt DateTime?
  cursor          String?   // For transaction sync

  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  @@index([userId])
}

// SimpleFin - one per household
model SimplefinConnection {
  id              String    @id @default(cuid())
  householdId     String    @unique
  household       Household @relation(fields: [householdId], references: [id])

  accessUrl       String    // Encrypted SimpleFin access URL
  lastSyncedAt    DateTime?

  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
}

// ============================================
// WALLY AI
// ============================================

model Conversation {
  id          String    @id @default(cuid())
  householdId String
  household   Household @relation(fields: [householdId], references: [id])

  messages    Message[]

  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
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
POST   /api/auth/register         # Create account + household
POST   /api/auth/register/join    # Create account + join household via invite
POST   /api/auth/login            # Login
POST   /api/auth/logout           # Logout
POST   /api/auth/refresh          # Refresh token
POST   /api/auth/forgot           # Request password reset
POST   /api/auth/reset            # Reset password
GET    /api/auth/verify/:token    # Verify email
```

### Household
```
GET    /api/household                           # Get current household
PATCH  /api/household                           # Update household name
GET    /api/household/invite                    # Get invite code/link
POST   /api/household/invite/regenerate         # New invite code (organizer only)
GET    /api/household/members                   # List household members
GET    /api/household/members/:id/removal-impact # Get impact of removing member (organizer only)
DELETE /api/household/members/:id               # Remove partner from household (organizer only)
```

### Accounts
```
GET    /api/accounts              # List all household accounts
POST   /api/accounts              # Create manual account
GET    /api/accounts/:id          # Get account details
PATCH  /api/accounts/:id          # Update account
DELETE /api/accounts/:id          # Remove account
POST   /api/accounts/:id/balance  # Update balance (manual accounts)
POST   /api/accounts/:id/sync     # Trigger sync (connected accounts)
```

### Plaid Integration (per user)
```
POST   /api/plaid/link-token      # Create link token for current user
POST   /api/plaid/exchange        # Exchange public token
POST   /api/plaid/webhook         # Webhook handler
DELETE /api/plaid/item/:id        # Remove Plaid item
```

**Amount Normalization:** Some institutions (e.g., PenFed) send transfer transactions with non-standard sign conventions. The `normalizeTransactionAmount()` utility in `apps/api/src/utils/plaid.ts` detects DEBIT/CREDIT keywords in transaction descriptions to ensure correct signage.

### SimpleFin Integration (per household)
```
GET    /api/simplefin/status      # Get connection status
POST   /api/simplefin/connect     # Set up SimpleFin connection
POST   /api/simplefin/sync        # Manual sync
DELETE /api/simplefin             # Remove SimpleFin connection
```

### Vehicle Value Tracking
```
POST   /api/vehicles/decode-vin         # Decode VIN (NHTSA, free)
GET    /api/vehicles                    # List household vehicles
GET    /api/vehicles/:id                # Vehicle detail
POST   /api/vehicles                    # Add vehicle (creates ASSET account + initial valuation)
PATCH  /api/vehicles/:id                # Update vehicle info
DELETE /api/vehicles/:id                # Remove vehicle + account
POST   /api/vehicles/:id/update-mileage # Update mileage + get fresh MarketCheck valuation
GET    /api/vehicles/:id/valuations     # Valuation history (for depreciation chart)
```

### Transactions
```
GET    /api/transactions          # List (with filters: partner, account, category, date)
GET    /api/transactions/:id      # Get transaction
PATCH  /api/transactions/:id      # Update (category, notes)
POST   /api/transactions          # Create manual transaction
DELETE /api/transactions/:id      # Delete (manual only)
POST   /api/transactions/:id/split  # Split transaction
```

### Categories (household-level)
```
GET    /api/categories            # List all categories
POST   /api/categories            # Create category
PATCH  /api/categories/:id        # Update category
DELETE /api/categories/:id        # Delete category
POST   /api/categories/merge      # Merge categories
```

### Rules (household-level)
```
GET    /api/rules                 # List rules
POST   /api/rules                 # Create rule
PATCH  /api/rules/:id             # Update rule
DELETE /api/rules/:id             # Delete rule
POST   /api/rules/:id/apply       # Apply rule retroactively
```

### Budgets (household-level)
```
GET    /api/budgets               # List budgets (current period)
GET    /api/budgets/:period       # List budgets for period
POST   /api/budgets               # Create/update budget
DELETE /api/budgets/:id           # Delete budget
GET    /api/budgets/spending      # Get spending by partner breakdown
```

### Goals (household-level)
```
GET    /api/goals                 # List goals
POST   /api/goals                 # Create goal
PATCH  /api/goals/:id             # Update goal
DELETE /api/goals/:id             # Delete goal
POST   /api/goals/:id/add         # Add funds to goal
```

### Dashboard
```
GET    /api/dashboard/summary     # Aggregated household dashboard data
GET    /api/dashboard/networth    # Net worth history (with partner breakdown)
GET    /api/dashboard/spending    # Spending by category (with partner breakdown)
GET    /api/dashboard/recurring   # Recurring transactions
```

### Wally AI
```
POST   /api/wally/chat            # Send message, get response
GET    /api/wally/conversations   # List past conversations
GET    /api/wally/conversations/:id # Get conversation
DELETE /api/wally/conversations/:id # Delete conversation
```

### User Profile
```
GET    /api/user/me               # Get current user
PATCH  /api/user/me               # Update profile
POST   /api/user/avatar           # Upload avatar
DELETE /api/user/me               # Delete account (with household implications)
```

---

## Security Considerations

### Authentication
- Passwords hashed with bcrypt (cost factor 12)
- JWT tokens with 15-minute expiry
- Refresh tokens stored in HTTP-only cookies
- Rate limiting: 5 attempts per minute on auth endpoints

### Household Isolation
- All queries scoped to user's household
- Users can only access their household's data
- Invite codes are single-use or time-limited

### Data Protection
- All Plaid/SimpleFin tokens encrypted at rest (AES-256)
- Database connections use TLS
- API served over HTTPS only
- CORS restricted to app domain

### API Security
- All endpoints require authentication (except auth routes)
- Input validation with Zod schemas
- SQL injection prevented via Prisma ORM
- XSS prevented via React's default escaping

---

## Capacitor Configuration

### Platforms
- iOS (primary)
- Android (secondary)
- Web (PWA fallback)

### Native Features Used
- Push notifications (future)
- Biometric auth (future)
- Secure storage for tokens

### Build Commands
```bash
# Development
npm run dev              # Web dev server
npm run ios:dev          # iOS with live reload
npm run android:dev      # Android with live reload

# Production
npm run build            # Build web assets
npx cap sync             # Sync to native projects
npx cap open ios         # Open in Xcode
npx cap open android     # Open in Android Studio
```

---

## Deployment Architecture

### Development
```
localhost:3001  →  React dev server (Vite)
localhost:4000  →  API server
localhost:5433  →  PostgreSQL (native)
localhost:6379  →  Redis (Docker via docker-compose.yml)
```

### Production (Docker)

```
Cloudflare Tunnel (app.otter.money)
    ↓ port 3450
┌─────────────────────────────────────────────────────────┐
│  Docker Compose (docker-compose.prod.yml)               │
│                                                         │
│  ┌─────────────────┐                                    │
│  │   otter-web     │  nginx :80 → host :3450            │
│  │   (React SPA)   │  - Serves static files             │
│  │                 │  - Proxies /api/* to API            │
│  └────────┬────────┘                                    │
│           │                                             │
│  ┌────────▼────────┐                                    │
│  │   otter-api     │  Express :4000 (internal only)     │
│  │   (Node.js)     │  - Auto-runs migrations on start   │
│  │                 │  - Optional seed (SEED_DB=true)     │
│  └───┬─────────┬───┘                                    │
│      │         │                                        │
│  ┌───▼───┐ ┌───▼──────────────┐                         │
│  │ Redis │ │ PostgreSQL       │  Optional (--profile db)│
│  │ :6379 │ │ :5432 → host:5434│  OR external via        │
│  └───────┘ └──────────────────┘  host.docker.internal   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Deployment Modes

**External Postgres (default)** — point `DATABASE_URL` at your own Postgres:
```bash
docker compose -f docker-compose.prod.yml up -d --build
```

**Containerized Postgres** — full self-contained stack:
```bash
# Set DATABASE_URL=postgresql://otter:changeme@postgres:5432/otter_money?schema=public
docker compose -f docker-compose.prod.yml --profile db up -d --build
```

**Rebuild a single service:**
```bash
docker compose -f docker-compose.prod.yml up -d --build api
```

### Docker Files

| File | Purpose |
|------|---------|
| `docker-compose.prod.yml` | Production stack (web, api, redis, optional postgres) |
| `docker-compose.yml` | Dev stack (redis only) |
| `apps/api/Dockerfile` | Multi-stage: build API + shared → Node.js Alpine runner |
| `apps/web/Dockerfile` | Multi-stage: build React SPA → nginx Alpine |
| `apps/web/nginx.conf` | Nginx config: gzip, security headers, API proxy, SPA routing |
| `scripts/docker-entrypoint.sh` | API entrypoint: wait for DB → migrate → seed → start |
| `.env.production` | Production environment variables (gitignored) |
| `.env.production.example` | Template for production env |
| `.dockerignore` | Excludes node_modules, .git, dist, etc. from build context |

### API Container Startup Flow

1. Wait for database to be reachable (retries up to 30 times)
2. Run `prisma migrate deploy` (applies pending migrations)
3. If `SEED_DB=true`, run `prisma db seed` (default categories)
4. Start Express server on port 4000

### Nginx Configuration

- Serves React SPA static files from `/usr/share/nginx/html`
- Proxies `/api/*` to the API container on the Docker network
- Gzip compression for text/js/css/json
- Security headers (X-Frame-Options, X-Content-Type-Options, Referrer-Policy)
- 1-year cache for static assets (js, css, images, fonts)
- `client_max_body_size 10m` for CSV imports
- Proxy timeouts: 30s connect, 120s read/send (for long operations)
- SPA fallback: all non-file routes serve `index.html`

---

## Background Jobs

Using BullMQ for job processing:

| Job | Schedule | Purpose |
|-----|----------|---------|
| `sync-plaid-transactions` | Webhook-triggered | Fetch new transactions from Plaid |
| `sync-simplefin` | Every 4 hours | Fetch from SimpleFin |
| `apply-rules` | On new transactions | Auto-categorize transactions |
| `refresh-balances` | Every 4 hours | Update account balances |
| `detect-recurring` | Daily | Identify recurring transactions |
| `cleanup-sessions` | Daily | Remove expired sessions |
| `send-budget-alerts` | Daily | Notify households approaching limits |

---

## Email Service (AWS SES)

Transactional emails are sent via AWS Simple Email Service (SES).

### Configuration

```bash
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=us-east-1
EMAIL_FROM=no-reply@otter.money
```

### Setup Requirements

1. **Verified Domain**: `otter.money` must be verified in SES
2. **IAM User**: Create user with `ses:SendEmail` permission
3. **Production Mode**: Request SES production access (sandbox limits to verified emails only)

### Email Templates

| Email | Trigger | Description |
|-------|---------|-------------|
| Password Reset | `POST /api/auth/forgot-password` | Reset link valid for 1 hour |
| Welcome | Account creation | Welcome + getting started tips |
| Partner Joined | Partner joins household | Notification to existing partner |
| Budget Alert | Daily job | Approaching/exceeded budget |

### Development

In development (no AWS credentials), emails are logged to console instead of sent.

---

## Responsive Design & Layout

### Breakpoint Strategy

| Breakpoint | Width | Layout |
|------------|-------|--------|
| Mobile (default) | < 768px | Bottom navigation, full-width content |
| Desktop (md:) | ≥ 768px | Sidebar navigation, constrained content |

### Desktop Layout Structure

```
┌──────────┬─────────────────────────┬──────────┐
│  72px    │   max-w-2xl centered    │  72px    │
│  Left    │                         │  Right   │
│ Sidebar  │      Main Content       │  Pane    │
│          │                         │ (Future) │
│  [Nav]   │      <Outlet />         │ Wally AI │
└──────────┴─────────────────────────┴──────────┘
```

### Layout Component (Layout.tsx)

The Layout component handles both mobile and desktop layouts:

- **Mobile (<768px)**: Fixed bottom navigation with 5 nav items
- **Desktop (≥768px)**:
  - Fixed left sidebar (72px) with logo + vertical nav
  - Fixed right pane (72px) placeholder for Wally AI
  - Main content centered with max-width constraint

### Navigation Items

| Route | Label | Icon |
|-------|-------|------|
| `/` | Home | HomeIcon |
| `/transactions` | Transactions | ListIcon |
| `/accounts` | Accounts | WalletIcon |
| `/analytics` | Analytics | AnalyticsIcon |
| `/settings` | Settings | SettingsIcon |

### Design Decisions

1. **72px sidebars**: Compact but readable with icon + label
2. **max-w-2xl content**: ~672px max width for readability on wide screens
3. **Fixed positioning**: Sidebars stay visible during scroll
4. **No JavaScript**: Layout switch handled purely by Tailwind responsive classes
