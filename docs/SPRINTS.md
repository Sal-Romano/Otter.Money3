# Sprint Roadmap

## Overview

Development is organized into sprints, each delivering a working increment of the product. Each sprint builds on the previous, with the goal of having a usable (if minimal) product as early as possible.

**Sprint Duration:** Flexible (tracked by completion, not time)
**Definition of Done:** Feature complete, tested, documented

---

## Sprint 0: Project Foundation
**Status:** 🟡 In Progress
**Goal:** Project setup and infrastructure

### Tasks
- [x] Create project documentation (PRD, Architecture, Sprints)
- [x] Initialize git repository
- [ ] Set up monorepo structure (frontend + backend)
- [ ] Configure TypeScript, ESLint, Prettier
- [ ] Set up Tailwind CSS
- [ ] Create basic project scaffolding
- [ ] Set up development environment (Docker Compose)
- [ ] Configure environment variables structure
- [ ] Set up database with Prisma
- [ ] Create initial schema migration

### Deliverables
- Running dev environment with hot reload
- Empty app shell that builds successfully
- Database ready for development

---

## Sprint 1: Authentication & Core UI
**Status:** ⚪ Not Started
**Goal:** Users can register, login, and see a basic app shell

### Tasks
- [ ] Implement user registration API
- [ ] Implement login/logout API
- [ ] Implement JWT authentication middleware
- [ ] Create auth context on frontend
- [ ] Build login page (mobile-first)
- [ ] Build registration page
- [ ] Build password reset flow
- [ ] Create app layout (nav, sidebar/bottom nav)
- [ ] Implement protected routes
- [ ] Build basic settings page (profile)

### Deliverables
- Working authentication flow
- App shell with navigation
- User can create account and login

---

## Sprint 2: Manual Accounts & Dashboard Foundation
**Status:** ⚪ Not Started
**Goal:** Users can add manual accounts and see basic dashboard

### Tasks
- [ ] Implement accounts API (CRUD)
- [ ] Build accounts list page
- [ ] Build add/edit account modal
- [ ] Implement balance update with adjustment transactions
- [ ] Build basic dashboard layout
- [ ] Implement net worth calculation
- [ ] Build net worth chart component
- [ ] Create account type icons/styling

### Deliverables
- User can add manual accounts (checking, savings, assets)
- User can update balances
- Dashboard shows net worth over time

---

## Sprint 3: Manual Transactions & Categories
**Status:** ⚪ Not Started
**Goal:** Users can manually track transactions and categorize them

### Tasks
- [ ] Implement transactions API (CRUD)
- [ ] Implement categories API with default categories
- [ ] Build transactions list page with filters
- [ ] Build add/edit transaction modal
- [ ] Build category selector component
- [ ] Build category management in settings
- [ ] Implement transaction search
- [ ] Add transactions preview to dashboard

### Deliverables
- User can manually add transactions
- User can categorize transactions
- User can manage custom categories
- Dashboard shows recent transactions

---

## Sprint 4: Plaid Integration
**Status:** ⚪ Not Started
**Goal:** Users can connect bank accounts via Plaid

### Tasks
- [ ] Set up Plaid client and configuration
- [ ] Implement Plaid Link token generation
- [ ] Implement public token exchange
- [ ] Build Plaid Link integration in frontend
- [ ] Implement transaction sync (initial)
- [ ] Implement webhook handlers
- [ ] Handle connection status and re-authentication
- [ ] Map Plaid categories to app categories
- [ ] Update dashboard for connected accounts

### Deliverables
- User can connect bank accounts
- Transactions automatically sync
- Balances update via Plaid

---

## Sprint 5: Categorization Rules Engine
**Status:** ⚪ Not Started
**Goal:** Automatic transaction categorization with user-defined rules

### Tasks
- [ ] Design rules engine data model
- [ ] Implement rules API (CRUD)
- [ ] Build rules management UI
- [ ] Implement rule matching logic
- [ ] Auto-apply rules on new transactions
- [ ] Build "create rule from transaction" UX
- [ ] Implement retroactive rule application
- [ ] Add rule suggestions based on patterns

### Deliverables
- User can create categorization rules
- New transactions auto-categorized
- Option to apply rules to existing transactions

---

## Sprint 6: Budgeting
**Status:** ⚪ Not Started
**Goal:** Users can set and track monthly budgets

### Tasks
- [ ] Implement budget API (CRUD)
- [ ] Build budget setup page
- [ ] Build budget tracking view
- [ ] Implement spending calculations per category
- [ ] Build progress bar components
- [ ] Add budget status to dashboard
- [ ] Implement budget alerts (approaching/exceeded)
- [ ] Add copy budget from previous month

### Deliverables
- User can set monthly budgets by category
- User can track spending against budget
- Dashboard shows budget status

---

## Sprint 7: Spending Analytics
**Status:** ⚪ Not Started
**Goal:** Rich spending insights and month-over-month comparison

