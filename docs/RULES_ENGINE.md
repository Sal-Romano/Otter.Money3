# Categorization Rules Engine

## Overview

The rules engine allows households to automatically categorize transactions based on matching conditions. Rules are **household-level** (shared between both partners) and apply to all transactions in the household.

## Data Model

### CategorizationRule Schema

```prisma
model CategorizationRule {
  id          String    @id @default(cuid())
  householdId String
  household   Household @relation(fields: [householdId], references: [id])
  categoryId  String
  category    Category  @relation(fields: [categoryId], references: [id])
  conditions  Json      // RuleConditions structure
  priority    Int       @default(0)
  isEnabled   Boolean   @default(true)
  createdAt   DateTime  @default(now())
}
```

### RuleConditions Structure

The `conditions` field is a JSON object with the following TypeScript structure:

```typescript
interface RuleConditions {
  // Text matching (case-insensitive)
  merchantContains?: string;
  descriptionContains?: string;
  merchantExactly?: string;
  descriptionExactly?: string;

  // Amount matching
  amountMin?: number;
  amountMax?: number;
  amountExactly?: number;

  // Account filtering
  accountIds?: string[];      // Match only these accounts
  accountTypes?: AccountType[]; // Match only these account types

  // Owner filtering
  ownerIds?: string[];         // Match transactions from these partners' accounts

  // Combination logic (default: AND)
  operator?: 'AND' | 'OR';
}
```

## Rule Matching Logic

### Priority System

Rules are evaluated in order of **priority** (highest to lowest). The first rule that matches determines the category.

- Higher priority number = evaluated first
- Default priority: 0
- Range: -1000 to 1000

### Matching Algorithm

For each transaction:

1. Get all enabled rules for the household, ordered by priority (desc)
2. For each rule, check if ALL or ANY conditions match (based on `operator`)
3. Apply the first matching rule's category
4. Stop processing (first match wins)

### Condition Matching

#### Text Matching
- **Contains**: Case-insensitive substring match
  - `merchantContains: "starbucks"` matches "Starbucks Coffee", "STARBUCKS", etc.
- **Exactly**: Case-insensitive exact match
  - `merchantExactly: "starbucks"` matches only "Starbucks" (no extra text)

#### Amount Matching
- **Min/Max**: Inclusive range
  - `amountMin: -100, amountMax: -10` matches expenses between $10-$100
  - Remember: negative amounts = expenses, positive = income
- **Exactly**: Exact match
  - `amountExactly: -4.99` matches only $4.99 expenses

#### Account/Owner Matching
- **accountIds**: Match if transaction's accountId is in the array
- **accountTypes**: Match if transaction's account type is in the array
- **ownerIds**: Match if transaction's account ownerId is in the array

#### Operator Logic
- **AND** (default): ALL conditions must match
- **OR**: ANY condition can match

### Example Rules

```typescript
// Rule 1: Starbucks → Coffee category
{
  conditions: {
    merchantContains: "starbucks",
    operator: "AND"
  },
  categoryId: "coffee-category-id",
  priority: 10
}

// Rule 2: Amazon under $50 → Shopping, over $50 → Electronics
{
  conditions: {
    merchantContains: "amazon",
    amountMin: -50,
    amountMax: 0,
    operator: "AND"
  },
  categoryId: "shopping-category-id",
  priority: 5
}

// Rule 3: Partner A's gas purchases
{
  conditions: {
    descriptionContains: "gas",
    ownerIds: ["partner-a-id"],
    operator: "AND"
  },
  categoryId: "gas-category-id",
  priority: 8
}

// Rule 4: Any subscription (small recurring charges)
{
  conditions: {
    amountMin: -20,
    amountMax: -5,
    descriptionContains: "subscription",
    operator: "OR"
  },
  categoryId: "subscriptions-category-id",
  priority: 3
}
```

## API Endpoints

### List Rules
```
GET /api/rules
```

Returns all rules for the household with category details.

**Response:**
```json
{
  "data": [
    {
      "id": "rule123",
      "householdId": "hh123",
      "categoryId": "cat456",
      "category": {
        "id": "cat456",
        "name": "Coffee",
        "type": "EXPENSE",
        "icon": "☕",
        "color": "#8B4513"
      },
      "conditions": {
        "merchantContains": "starbucks"
      },
      "priority": 10,
      "isEnabled": true,
      "createdAt": "2025-01-27T..."
    }
  ]
}
```

