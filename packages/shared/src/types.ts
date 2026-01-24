// ============================================
// HOUSEHOLD & USERS
// ============================================

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
  isSystem: boolean;
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
  merchantContains?: string;
  merchantEquals?: string;
  descriptionContains?: string;
  amountMin?: number;
  amountMax?: number;
  amountEquals?: number;
  accountId?: string;
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
