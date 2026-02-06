# Sprint Roadmap

## Overview

Development is organized into sprints, each delivering a working increment of the product. Each sprint builds on the previous, with the goal of having a usable (if minimal) product as early as possible.

**Sprint Duration:** Flexible (tracked by completion, not time)
**Definition of Done:** Feature complete, tested, documented

---

## Sprint 0: Project Foundation
**Status:** 🟢 Complete
**Goal:** Project setup and infrastructure

### Tasks
- [x] Create project documentation (PRD, Architecture, Sprints)
- [x] Initialize git repository
- [x] Set up monorepo structure (apps/web, apps/api, packages/shared)
- [x] Configure TypeScript, ESLint, Prettier
- [x] Set up Vite + React for frontend
- [x] Set up Tailwind CSS with brand colors (`#9F6FBA` purple, white)
- [x] Create basic project scaffolding
- [x] Set up Docker Compose (Redis for dev, Dockerfiles for prod)
- [x] Configure environment variables structure (.env.example)
- [x] Set up Prisma with initial schema (Household, User, Account, Transaction, etc.)
- [x] Create seed file for default categories
- [x] Set up Capacitor for iOS/Android

### Deliverables
- Running dev environment with hot reload
- Empty app shell that builds successfully
- Database schema ready with all models
- Capacitor configured for mobile builds

---

## Sprint 1: Authentication & Household Setup
**Status:** 🟢 Complete
**Goal:** Users can create households, invite partners, and log in

### Tasks
- [x] Implement user registration API (creates user + household)
- [x] Implement household invite code generation
- [x] Implement "join household" registration flow
- [x] Implement login/logout API
- [x] Implement JWT authentication middleware
- [x] Create auth context on frontend (Zustand store)
- [x] Build login page (mobile-first, purple theme)
- [x] Build registration page (create household flow)
- [x] Build "join household" page (with invite code)
- [x] Build password reset flow
- [x] Create app layout with bottom navigation
- [x] Implement protected routes
- [x] Build household settings page (view partner, invite link)

### Deliverables
- Partner A can create account + household
- Partner A can share invite link
- Partner B can join household via invite
- Both partners can log in independently

---

## Sprint 2: Manual Accounts & Dashboard Foundation
**Status:** 🟢 Complete
**Goal:** Partners can add manual accounts and see basic dashboard

### Tasks
- [x] Implement accounts API (CRUD, scoped to household)
- [x] Add account ownership (which partner or "joint")
- [x] Build accounts list page with partner indicators
- [x] Build add/edit account modal (select owner)
- [x] Implement balance update with adjustment transactions
- [x] Build basic dashboard layout
- [x] Implement household net worth calculation
- [x] Build net worth chart component
- [x] Show partner breakdown on net worth
- [x] Create account type icons/styling

### Deliverables
- Either partner can add manual accounts
- Accounts show which partner owns them
- Dashboard shows combined household net worth
- Balance updates create adjustment transactions

---

## Sprint 3: Manual Transactions & Categories
**Status:** 🟢 Complete
**Goal:** Partners can manually track transactions with shared categories

### Tasks
- [x] Implement transactions API (CRUD, scoped to household)
- [x] Implement categories API with default categories (household-level)
- [x] Build transactions list page with filters
- [x] Add partner filter to transaction list
- [x] Show which partner's account each transaction belongs to
- [x] Build add/edit transaction modal
- [x] Build category selector component
- [x] Build category management in settings (shared for household)
- [x] Implement transaction search
- [x] Add transactions preview to dashboard

### Deliverables
- Either partner can add transactions to any account
- Either partner can categorize any transaction
- Categories are shared across the household
- Transaction list shows partner ownership

---

## Sprint 4: Plaid Integration
**Status:** 🟢 Complete
**Goal:** Each partner can connect their own bank accounts via Plaid

### Tasks
- [x] Set up Plaid client and configuration
- [x] Implement Plaid Link token generation (per user)
- [x] Implement public token exchange
- [x] Build Plaid Link integration in frontend
- [x] Associate Plaid items with the connecting user
- [x] Auto-assign account ownership to connecting partner
- [x] Implement transaction sync (initial)
- [x] Implement webhook handlers (INITIAL_UPDATE, SYNC_UPDATES_AVAILABLE)
- [x] Add manual refresh button for on-demand syncing
- [x] Handle connection status and re-authentication
- [x] Map Plaid categories to household categories
- [x] Update dashboard for connected accounts

