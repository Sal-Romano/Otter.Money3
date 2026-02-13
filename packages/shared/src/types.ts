// ============================================
// HOUSEHOLD & USERS
// ============================================

export type HouseholdRole = 'ORGANIZER' | 'PARTNER';

export interface Household {
  id: string;
  name: string | null;
  inviteCode: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  emailVerified: boolean;
  householdId: string | null;
  householdRole: HouseholdRole;
  createdAt: Date;
  updatedAt: Date;
}

export interface HouseholdMember extends User {
  isCurrentUser: boolean;
}

// ============================================
// ACCOUNTS
// ============================================

export type AccountType =
  | 'CHECKING'
  | 'SAVINGS'
  | 'CREDIT'
  | 'INVESTMENT'
  | 'LOAN'
  | 'MORTGAGE'
  | 'ASSET'
  | 'OTHER';

export type ConnectionType = 'PLAID' | 'SIMPLEFIN' | 'MANUAL';

export type ConnectionStatus = 'ACTIVE' | 'REQUIRES_REAUTH' | 'DISCONNECTED' | 'ERROR';

export interface Account {
  id: string;
  householdId: string;
  ownerId: string | null; // null = joint
  name: string;
  type: AccountType;
  subtype: string | null;
  connectionType: ConnectionType;
  connectionStatus: ConnectionStatus;
  plaidItemId: string | null;
  lastSyncedAt: Date | null;
  currentBalance: number;
  availableBalance: number | null;
  currency: string;
  isHidden: boolean;
  excludeFromBudget: boolean;
  excludeFromNetWorth: boolean;
  displayOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface AccountWithOwner extends Account {
  owner: Pick<User, 'id' | 'name' | 'avatarUrl'> | null;
}

// ============================================
// TRANSACTIONS
// ============================================

export interface Transaction {
  id: string;
  accountId: string;
  externalId: string | null;
  date: Date;
  amount: number; // Negative = expense
  currency: string;
  merchantName: string | null;
  description: string;
  categoryId: string | null;
  isManual: boolean;
  isAdjustment: boolean;
  isPending: boolean;
  notes: string | null;
  parentId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface TransactionWithDetails extends Transaction {
  account: Pick<Account, 'id' | 'name' | 'type' | 'ownerId'>;
  category: Pick<Category, 'id' | 'name' | 'type' | 'icon' | 'color'> | null;
}

// ============================================
// CATEGORIES
// ============================================

export type CategoryType = 'INCOME' | 'EXPENSE' | 'TRANSFER';

export interface Category {
  id: string;
  householdId: string | null; // null = system default
  name: string;
  type: CategoryType;
  icon: string | null;
  color: string | null;
  parentId: string | null;
  depth: number;        // 0=root, 1=child, 2=grandchild (max 3 levels)
  displayOrder: number; // Sort order within siblings
  isSystem: boolean;
}

// Category with nested children for tree structure
export interface CategoryTreeNode extends Category {
  children: CategoryTreeNode[];
  transactionCount?: number;
}

// Category with full path for display
export interface CategoryWithPath extends Category {
  path: string[];       // e.g., ["Travel", "Flights"]
  fullName: string;     // e.g., "Travel > Flights"
}

// Category with transaction count (from API)
export interface CategoryWithCount extends Category {
  transactionCount: number;
}

// ============================================
// BUDGETS
// ============================================

export interface Budget {
  id: string;
  householdId: string;
  categoryId: string;
  amount: number;
  period: string; // "2024-01" format
  rollover: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface BudgetWithSpending extends Budget {
  category: Pick<Category, 'id' | 'name' | 'icon' | 'color'>;
  spent: number;
  spentByPartner: Record<string, number>; // userId -> amount
}

// ============================================
// GOALS
// ============================================

export interface Goal {
  id: string;
  householdId: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  targetDate: Date | null;
  icon: string | null;
  color: string | null;
  isCompleted: boolean;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// RULES
// ============================================

export interface RuleConditions {
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
  accountIds?: string[];
  accountTypes?: AccountType[];

  // Owner filtering
  ownerIds?: string[];

