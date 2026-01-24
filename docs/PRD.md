# Product Requirements Document (PRD)

## Product Overview

**Product Name:** Otter Money
**Tagline:** Manage your money together

Otter Money is a **couples-focused** personal finance app designed for partners to manage their household finances together. Each partner has their own login but shares a unified view of the household's accounts, transactions, budgets, and goals.

**Brand Colors:**
- Primary: Purple `#9F6FBA` / `rgb(159, 111, 186)`
- Secondary: White `#FFFFFF`

---

## Core Concept: The Household Model

The app is built around the concept of a **Household** - a shared financial unit for a couple.

### Key Principles

1. **One Household, Two Users** - A household has exactly two members (partners)
2. **Shared Financial Picture** - All accounts, transactions, and budgets belong to the household
3. **Individual Ownership** - Each account is "owned by" a specific partner for clarity
4. **Individual Actions** - Each partner logs in separately and can categorize/manage transactions
5. **Shared Visibility** - Both partners see everything; no hidden accounts or transactions

### Data Model Summary

```
Household
├── Member 1 (User)
│   ├── Plaid Connection(s)
│   └── Owns: Checking, Credit Card, etc.
├── Member 2 (User)
│   ├── Plaid Connection(s)
│   └── Owns: Savings, Investment, etc.
├── SimpleFin Connection (one per household)
├── Shared Categories & Rules
├── Shared Budgets
└── Shared Goals
```

---

## User Personas

### Primary: Young Couple (25-40)
- Recently moved in together or married
- Combining finances for the first time
- Want visibility into household spending
- Need to coordinate on budgets and goals

### Secondary: Established Couple
- Have been managing money together for years
- Multiple accounts across both partners
- Want better tools than spreadsheets
- Care about long-term goals (house, retirement)

---

## Feature Specifications

### 1. Authentication & Onboarding

#### 1.1 Create Household Flow
1. First partner signs up (email, password, name)
2. Creates household (household name optional, defaults to "[Name]'s Household")
3. Receives invite link/code to share with partner
4. Partner signs up using invite link
5. Both partners now have access to the household

#### 1.2 Login
- Email/password authentication
- "Remember me" functionality
- Password reset via email
- Each partner logs in independently

#### 1.3 Join Existing Household
- Enter invite code OR click invite link
- Create account (email, password, name)
- Automatically joined to household

#### 1.4 Session Management
- JWT-based sessions
- Each partner has independent sessions
- Secure logout

---

### 2. Dashboard

The dashboard shows the **household's** combined financial picture.

#### 2.1 Net Worth Chart
- Combined net worth of all household accounts
- Line chart over time (1M, 3M, 6M, 1Y, All)
- Option to see breakdown by partner

#### 2.2 Transactions Preview
- Last 5-10 transactions across all accounts
- Shows which partner's account
- Quick categorization if uncategorized
- "View all" link

#### 2.3 Spending Preview
- Combined household spending
- Month-over-month comparison
- Category breakdown (pie/bar chart)
- Option to filter by partner

#### 2.4 Recurring Payments Preview
- All upcoming household bills
- Shows which account/partner
- Next 7-14 days

#### 2.5 Investments Performance Preview
- Combined investment value
- Total gain/loss
- Summary across both partners

#### 2.6 Goals Progress Preview
- Shared household goals
- Progress bars
- Quick add funds action

---

### 3. Transactions

#### 3.1 Transaction List
- All transactions from all household accounts
- Filter by: date, account, category, partner, amount
- Search by merchant/description
- Visual indicator of which partner's account

#### 3.2 Transaction Details
- Date, amount, merchant, account
- Which partner owns the account
- Category (editable by either partner)
- Notes field
- Split transaction support
- Attachments (receipts)

#### 3.3 Categorization
- Shared category system across household
- Create categorization rules (shared)
- Rules apply to all household transactions
- Either partner can categorize any transaction

#### 3.4 Manual Transactions

**For synced accounts (Plaid/SimpleFin):**
- Manual transactions tracked as "adjustments"
- Don't affect synced balance
- Appear in transaction lists and reports
- Marked with indicator that they're manual

**For manually tracked accounts:**
- Manual transactions directly update balance
- Support income, expense, transfer types

---

### 4. Accounts

