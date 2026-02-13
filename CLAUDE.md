# Otter Money - Agent Context

This file provides context for Claude Code agents working on this project.

## Project Overview

**Otter Money** is a **couples-focused** personal finance app. Two partners share one household and manage their finances together. Each partner has their own login but sees the same shared financial data.

**Key Concept:** Everything is household-level. Accounts, transactions, budgets, and goals belong to the household, not individual users. Each account has an "owner" (Partner A, Partner B, or Joint) for display purposes, but both partners can view and manage everything.

**URLs:**
- Production app: https://app.otter.money
- Landing page: https://otter.money

## Brand

- **Primary Color:** Purple `#9F6FBA` / `rgb(159, 111, 186)`
- **Secondary Color:** White `#FFFFFF`
- **Mascot:** Wally the Otter (and partner - it's a couple of otters!)
- **Tone:** Friendly, encouraging, non-judgmental about spending

## Documentation

Read these files to understand the project:

| File | What It Contains |
|------|------------------|
| `docs/PRD.md` | Product requirements, household model, features |
| `docs/ARCHITECTURE.md` | Tech stack, database schema, API design |
| `docs/SPRINTS.md` | Development roadmap with task checklists |
| `docs/API.md` | API endpoint documentation |

## Tech Stack

### Frontend
- **React 18** with TypeScript
- **Vite** for build tooling
- **Tailwind CSS** for styling (mobile-first, purple theme)
- **Capacitor** for iOS/Android native apps
- **React Query (TanStack Query)** for server state
- **Zustand** for client state
- **React Router** for navigation
- **Recharts** for data visualization

### Backend
- **Node.js** with TypeScript
- **Express** or **Fastify** for HTTP
- **Prisma** ORM with PostgreSQL
- **Zod** for validation
- **JWT** for authentication
- **BullMQ** for background jobs

### Infrastructure
- **PostgreSQL** - primary database
- **Redis** - caching and job queue
- **Docker** - local development

### External Services
- **Plaid** - bank connections (multiple per user, we have production access)
- **SimpleFin Bridge** - alternative bank connections (one per household)
- **Anthropic Claude** - Wally AI assistant

## Household Model

This is critical to understand:

```
Household (shared)
├── User A (Partner 1)
│   ├── Login credentials
│   └── Plaid connections (their banks)
├── User B (Partner 2)
│   ├── Login credentials
│   └── Plaid connections (their banks)
├── SimpleFin connection (one per household)
├── Accounts (each owned by A, B, or "Joint")
├── Transactions (belong to accounts)
├── Categories (shared)
├── Rules (shared)
├── Budgets (shared)
└── Goals (shared)
```

**Key Rules:**
- All data is scoped to the household
- Both partners see everything
- Either partner can categorize any transaction
- Plaid connections are per-user (each partner connects their own banks)
- SimpleFin is per-household (one connection shared)
- Account ownership is for display, not permissions

## Current Sprint Status

Check `docs/SPRINTS.md` for current progress. Update the checkboxes as you complete tasks.

## Project Structure

```
otter-money/
├── CLAUDE.md                    # This file
├── README.md                    # Project readme
├── docs/                        # Documentation
├── package.json                 # Root package.json (monorepo)
├── .dockerignore                # Docker build context exclusions
├── .env.production              # Production env vars (gitignored)
├── .env.production.example      # Template for production env
├── docker-compose.yml           # Dev stack (Redis only)
├── docker-compose.prod.yml      # Production stack (web, api, redis, optional postgres)
├── apps/
│   ├── web/                     # React frontend (Vite)
│   │   ├── src/
│   │   │   ├── components/
│   │   │   ├── pages/
│   │   │   ├── hooks/
│   │   │   ├── stores/
│   │   │   └── utils/
│   │   ├── Dockerfile           # Multi-stage: Vite build → nginx
│   │   ├── nginx.conf           # Production nginx config
│   │   ├── index.html
│   │   └── package.json
│   └── api/                     # Node.js backend
│       ├── src/
│       │   ├── routes/
│       │   ├── services/
│       │   ├── middleware/
│       │   └── utils/
│       ├── Dockerfile           # Multi-stage: build → Node.js Alpine runner
│       └── package.json
├── packages/
│   └── shared/                  # Shared types and utilities
│       └── package.json
├── prisma/
│   ├── schema.prisma            # Database schema
│   ├── seed.ts                  # Default categories seeder
│   └── migrations/              # Prisma migrations
├── scripts/
│   └── docker-entrypoint.sh     # API startup: wait DB → migrate → seed → start
├── src/
│   └── public/                  # Existing assets (logos, icons)
│       └── images/
├── ios/                         # Capacitor iOS project (not yet initialized)
└── android/                     # Capacitor Android project (not yet initialized)
```

## Existing Assets

There are already assets in `src/public/images/`:
- `otters_logo_vector_bg.svg` - Logo with background
- `otters_logo_vector_nobg.svg` - Logo without background
- `otters_table_vector_nobg.svg` - Otters illustration
- `otter_swimming_vector.svg` - Swimming otter
- `favicon.ico` - Favicon
- `logo-512x.png` - App icon
- `components/` - UI component assets (coin, bill, money icons)

Use these existing assets when building the UI.

## Commands (once set up)

```bash
# Install all dependencies
npm install

# Start development (frontend + backend + db)
npm run dev

# Run database migrations
npm run db:migrate

# Generate Prisma client
npm run db:generate

# Run tests
npm test

# Build for production
npm run build

# Capacitor
npm run ios:dev         # iOS with live reload
npm run android:dev     # Android with live reload
npx cap sync            # Sync web build to native
npx cap open ios        # Open Xcode
```

### Docker (Production)

```bash
# Deploy with external Postgres (default):
docker compose -f docker-compose.prod.yml up -d --build

# Deploy with containerized Postgres:
docker compose -f docker-compose.prod.yml --profile db up -d --build

# View logs:
docker compose -f docker-compose.prod.yml logs -f

# Rebuild single service (e.g. after code change):
docker compose -f docker-compose.prod.yml up -d --build api

# Stop production:
docker compose -f docker-compose.prod.yml down
```

## Key Decisions Made

1. **Couples-focused** - Two partners per household, shared data
2. **Household model** - All data belongs to household, not users
3. **Monorepo structure** using npm workspaces
4. **Mobile-first design** - Primary target is phones
5. **Capacitor for native** - iOS and Android via web wrapper
6. **Purple brand** - `#9F6FBA` as primary color
7. **JWT auth** with refresh tokens in HTTP-only cookies
8. **Plaid per-user** - Each partner connects their own banks
9. **SimpleFin per-household** - One connection for the household
10. **Account ownership** - Display only, both partners can manage

## Working on a Sprint

1. Read `docs/SPRINTS.md` to see current sprint tasks
2. Check off tasks as you complete them (update the markdown)
3. Follow patterns in `docs/ARCHITECTURE.md`
4. Update `docs/API.md` when adding endpoints
5. Commit with descriptive messages
6. Push when sprint milestones are complete

## Style Guidelines

- TypeScript strict mode
- Functional components with hooks
- Tailwind for all styling (no CSS files)
- Use brand colors: `#9F6FBA` (purple), white
- Zod schemas for all API validation
- Prisma for all database access
- Mobile-first responsive design
- Always scope queries to household
- Show partner ownership on accounts/transactions

## UX Guidelines

- Mobile-first (bottom navigation, touch-friendly)
- Always show which partner owns an account
- Use "household" language ("Your household spent...")
- Wally speaks to couples ("you two", "your household")
- Both partners should feel equal ownership
- No hidden data between partners
