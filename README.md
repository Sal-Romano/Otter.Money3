# Otter Money

Couples finance management app - manage your household finances together.

**Production URL:** https://app.otter.money
**Landing Page:** https://otter.money

## Overview

Otter Money is a mobile-first finance app designed for **couples** to manage their household finances together. Each partner has their own login but shares a unified view of the household's financial picture. Connect bank accounts via Plaid or SimpleFin, categorize transactions, set budgets, and chat with Wally - your friendly AI otter assistant.

## Key Features

- **Household Model** - One shared household, two individual logins
- **Dashboard** - Combined net worth, spending, and goal progress for the household
- **Transaction Management** - Each partner categorizes their own transactions with shared rules
- **Account Aggregation** - Multiple Plaid connections (per partner) + one SimpleFin account
- **Budgeting** - Household budgets with visibility into who spent what
- **Wally AI** - Conversational AI assistant with full context of your household finances

## Documentation

| Document | Description |
|----------|-------------|
| [Product Requirements](docs/PRD.md) | Features, user stories, and acceptance criteria |
| [Architecture](docs/ARCHITECTURE.md) | Technical design and system overview |
| [Sprint Roadmap](docs/SPRINTS.md) | Development phases and milestones |
| [API Specification](docs/API.md) | Backend API endpoints and contracts |

## Tech Stack

- **Frontend:** React + TypeScript, Tailwind CSS, mobile-first design
- **Backend:** Node.js + TypeScript, Express/Fastify
- **Database:** PostgreSQL with Prisma ORM
- **Mobile:** Capacitor (iOS & Android)
- **Integrations:** Plaid API, SimpleFin Bridge
- **AI:** Anthropic Claude API (Wally assistant)
- **Auth:** JWT-based authentication

## Brand

- **Primary Color:** Purple `rgb(159, 111, 186)` / `#9F6FBA`
- **Secondary Color:** White `#FFFFFF`
- **Mascot:** Wally the Otter (and partner!)

## Getting Started

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env

# Run database migrations
npm run db:migrate

# Start development server
npm run dev

# Preview on iOS (requires Xcode)
npm run ios
```

## Project Structure

```
otter-money/
├── docs/                 # Project documentation
├── apps/
│   ├── web/             # React frontend
│   └── api/             # Node.js backend
├── packages/
│   └── shared/          # Shared types and utilities
├── prisma/              # Database schema and migrations
├── src/
│   └── public/          # Static assets (logos, icons)
├── ios/                 # Capacitor iOS project
└── android/             # Capacitor Android project
```

## License

Private - All rights reserved
