import { useState, useMemo } from 'react';
import { useTransactions, TransactionWithOwner } from '../hooks/useTransactions';
import { useAccounts } from '../hooks/useAccounts';
import { useCategories } from '../hooks/useCategories';
import { useHouseholdMembers } from '../hooks/useHousehold';
import { TransactionModal } from '../components/TransactionModal';

type Transaction = TransactionWithOwner;

export default function Transactions() {
  // Filters
  const [search, setSearch] = useState('');
  const [accountFilter, setAccountFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [ownerFilter, setOwnerFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Modal state
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Data hooks
  const { data: transactionsData, isLoading, error } = useTransactions({
    search: search || undefined,
    accountId: accountFilter || undefined,
    categoryId: categoryFilter || undefined,
    ownerId: ownerFilter || undefined,
    limit: 100,
  });
  const { data: accounts } = useAccounts();
  const { data: categories } = useCategories();
  const { data: members } = useHouseholdMembers();

  const transactions = transactionsData?.transactions || [];
  const total = transactionsData?.total || 0;

  // Group transactions by date
  const groupedTransactions = useMemo(() => {
    const groups: Record<string, Transaction[]> = {};

    for (const tx of transactions) {
      // Date comes as string from JSON API, convert if needed
      const dateValue = tx.date as unknown;
      const dateStr =
        typeof dateValue === 'string'
          ? dateValue.split('T')[0]
          : (dateValue as Date).toISOString().split('T')[0];

      if (!groups[dateStr]) {
        groups[dateStr] = [];
      }
      groups[dateStr].push(tx);
    }

    return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a));
  }, [transactions]);

  const handleAddTransaction = () => {
    setSelectedTransaction(null);
    setIsModalOpen(true);
  };

  const handleEditTransaction = (tx: Transaction) => {
    setSelectedTransaction(tx);
    setIsModalOpen(true);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(Math.abs(amount));
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (dateStr === today.toISOString().split('T')[0]) {
      return 'Today';
    }
    if (dateStr === yesterday.toISOString().split('T')[0]) {
      return 'Yesterday';
    }

    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  const activeFiltersCount = [accountFilter, categoryFilter, ownerFilter].filter(Boolean).length;

  if (error) {
    return (
      <div className="p-4">
        <div className="rounded-lg bg-error-50 p-4 text-error-600">
          Failed to load transactions. Please try again.
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-gray-50 px-4 pt-6 pb-3">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Transactions</h1>
            <p className="text-sm text-gray-500">{total} transactions</p>
          </div>
          <button onClick={handleAddTransaction} className="btn-primary">
            <PlusIcon className="mr-1 h-4 w-4" />
            Add
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            placeholder="Search transactions..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-9 pr-10"
          />
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded ${
              activeFiltersCount > 0 ? 'text-primary' : 'text-gray-400'
            }`}
          >
            <FilterIcon className="h-5 w-5" />
            {activeFiltersCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] text-white">
                {activeFiltersCount}
              </span>
            )}
          </button>
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="mt-3 grid grid-cols-3 gap-2">
            <select
              value={accountFilter}
              onChange={(e) => setAccountFilter(e.target.value)}
              className="input text-sm"
            >
              <option value="">All Accounts</option>
              {accounts?.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.name}
                </option>
              ))}
            </select>

            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="input text-sm"
            >
              <option value="">All Categories</option>
              <option value="uncategorized">Uncategorized</option>
              {categories?.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>

            <select
              value={ownerFilter}
              onChange={(e) => setOwnerFilter(e.target.value)}
              className="input text-sm"
            >
              <option value="">All Partners</option>
              <option value="joint">Joint</option>
              {members?.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </header>

      {/* Transaction List */}
      <div className="flex-1 overflow-y-auto px-4 pb-24">
        {isLoading ? (
          <div className="space-y-4 mt-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="h-10 w-10 animate-pulse rounded-full bg-gray-200" />
                <div className="flex-1">
                  <div className="h-4 w-32 animate-pulse rounded bg-gray-200" />
                  <div className="mt-1 h-3 w-20 animate-pulse rounded bg-gray-200" />
                </div>
                <div className="h-4 w-16 animate-pulse rounded bg-gray-200" />
              </div>
            ))}
          </div>
        ) : transactions.length === 0 ? (
          <div className="card mt-4 py-12 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
              <ReceiptIcon className="h-6 w-6 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900">No transactions</h3>
            <p className="mt-1 text-sm text-gray-500">
              {search || activeFiltersCount > 0
                ? 'Try adjusting your filters'
                : 'Add your first transaction to get started'}
            </p>
            {!search && activeFiltersCount === 0 && (
              <button onClick={handleAddTransaction} className="btn-primary mt-4">
                Add Transaction
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-6 mt-4">
            {groupedTransactions.map(([dateStr, txs]) => (
              <div key={dateStr}>
                <h3 className="mb-2 text-sm font-medium text-gray-500">
                  {formatDate(dateStr)}
                </h3>
                <div className="card divide-y divide-gray-100">
                  {txs.map((tx) => (
                    <button
                      key={tx.id}
                      onClick={() => handleEditTransaction(tx)}
                      className="flex w-full items-center gap-3 p-3 text-left hover:bg-gray-50 transition-colors first:rounded-t-xl last:rounded-b-xl"
                    >
                      {/* Category Icon */}
                      <div
                        className="flex h-10 w-10 items-center justify-center rounded-full text-sm"
                        style={{
                          backgroundColor: tx.category?.color
                            ? `${tx.category.color}20`
                            : '#f3f4f6',
                          color: tx.category?.color || '#6b7280',
                        }}
                      >
                        {tx.category?.icon || (tx.amount < 0 ? '−' : '+')}
                      </div>

                      {/* Details */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900 truncate">
                            {tx.merchantName || tx.description}
                          </span>
                          {tx.isAdjustment && (
                            <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                              Adjustment
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <span className="truncate">{tx.account.name}</span>
                          {tx.account.owner && (
                            <>
                              <span>•</span>
                              <OwnerBadge name={tx.account.owner.name} />
                            </>
                          )}
                          {tx.category && (
                            <>
                              <span>•</span>
                              <span className="truncate">{tx.category.name}</span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Amount */}
                      <span
                        className={`font-medium whitespace-nowrap ${
                          tx.amount < 0 ? 'text-gray-900' : 'text-success'
                        }`}
                      >
                        {tx.amount < 0 ? '-' : '+'}
                        {formatCurrency(tx.amount)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Transaction Modal */}
      <TransactionModal
        transaction={selectedTransaction}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </div>
  );
}

function OwnerBadge({ name }: { name: string }) {
  const colors = [
    'bg-blue-100 text-blue-700',
    'bg-green-100 text-green-700',
    'bg-purple-100 text-purple-700',
    'bg-amber-100 text-amber-700',
  ];
  const colorIndex = name.charCodeAt(0) % colors.length;

  return (
    <span
      className={`inline-flex items-center justify-center h-4 w-4 rounded-full text-[10px] font-medium ${colors[colorIndex]}`}
      title={name}
    >
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

// Icons
function PlusIcon({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
    </svg>
  );
}

function SearchIcon({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
      />
    </svg>
  );
}

function FilterIcon({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
      />
    </svg>
  );
}

function ReceiptIcon({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z"
      />
    </svg>
  );
}
