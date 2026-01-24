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
- [ ] Set up monorepo structure (apps/web, apps/api, packages/shared)
- [ ] Configure TypeScript, ESLint, Prettier
- [ ] Set up Vite + React for frontend
- [ ] Set up Tailwind CSS with brand colors (`#9F6FBA` purple, white)
- [ ] Create basic project scaffolding
- [ ] Set up Docker Compose (PostgreSQL + Redis)
- [ ] Configure environment variables structure (.env.example)
- [ ] Set up Prisma with initial schema (Household, User models)
- [ ] Create initial database migration
- [ ] Set up Capacitor for iOS/Android

### Deliverables
- Running dev environment with hot reload
- Empty app shell that builds successfully
- Database ready with household/user tables
- Capacitor configured for mobile builds

---

## Sprint 1: Authentication & Household Setup
**Status:** ⚪ Not Started
**Goal:** Users can create households, invite partners, and log in

### Tasks
- [ ] Implement user registration API (creates user + household)
- [ ] Implement household invite code generation
- [ ] Implement "join household" registration flow
- [ ] Implement login/logout API
- [ ] Implement JWT authentication middleware
- [ ] Create auth context on frontend
- [ ] Build login page (mobile-first, purple theme)
- [ ] Build registration page (create household flow)
- [ ] Build "join household" page (with invite code)
- [ ] Build password reset flow
- [ ] Create app layout with bottom navigation
- [ ] Implement protected routes
- [ ] Build household settings page (view partner, invite link)

### Deliverables
- Partner A can create account + household
- Partner A can share invite link
- Partner B can join household via invite
- Both partners can log in independently

---

## Sprint 2: Manual Accounts & Dashboard Foundation
**Status:** ⚪ Not Started
**Goal:** Partners can add manual accounts and see basic dashboard

### Tasks
- [ ] Implement accounts API (CRUD, scoped to household)
- [ ] Add account ownership (which partner or "joint")
- [ ] Build accounts list page with partner indicators
- [ ] Build add/edit account modal (select owner)
- [ ] Implement balance update with adjustment transactions
- [ ] Build basic dashboard layout
- [ ] Implement household net worth calculation
- [ ] Build net worth chart component
- [ ] Show partner breakdown on net worth
- [ ] Create account type icons/styling

### Deliverables
- Either partner can add manual accounts
- Accounts show which partner owns them
- Dashboard shows combined household net worth
- Balance updates create adjustment transactions

---

## Sprint 3: Manual Transactions & Categories
**Status:** ⚪ Not Started
**Goal:** Partners can manually track transactions with shared categories

### Tasks
- [ ] Implement transactions API (CRUD, scoped to household)
- [ ] Implement categories API with default categories (household-level)
- [ ] Build transactions list page with filters
- [ ] Add partner filter to transaction list
- [ ] Show which partner's account each transaction belongs to
- [ ] Build add/edit transaction modal
- [ ] Build category selector component
- [ ] Build category management in settings (shared for household)
- [ ] Implement transaction search
- [ ] Add transactions preview to dashboard

### Deliverables
- Either partner can add transactions to any account
- Either partner can categorize any transaction
- Categories are shared across the household
- Transaction list shows partner ownership

---

## Sprint 4: Plaid Integration
**Status:** ⚪ Not Started
**Goal:** Each partner can connect their own bank accounts via Plaid

### Tasks
- [ ] Set up Plaid client and configuration
- [ ] Implement Plaid Link token generation (per user)
- [ ] Implement public token exchange
- [ ] Build Plaid Link integration in frontend
- [ ] Associate Plaid items with the connecting user
- [ ] Auto-assign account ownership to connecting partner
- [ ] Implement transaction sync (initial)
- [ ] Implement webhook handlers
- [ ] Handle connection status and re-authentication
- [ ] Map Plaid categories to household categories
- [ ] Update dashboard for connected accounts

### Deliverables
- Each partner connects their own banks
- Accounts automatically owned by connecting partner
- Transactions sync and appear in household view
- Both partners see all accounts/transactions

---

## Sprint 5: Categorization Rules Engine
**Status:** ⚪ Not Started
**Goal:** Automatic transaction categorization with household-shared rules

### Tasks
- [ ] Design rules engine data model (household-level)
- [ ] Implement rules API (CRUD)
- [ ] Build rules management UI
- [ ] Implement rule matching logic
- [ ] Auto-apply rules on new transactions (all household transactions)
- [ ] Build "create rule from transaction" UX
- [ ] Implement retroactive rule application
- [ ] Add rule suggestions based on patterns

### Deliverables
- Either partner can create categorization rules
- Rules apply to all household transactions
- New transactions auto-categorized

---

## Sprint 6: Budgeting
**Status:** ⚪ Not Started
**Goal:** Partners can set and track household budgets together

### Tasks
- [ ] Implement budget API (CRUD, household-level)
- [ ] Build budget setup page
- [ ] Build budget tracking view
- [ ] Calculate household spending per category
- [ ] Show spending breakdown by partner ("You: $X, Partner: $Y")
- [ ] Build progress bar components
- [ ] Add budget status to dashboard
- [ ] Implement budget alerts (approaching/exceeded)
- [ ] Add copy budget from previous month