  // Combination logic (default: AND)
  operator?: 'AND' | 'OR';
}

export interface CategorizationRule {
  id: string;
  householdId: string;
  categoryId: string;
  conditions: RuleConditions;
  priority: number;
  isEnabled: boolean;
  createdAt: Date;
}

export interface CategorizationRuleWithCategory extends CategorizationRule {
  category: Pick<Category, 'id' | 'name' | 'type' | 'icon' | 'color'>;
}

// ============================================
// API TYPES
// ============================================

export interface ApiResponse<T> {
  data: T;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
  };
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

// Auth
export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
  householdName?: string;
}

export interface JoinHouseholdRequest {
  email: string;
  password: string;
  name: string;
  inviteCode: string;
}

export interface AuthResponse {
  user: User;
  household: Household | null;
  accessToken: string;
}

// Dashboard
export interface DashboardSummary {
  netWorth: number;
  netWorthChange: number;
  netWorthChangePercent: number;
  totalAssets: number;
  totalLiabilities: number;
  recentTransactions: TransactionWithDetails[];
  upcomingBills: TransactionWithDetails[];
  budgetStatus: BudgetWithSpending[];
  goals: Goal[];
}

export interface NetWorthDataPoint {
  date: string;
  total: number;
  assets: number;
  liabilities: number;
  byPartner?: Record<string, number>;
}

export interface SpendingByCategory {
  categoryId: string;
  categoryName: string;
  categoryColor: string | null;
  amount: number;
  byPartner: Record<string, number>;
  percentOfTotal: number;
}

// ============================================
// RECURRING TRANSACTIONS
// ============================================

export type RecurringFrequency =
  | 'WEEKLY'
  | 'BIWEEKLY'
  | 'MONTHLY'
  | 'QUARTERLY'
  | 'SEMIANNUAL'
  | 'ANNUAL';

export type RecurringStatus =
  | 'DETECTED'   // Auto-detected, awaiting confirmation
  | 'CONFIRMED'  // User confirmed
  | 'DISMISSED'  // User dismissed
  | 'ENDED';     // Cancelled/ended

export interface RecurringTransaction {
  id: string;
  householdId: string;
  merchantName: string;
  description: string | null;
  frequency: RecurringFrequency;
  expectedAmount: number;
  amountVariance: number;
  dayOfMonth: number | null;
  dayOfWeek: number | null;
  nextExpectedDate: Date;
  lastOccurrence: Date | null;
  accountId: string | null;
  categoryId: string | null;
  status: RecurringStatus;
  isManual: boolean;
  isPaused: boolean;
  occurrenceCount: number;
  confidence: number;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface RecurringTransactionWithDetails extends RecurringTransaction {
  account: Pick<Account, 'id' | 'name' | 'type' | 'ownerId'> | null;
  category: Pick<Category, 'id' | 'name' | 'type' | 'icon' | 'color'> | null;
}

export interface TransactionRecurringLink {
  id: string;
  transactionId: string;
  recurringTransactionId: string;
  createdAt: Date;
}

export interface UpcomingBill {
  id: string;
  merchantName: string;
  expectedAmount: number;
  nextExpectedDate: Date;
  frequency: RecurringFrequency;
  status: RecurringStatus;
  categoryId: string | null;
  categoryName: string | null;
  categoryColor: string | null;
  accountId: string | null;
  accountName: string | null;
  isPaused: boolean;
  daysUntilDue: number;
}

// Recurring transaction API types
export interface CreateRecurringTransactionRequest {
  merchantName: string;
  description?: string;
  frequency: RecurringFrequency;
  expectedAmount: number;
  amountVariance?: number;
  dayOfMonth?: number;
  dayOfWeek?: number;
  nextExpectedDate: string; // ISO date string
  accountId?: string;
  categoryId?: string;
  notes?: string;
}

export interface UpdateRecurringTransactionRequest {
  merchantName?: string;
  description?: string;
  frequency?: RecurringFrequency;
  expectedAmount?: number;
  amountVariance?: number;
  dayOfMonth?: number;
  dayOfWeek?: number;
  nextExpectedDate?: string;
  accountId?: string | null;
  categoryId?: string | null;
  notes?: string | null;
}

export interface MarkRecurringRequest {
  frequency: RecurringFrequency;
  expectedAmount?: number;
  dayOfMonth?: number;
  dayOfWeek?: number;
}

export interface DetectionResult {
  detected: number;
  updated: number;
  patterns: RecurringTransactionWithDetails[];
}

// ============================================
// IMPORT / EXPORT
// ============================================

export interface ImportPreviewParsed {
  date: string;
  amount: number;
  description: string;
  merchant?: string;
  category?: string;
  categoryId?: string | null;
  accountId: string;
  accountName: string;
  notes?: string;
}

export interface ImportPreviewMatchedTransaction {
  id: string;
  date: string;
  amount: number;
  description: string;
  merchantName?: string | null;
  categoryId?: string | null;
  notes?: string | null;
  isManual: boolean;
}

export interface ImportFieldChange {
  field: string;
  from: string;
  to: string;
}

export interface ImportPreviewRow {
  rowNumber: number;
  action: 'create' | 'update' | 'skip' | 'unchanged';
  parsed: ImportPreviewParsed;
  matchedTransaction?: ImportPreviewMatchedTransaction | null;
  matchConfidence?: number | null;
  skipReason?: string | null;
  changes?: ImportFieldChange[];
  warnings: string[];
}

export interface ImportPreviewResponse {
  totalRows: number;
  summary: { create: number; update: number; skip: number; unchanged: number };
  rows: ImportPreviewRow[];
}

export interface ImportExecuteResponse {
  created: number;
  updated: number;
  skipped: number;
  rulesApplied: number;
  skippedDetails: { rowNumber: number; reason: string }[];
}