### Deliverables
- Each partner connects their own banks
- Accounts automatically owned by connecting partner
- Transactions sync automatically via webhooks
- Manual refresh button for on-demand syncing
- Both partners see all accounts/transactions

---

## Sprint 5: Categorization Rules Engine
**Status:** 🟢 Complete
**Goal:** Automatic transaction categorization with household-shared rules

### Tasks
- [x] Design rules engine data model (household-level)
- [x] Implement rules API (CRUD)
- [x] Build rules management UI
- [x] Implement rule matching logic
- [x] Auto-apply rules on new transactions (all household transactions)
- [x] Build "create rule from transaction" UX
- [x] Implement retroactive rule application
- [ ] Add rule suggestions based on patterns (future enhancement)

### Deliverables
- Either partner can create categorization rules
- Rules apply to all household transactions
- New transactions auto-categorized
- "Create rule from transaction" button in transaction modal
- Rules management page with priority control
- Test rule before saving
- Apply rules retroactively to existing transactions

---

## Sprint 6: Budgeting
**Status:** 🟢 Complete
**Goal:** Partners can set and track household budgets together

### Tasks
- [x] Implement budget API (CRUD, household-level)
- [x] Build budget setup page
- [x] Build budget tracking view
- [x] Calculate household spending per category
- [x] Show spending breakdown by partner ("You: $X, Partner: $Y")
- [x] Build progress bar components
- [x] Add budget status to dashboard
- [x] Implement budget alerts (approaching/exceeded)
- [x] Add copy budget from previous month

### Deliverables
- Household-level budgets (not per-partner)
- Both partners' spending counts toward budget
- Visual breakdown of who spent what

---

## Sprint 7: Spending Analytics
**Status:** 🟢 Complete
**Goal:** Rich spending insights for the household

### Tasks
- [x] Build spending breakdown chart (pie/donut)
- [x] Implement month-over-month comparison
- [x] Build spending trends view
- [x] Add partner filter/comparison toggle
- [x] Add category drill-down
- [x] Implement spending insights calculations
- [x] Update dashboard spending preview
- [x] Add date range selector

### Deliverables
- Household spending by category
- Compare spending across months
- Filter or compare by partner

---

## Sprint 8: Recurring Transactions
**Status:** 🟢 Complete
**Goal:** Detect and display recurring payments/subscriptions

### Tasks
- [x] Implement recurring transaction detection algorithm
- [x] Build recurring transactions API
- [x] Build recurring payments list view
- [x] Show which partner's account for each recurring payment
- [x] Add upcoming bills preview to dashboard
- [x] Implement manual recurring transaction tagging
- [x] Add expected amount tracking
- [x] Build subscription management view

### Deliverables
- Auto-detect recurring transactions
- Dashboard shows upcoming household bills
- Clear indicator of which account/partner

---

## Sprint 9: Goals
**Status:** 🟢 Complete
**Goal:** Partners can set and track shared savings goals

### Tasks
- [x] Implement goals API (CRUD, household-level)
- [x] Build goals list page
- [x] Build add/edit goal modal
- [x] Implement progress tracking
- [x] Build goal progress visualization
- [x] Add "add funds" action
- [x] Calculate projected completion date
- [x] Add goals preview to dashboard

### Deliverables
- Shared household goals
- Track progress together
- Dashboard shows goal progress

---

## Sprint 9.5: Desktop UX Redux
**Status:** 🟢 Complete
**Goal:** Improve desktop layout with sidebar navigation and constrained content

### Tasks
- [x] Add desktop left sidebar navigation (md: breakpoint)
- [x] Add desktop right pane placeholder (Wally AI future)
- [x] Constrain main content width on desktop (max-w-2xl)
- [x] Keep mobile bottom navigation unchanged
- [x] Adjust Wally FAB for desktop layout
- [x] Update ARCHITECTURE.md with responsive design section

### Deliverables
- Three-column desktop layout (sidebar / content / placeholder)
- Mobile layout unchanged (bottom nav)
- Documented responsive design patterns

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
