# Otter Money

Personal finance management app with a friendly otter assistant named Wally.

**Production URL:** https://app.otter.money
**Landing Page:** https://otter.money

## Overview

Otter Money is a mobile-first personal finance application that helps users track their spending, manage budgets, monitor investments, and achieve financial goals. The app integrates with Plaid and SimpleFin Bridge for automatic bank/transaction syncing, while also supporting manual account tracking for assets like vehicles and property.

## Key Features

- **Dashboard** - At-a-glance view of net worth, recent transactions, spending trends, and goal progress
- **Transaction Management** - Automatic categorization with rules engine, manual transaction support
- **Account Aggregation** - Plaid & SimpleFin integration + manual account tracking
- **Budgeting** - Monthly spending limits with category-based tracking
- **Wally AI** - Conversational AI assistant with full context of your finances

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
- **Integrations:** Plaid API, SimpleFin Bridge
- **AI:** Anthropic Claude API (Wally assistant)
- **Auth:** JWT-based authentication

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
```

## Project Structure

```
otter-money/
├── docs/                 # Project documentation
├── src/
│   ├── app/             # Frontend application
│   ├── server/          # Backend API
│   ├── shared/          # Shared types and utilities
│   └── db/              # Database schema and migrations
├── public/              # Static assets
└── tests/               # Test suites
```

## License

Private - All rights reserved
