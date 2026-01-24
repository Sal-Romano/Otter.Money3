# Otter Money - Agent Context

This file provides context for Claude Code agents working on this project.

## Project Overview

**Otter Money** is a personal finance app (mobile-first web app) with:
- Bank account aggregation via Plaid and SimpleFin Bridge
- Manual account tracking for assets (home, car, etc.)
- Transaction categorization with rules engine
- Budgeting and spending analytics
- AI assistant named "Wally" (an otter) powered by Claude

**URLs:**
- Production app: https://app.otter.money
- Landing page: https://otter.money

## Documentation

Read these files to understand the project:

| File | What It Contains |
|------|------------------|
| `docs/PRD.md` | Product requirements, features, user stories |
| `docs/ARCHITECTURE.md` | Tech stack, database schema, API design |
| `docs/SPRINTS.md` | Development roadmap with task checklists |
| `docs/API.md` | API endpoint documentation |

## Tech Stack

### Frontend
- **React 18** with TypeScript
- **Tailwind CSS** for styling (mobile-first)
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
- **Plaid** - bank connections (we have production access)
- **SimpleFin Bridge** - alternative bank connections
- **Anthropic Claude** - Wally AI assistant

## Current Sprint Status

Check `docs/SPRINTS.md` for current progress. Update the checkboxes as you complete tasks.

## Project Structure (Target)

```
otter-money/
├── CLAUDE.md            # This file
├── README.md            # Project readme
├── docs/                # Documentation
├── package.json         # Root package.json (monorepo)
├── apps/
│   ├── web/             # React frontend
│   │   ├── src/
│   │   │   ├── components/
│   │   │   ├── pages/
│   │   │   ├── hooks/
│   │   │   ├── stores/
│   │   │   └── utils/
│   │   └── package.json
│   └── api/             # Node.js backend
│       ├── src/
│       │   ├── routes/
│       │   ├── services/
│       │   ├── middleware/
│       │   └── utils/
│       └── package.json
├── packages/
│   └── shared/          # Shared types and utilities
│       └── package.json
├── prisma/
│   └── schema.prisma    # Database schema
└── docker-compose.yml   # Local dev environment
```

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
```

## Key Decisions Made

1. **Monorepo structure** using npm workspaces
2. **Mobile-first design** - all UI should work great on phones
3. **JWT auth** with refresh tokens in HTTP-only cookies
4. **Plaid primary**, SimpleFin as fallback for unsupported banks
5. **Manual transactions on synced accounts** - TBD (see PRD.md section 3.4)

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
- Zod schemas for all API validation
- Prisma for all database access
- Mobile-first responsive design