### Tasks
- [ ] Build spending breakdown chart (pie/donut)
- [ ] Implement month-over-month comparison
- [ ] Build spending trends view
- [ ] Add category drill-down
- [ ] Implement spending insights calculations
- [ ] Update dashboard spending preview
- [ ] Add date range selector

### Deliverables
- User can view spending by category
- User can compare spending across months
- Dashboard shows spending trends

---

## Sprint 8: Recurring Transactions
**Status:** ⚪ Not Started
**Goal:** Detect and display recurring payments/subscriptions

### Tasks
- [ ] Implement recurring transaction detection algorithm
- [ ] Build recurring transactions API
- [ ] Build recurring payments list view
- [ ] Add upcoming bills preview to dashboard
- [ ] Implement manual recurring transaction tagging
- [ ] Add expected amount tracking
- [ ] Build subscription management view

### Deliverables
- Auto-detect recurring transactions
- Dashboard shows upcoming bills
- User can manage recurring payment entries

---

## Sprint 9: Goals
**Status:** ⚪ Not Started
**Goal:** Users can set and track savings goals

### Tasks
- [ ] Implement goals API (CRUD)
- [ ] Build goals list page
- [ ] Build add/edit goal modal
- [ ] Implement progress tracking
- [ ] Build goal progress visualization
- [ ] Add "add funds" action
- [ ] Calculate projected completion date
- [ ] Add goals preview to dashboard

### Deliverables
- User can create savings goals
- User can track progress toward goals
- Dashboard shows goal progress

---

## Sprint 10: SimpleFin Integration
**Status:** ⚪ Not Started
**Goal:** Alternative bank connection for institutions not on Plaid

### Tasks
- [ ] Research SimpleFin Bridge API
- [ ] Implement SimpleFin authentication flow
- [ ] Implement account fetching
- [ ] Implement transaction syncing
- [ ] Handle SimpleFin-specific edge cases
- [ ] Add SimpleFin as connection option in UI
- [ ] Test with various institutions

### Deliverables
- User can connect accounts via SimpleFin
- Transactions sync from SimpleFin accounts

---

## Sprint 11: Wally AI Assistant
**Status:** ⚪ Not Started
**Goal:** Users can chat with Wally about their finances

### Tasks
- [ ] Design Wally's personality and system prompt
- [ ] Implement Claude API integration
- [ ] Build financial data context aggregation
- [ ] Implement chat API endpoints
- [ ] Build chat UI component
- [ ] Add floating action button (mobile)
- [ ] Implement conversation history
- [ ] Add suggested prompts
- [ ] Build rich response rendering (charts, tables)

### Deliverables
- User can chat with Wally
- Wally has context of user's financial data
- Wally provides helpful financial insights

---

## Sprint 12: Investments (Basic)
**Status:** ⚪ Not Started
**Goal:** Basic investment tracking and performance

### Tasks
- [ ] Enable Plaid Investments product
- [ ] Fetch investment holdings
- [ ] Display investment accounts
- [ ] Calculate total investment value
- [ ] Show basic gain/loss
- [ ] Add investments preview to dashboard

### Deliverables
- User can see investment account values
- Dashboard shows investment performance

---

## Sprint 13: Polish & Performance
**Status:** ⚪ Not Started
**Goal:** Production-ready quality and performance

### Tasks
- [ ] Performance audit and optimization
- [ ] Accessibility audit (WCAG 2.1 AA)
- [ ] Error handling improvements
- [ ] Loading states and skeletons
- [ ] Empty states design
- [ ] Onboarding flow for new users
- [ ] Data export functionality
- [ ] Mobile gesture refinements
- [ ] Cross-browser testing

### Deliverables
- App performs well on mobile
- All features accessible
- Polished user experience

---

## Sprint 14: Production Deployment
**Status:** ⚪ Not Started
**Goal:** Live production deployment

### Tasks
- [ ] Set up production infrastructure
- [ ] Configure production database
- [ ] Set up Redis for production
- [ ] Configure production Plaid keys
- [ ] Set up monitoring (Sentry, logs)
- [ ] Configure SSL certificates
- [ ] Set up CI/CD pipeline
- [ ] Configure backups
- [ ] Deploy to production
- [ ] Smoke testing in production

### Deliverables
- App live at app.otter.money
- Monitoring and alerting active
- Automated deployments working

---

## Future Sprints (Backlog)

### Investment Deep Dive
- Full holdings view with lots
- Performance by holding
- Asset allocation charts
- Dividend tracking

### Multi-Currency Support
- Currency preferences
- Exchange rate tracking
- Multi-currency transactions

### Shared Households
- Invite household members
- Shared vs personal accounts
- Permission levels

### Advanced Reporting
- Custom date range reports
- Tax-related categorization
- Year-end summaries
- Export to tax software

### Mobile Native App
- React Native or PWA
- Push notifications
- Biometric authentication
- Offline support

---

## Sprint Status Legend

| Icon | Status |
|------|--------|
| ⚪ | Not Started |
| 🟡 | In Progress |
| 🟢 | Complete |
| 🔴 | Blocked |
