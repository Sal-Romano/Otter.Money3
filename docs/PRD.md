# Product Requirements Document (PRD)

## Product Overview

**Product Name:** Otter Money
**Tagline:** Your friendly financial companion

Otter Money is a personal finance management application designed with mobile-first UX. Users can connect their bank accounts via Plaid or SimpleFin Bridge, manually track large assets, categorize transactions, set budgets, and interact with an AI assistant named Wally.

---

## User Personas

### Primary: Young Professional (25-40)
- Has multiple bank accounts and credit cards
- Wants visibility into spending habits
- Saving for goals (house, vacation, emergency fund)
- Uses phone as primary device

### Secondary: Household Finance Manager
- Manages household finances
- Tracks shared accounts and large assets (home, vehicles)
- Needs to understand month-over-month trends

---

## Feature Specifications

### 1. Authentication

#### 1.1 Login
- Email/password authentication
- "Remember me" functionality
- Password reset via email

#### 1.2 Account Creation
- Email, password, name fields
- Email verification
- Terms of service acceptance

#### 1.3 Session Management
- JWT-based sessions
- Automatic token refresh
- Secure logout

---

### 2. Dashboard

The dashboard is the home screen providing an at-a-glance view of financial health.

#### 2.1 Net Worth Chart
- Line chart showing net worth over time
- Configurable time range (1M, 3M, 6M, 1Y, All)
- Breakdown by account type (assets vs liabilities)

#### 2.2 Transactions Preview
- Last 5-10 transactions
- Quick categorization if uncategorized
- "View all" link to Transactions page

#### 2.3 Spending Preview
- Month-over-month comparison
- Category breakdown (pie/bar chart)
- Current month vs previous month delta

#### 2.4 Recurring Payments Preview
- Upcoming bills/subscriptions
- Next 7-14 days
- Amount and due date

#### 2.5 Investments Performance Preview
- Total investment value
- Gain/loss ($ and %)
- Top holdings summary

#### 2.6 Goals Progress Preview
- Active goals with progress bars
- Projected completion date
- Quick add funds action

---

### 3. Transactions

#### 3.1 Transaction List
- Filterable by date, account, category, amount
- Searchable by merchant/description
- Infinite scroll with date grouping
- Pull-to-refresh on mobile

#### 3.2 Transaction Details
- Date, amount, merchant, account
- Category (editable)
- Notes field
- Split transaction support
- Attachments (receipts)

#### 3.3 Categorization
- Assign category to transaction
- Create categorization rules:
  - "If merchant contains X, categorize as Y"
  - "If amount > X from account Y, categorize as Z"
- Apply rules retroactively option

#### 3.4 Manual Transactions

> **Open Question:** How should manual transactions affect balances for Plaid/SimpleFin managed accounts?

**Proposed Solution:**
- **Option A (Recommended):** Manual transactions on synced accounts are tracked separately as "adjustments" and don't affect the synced balance. They appear in transaction lists and reports but the account balance always reflects the bank's reported balance.
- **Option B:** Manual transactions adjust a "local balance" that can differ from the "synced balance". Show both balances.
- **Option C:** Don't allow manual transactions on synced accounts—only on manually tracked accounts.

**For manually tracked accounts:**
- Manual transactions directly update the account balance
- Support income, expense, and transfer transaction types

---

### 4. Accounts

#### 4.1 Account List
- Grouped by type: Checking, Savings, Credit, Investment, Loan, Asset
- Show current balance and last sync time
- Connection status indicator

#### 4.2 Connected Accounts (Plaid/SimpleFin)
- View connection status
- Refresh connection
- Reconnect if expired
- Remove account

#### 4.3 Manual Accounts
- Add account with name, type, initial balance
- Edit balance (creates adjustment transaction)
- Track assets like:
  - Real estate (home value)
  - Vehicles
  - Valuables
  - Cash

#### 4.4 Balance Edit UX (Manual Accounts)
- Enter new balance
- System calculates difference
- Auto-creates adjustment transaction
- Transaction shows "Balance adjusted from $X to $Y"

---

### 5. Budget

#### 5.1 Budget Setup
- Set monthly spending limits by category
- Rollover unused budget option
- Copy from previous month

#### 5.2 Budget Tracking
- Progress bar per category
- Spent vs budgeted
- Days remaining in month
- Projected end-of-month spend

#### 5.3 Alerts
- Notification when approaching limit (80%)
- Notification when exceeded
- Weekly summary option

---

### 6. Settings

#### 6.1 Category Management
- Default categories provided:
  - Income: Salary, Freelance, Interest, Dividends, Other
  - Expenses: Housing, Transportation, Food & Dining, Shopping, Entertainment, Healthcare, Utilities, Subscriptions, Travel, Education, Personal Care, Gifts, Other
  - Transfers: Transfer, Credit Card Payment
- Create custom categories
- Edit/rename categories
- Merge categories
- Set category icons/colors

#### 6.2 Account Settings
- Rename accounts
- Set account display order
- Hide accounts from net worth
- Exclude accounts from budget

#### 6.3 Profile Settings
- Update name, email, password
- Notification preferences
- Data export (CSV/JSON)
- Delete account

---

### 7. Wally AI Assistant

Wally is an otter-themed AI assistant powered by Claude that has full context of the user's financial data.

#### 7.1 Capabilities
- Answer questions about spending ("How much did I spend on food last month?")
- Provide insights ("You spent 20% more on dining out this month")
- Suggest optimizations ("You have 3 similar subscriptions")
- Help with budgeting ("Based on your income, here's a suggested budget")
- Explain transactions ("What was this $47.99 charge?")

#### 7.2 UX
- Chat interface accessible from any screen
- Floating action button (FAB) on mobile
- Text input with suggested prompts
- Rich responses with charts/tables when appropriate

#### 7.3 Data Access
- Read access to all user financial data
- Cannot modify data directly
- Suggestions require user confirmation

---

## Integration Specifications

### Plaid Integration
- **Products:** Transactions, Auth, Balance, Investments, Liabilities
- **Environments:** Sandbox (dev), Production
- **Webhook Events:**
  - TRANSACTIONS_SYNC
  - ITEM_LOGIN_REQUIRED
  - INVESTMENTS_TRANSACTIONS_UPDATE
- **Link Flow:** Embedded in-app

### SimpleFin Bridge Integration
- Alternative to Plaid for institutions not covered
- Token-based authentication
- Manual refresh support
- Webhook support if available

---

## Non-Functional Requirements

### Performance
- Dashboard load < 2 seconds
- Transaction list scroll smooth at 60fps
- Sync operations background with progress indicator

### Security
- All data encrypted at rest and in transit
- No plaintext credential storage
- Session timeout after inactivity
- Rate limiting on authentication endpoints

### Accessibility
- WCAG 2.1 AA compliance
- Screen reader support
- High contrast mode support

---

## Success Metrics

- User can connect first account within 5 minutes
- 80% of transactions auto-categorized correctly
- Daily active users check dashboard at least 3x/week
- Budget feature adoption > 60% of users

---

## Open Questions

1. **Manual transactions on synced accounts** - See section 3.4
2. **Multi-currency support** - V1 or future?
3. **Shared household access** - Multiple users per household?
4. **Investment tracking depth** - Just balances or full holdings/lots?
5. **Bill detection** - Auto-detect recurring transactions?