### Create Rule
```
POST /api/rules
```

**Body:**
```json
{
  "categoryId": "cat456",
  "conditions": {
    "merchantContains": "starbucks",
    "operator": "AND"
  },
  "priority": 10
}
```

### Update Rule
```
PATCH /api/rules/:id
```

**Body:**
```json
{
  "conditions": {
    "merchantContains": "starbucks",
    "amountMax": -3,
    "operator": "AND"
  },
  "priority": 15,
  "isEnabled": false
}
```

### Delete Rule
```
DELETE /api/rules/:id
```

### Apply Rule Retroactively
```
POST /api/rules/:id/apply
```

Applies the rule to all existing uncategorized (or all) transactions in the household.

**Query params:**
- `force=true` - Apply to ALL transactions (not just uncategorized)

**Response:**
```json
{
  "data": {
    "message": "Rule applied to 42 transactions",
    "count": 42
  }
}
```

### Test Rule
```
POST /api/rules/test
```

Test conditions against transactions without saving the rule.

**Body:**
```json
{
  "conditions": {
    "merchantContains": "starbucks"
  }
}
```

**Response:**
```json
{
  "data": {
    "matchCount": 15,
    "sampleMatches": [
      // First 5 matching transactions
    ]
  }
}
```

## Auto-Application

### On New Transactions

Rules are automatically applied when:

1. **Plaid/SimpleFin sync** - New transactions from bank connections
2. **Manual transaction creation** - User creates a transaction without a category
3. **Transaction update** - User removes a category from a transaction

### Background Job

A background job `apply-rules` runs:
- After each transaction sync
- When a rule is created/updated
- Can be triggered manually via API

### Rule Update Behavior

When a rule is updated:
- Does NOT retroactively apply to existing transactions automatically
- User must explicitly trigger "Apply retroactively" if desired
- Prevents unexpected categorization changes

## UI Components

### Rules List Page
- List all household rules
- Show category, conditions summary, priority
- Toggle enable/disable
- Reorder by dragging (updates priority)
- Delete rule

### Create/Edit Rule Modal
- Select target category
- Build conditions:
  - Merchant contains/exactly
  - Description contains/exactly
  - Amount range or exact
  - Filter by account/owner
  - Operator (AND/OR)
- Set priority
- Preview matching transactions
- Save or test first

### "Create Rule from Transaction" Button
- On transaction detail page
- Pre-fills merchant name from transaction
- Suggests category based on transaction
- User can adjust conditions before saving

### Rule Suggestions (Future)
- Analyze uncategorized transactions
- Detect patterns (e.g., "You have 10 transactions from Starbucks")
- Suggest creating a rule with one click

## Implementation Notes

### Performance Considerations

1. **Indexing**: Add index on `householdId` and `priority` for fast rule retrieval
2. **Caching**: Cache rules per household in Redis (invalidate on rule changes)
3. **Batch Processing**: Apply rules in batches during sync (e.g., 100 transactions at a time)

### Edge Cases

1. **No matching rules**: Transaction remains uncategorized
2. **Multiple matches**: First matching rule (by priority) wins
3. **Disabled rules**: Skipped during evaluation
4. **Deleted category**: Rule becomes invalid (should be cascaded deleted)
5. **Empty conditions**: Rule never matches anything (validation should prevent)

### Validation Rules

- At least one condition must be specified
- Priority must be between -1000 and 1000
- Category must exist and belong to household (or be system)
- Account/owner IDs must be valid if specified
- Amount min must be less than or equal to amount max

## Future Enhancements

### Smart Suggestions
- ML-based pattern detection
- "You always categorize Amazon as Shopping - create a rule?"
- Learn from manual categorization patterns

### Advanced Conditions
- Date-based rules (e.g., "First of month = Rent")
- Recurring transaction detection
- Multi-merchant rules (e.g., "Starbucks OR Dunkin")
- Regex pattern matching

### Rule Templates
- Pre-built rules for common categories
- "Import rule pack" (e.g., "Common Subscriptions")
- Share rules between households (marketplace?)

### Rule Analytics
- Show how many transactions each rule has categorized
- Rule efficiency metrics
- Unused rules detection