### Deliverables
- Household-level budgets (not per-partner)
- Both partners' spending counts toward budget
- Visual breakdown of who spent what

---

## Sprint 7: Spending Analytics
**Status:** ⚪ Not Started
**Goal:** Rich spending insights for the household

### Tasks
- [ ] Build spending breakdown chart (pie/donut)
- [ ] Implement month-over-month comparison
- [ ] Build spending trends view
- [ ] Add partner filter/comparison toggle
- [ ] Add category drill-down
- [ ] Implement spending insights calculations
- [ ] Update dashboard spending preview
- [ ] Add date range selector

### Deliverables
- Household spending by category
- Compare spending across months
- Filter or compare by partner

---

## Sprint 8: Recurring Transactions
**Status:** ⚪ Not Started
**Goal:** Detect and display recurring payments/subscriptions

### Tasks
- [ ] Implement recurring transaction detection algorithm
- [ ] Build recurring transactions API
- [ ] Build recurring payments list view
- [ ] Show which partner's account for each recurring payment
- [ ] Add upcoming bills preview to dashboard
- [ ] Implement manual recurring transaction tagging
- [ ] Add expected amount tracking
- [ ] Build subscription management view

### Deliverables
- Auto-detect recurring transactions
- Dashboard shows upcoming household bills
- Clear indicator of which account/partner

---

## Sprint 9: Goals
**Status:** ⚪ Not Started
**Goal:** Partners can set and track shared savings goals

### Tasks
- [ ] Implement goals API (CRUD, household-level)
- [ ] Build goals list page
- [ ] Build add/edit goal modal
- [ ] Implement progress tracking
- [ ] Build goal progress visualization
- [ ] Add "add funds" action
- [ ] Calculate projected completion date
- [ ] Add goals preview to dashboard

### Deliverables
- Shared household goals
- Track progress together
- Dashboard shows goal progress

---

## Sprint 10: SimpleFin Integration
**Status:** ⚪ Not Started
**Goal:** Alternative bank connection for institutions not on Plaid

### Tasks
- [ ] Research SimpleFin Bridge API
- [ ] Implement SimpleFin authentication flow (one per household)
- [ ] Implement account fetching
- [ ] Allow manual assignment of account ownership
- [ ] Implement transaction syncing
- [ ] Handle SimpleFin-specific edge cases
- [ ] Add SimpleFin as connection option in UI
- [ ] Test with various institutions

### Deliverables
- Household can connect one SimpleFin account
- Transactions sync from SimpleFin
- Account ownership manually assigned

---

## Sprint 11: Wally AI Assistant
**Status:** ⚪ Not Started
**Goal:** Partners can chat with Wally about household finances

### Tasks
- [ ] Design Wally's personality and system prompt (couples-aware)
- [ ] Implement Claude API integration
- [ ] Build household financial data context aggregation
- [ ] Implement chat API endpoints
- [ ] Build chat UI component
- [ ] Add floating action button (mobile)
- [ ] Implement conversation history (household-level)
- [ ] Add suggested prompts ("How much did we spend on...")
- [ ] Build rich response rendering (charts, tables)
- [ ] Train on "we/us/our" and partner name references

### Deliverables
- Chat with Wally about household finances
- Wally understands "we" and partner names
- Conversations shared across household

---

## Sprint 12: Investments (Basic)
**Status:** ⚪ Not Started
**Goal:** Basic investment tracking and performance

### Tasks
- [ ] Enable Plaid Investments product
- [ ] Fetch investment holdings
- [ ] Display investment accounts with partner ownership
- [ ] Calculate total household investment value
- [ ] Show basic gain/loss
- [ ] Add investments preview to dashboard

### Deliverables
- See investment account values per partner
- Dashboard shows combined investment performance

---

## Sprint 13: Polish & Performance
**Status:** ⚪ Not Started
**Goal:** Production-ready quality and performance

### Tasks
- [ ] Performance audit and optimization
- [ ] Accessibility audit (WCAG 2.1 AA)
- [ ] Color contrast verification (purple theme)
- [ ] Error handling improvements
- [ ] Loading states and skeletons
- [ ] Empty states design
- [ ] Onboarding flow for new households
- [ ] Data export functionality
- [ ] Mobile gesture refinements
- [ ] Capacitor native testing (iOS/Android)
- [ ] Cross-browser testing

### Deliverables
- App performs well on mobile
- All features accessible
- Polished user experience
- iOS/Android apps working via Capacitor

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
- [ ] Submit iOS app to App Store
- [ ] Submit Android app to Play Store

### Deliverables
- Web app live at app.otter.money
- iOS app in App Store
- Android app in Play Store
- Monitoring and alerting active

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

### Advanced Household Features
- More than 2 members (family mode?)
- Permission levels (view-only partner?)
- Activity feed ("Partner categorized a transaction")

### Advanced Reporting
- Custom date range reports
- Tax-related categorization
- Year-end summaries
- Export to tax software

### Native Features (Capacitor)
- Push notifications for budget alerts
- Biometric authentication (Face ID/Touch ID)
- Offline support
- Widgets (iOS/Android)

---

## Sprint Status Legend

| Icon | Status |
|------|--------|
| ⚪ | Not Started |
| 🟡 | In Progress |
| 🟢 | Complete |
| 🔴 | Blocked |