#### 4.1 Account List
- All household accounts
- Grouped by type: Checking, Savings, Credit, Investment, Loan, Asset
- Shows owner (which partner)
- Balance and last sync time
- Connection status

#### 4.2 Adding Connected Accounts

**Plaid (multiple per partner):**
- Each partner connects their own banks
- Partner A's bank connections are "owned by" Partner A
- No limit on number of Plaid connections per partner

**SimpleFin (one per household):**
- Single SimpleFin connection for the household
- Typically used for institutions not supported by Plaid
- Either partner can set up/manage

#### 4.3 Manual Accounts
- Add account with name, type, owner, initial balance
- Edit balance (creates adjustment transaction)
- Track assets like:
  - Real estate (home value) - typically "joint"
  - Vehicles
  - Valuables

#### 4.4 Account Ownership
- Each account has an "owner": Partner A, Partner B, or "Joint"
- Joint accounts appear with both partners' indicator
- Owner is for display/organization; both can manage

---

### 5. Budget

#### 5.1 Budget Setup
- Household-level budgets (not per-partner)
- Set monthly limits by category
- Spending from either partner counts toward budget

#### 5.2 Budget Tracking
- Progress bar per category
- Spent vs budgeted
- Shows contribution from each partner
- "Partner A spent $X, Partner B spent $Y"

#### 5.3 Insights
- "You've both spent $X on dining this month"
- Alerts when approaching/exceeding limits
- Week-over-week trends

---

### 6. Settings

#### 6.1 Household Settings
- Household name
- Manage members (view partner info)
- Leave household (with confirmation)

#### 6.2 Category Management
- Shared categories for the household
- Default categories provided
- Create/edit/merge custom categories
- Both partners share the same category list

#### 6.3 Profile Settings (per partner)
- Update name, email, password
- Notification preferences
- Avatar/profile picture

#### 6.4 Data & Privacy
- Export household data (CSV/JSON)
- Delete account (with household implications)

---

### 7. Wally AI Assistant

Wally is an otter-themed AI assistant with full context of the **household's** finances.

#### 7.1 Capabilities
- "How much did we spend on groceries last month?"
- "What's our net worth trend looking like?"
- "Did [partner] already pay the electric bill?"
- "We're over budget on dining - what should we cut?"
- "What are our biggest expenses as a couple?"

#### 7.2 UX
- Chat interface accessible from any screen
- Floating action button (FAB) on mobile
- Understands "we/us/our" context
- Can reference either partner by name

#### 7.3 Personality
- Friendly, helpful otter
- Uses "you two" and "your household"
- Encouraging about financial progress
- Non-judgmental about spending

---

## Integration Specifications

### Plaid Integration
- **Multiple connections per partner** - Each partner connects their own banks
- **Products:** Transactions, Auth, Balance, Investments, Liabilities
- **Account ownership:** Accounts from Partner A's Plaid connection are owned by Partner A

### SimpleFin Bridge Integration
- **One connection per household**
- Used for institutions not covered by Plaid
- Either partner can manage the connection
- Account ownership assigned manually after connection

---

## UX Principles

### Mobile-First
- Primary design target: iPhone/Android
- Touch-friendly interactions
- Bottom navigation for primary actions
- Pull-to-refresh patterns

### Partner Indicators
- Color coding or avatars to show "whose" account/transaction
- Consistent visual language throughout
- Never hidden - transparency is key

### Shared Context
- Always clear that data is household-level
- Use "household" or couple-friendly language
- "Your household spent..." not "You spent..."

---

## Non-Functional Requirements

### Performance
- Dashboard load < 2 seconds
- Smooth scrolling at 60fps
- Background sync with progress indicator

### Security
- All data encrypted at rest and in transit
- Partners cannot access each other's login credentials
- Session isolation between partners

### Accessibility
- WCAG 2.1 AA compliance
- Screen reader support
- Color contrast meets standards (especially with purple theme)

---

## Open Questions

1. **Household dissolution** - What happens if partners split up? Data export? Account transfer?
2. **More than 2 members?** - Roommates? Family? Keep it couples-only for V1?
3. **Permission levels** - Should one partner be "admin"? Or equal access?
4. **Investment tracking depth** - Just balances or full holdings?
5. **Notification preferences** - Per-partner or household-level?
