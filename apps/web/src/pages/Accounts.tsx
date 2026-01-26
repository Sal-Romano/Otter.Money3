import { useState, useMemo } from 'react';
import { useAccounts, useAccountSummary } from '../hooks/useAccounts';
import { AccountIcon, accountTypeLabels } from '../components/AccountIcon';
import { AccountModal } from '../components/AccountModal';
import type { AccountWithOwner, AccountType } from '@otter-money/shared';

// Group accounts by type
function groupAccountsByType(accounts: AccountWithOwner[]) {
  const groups: Record<string, AccountWithOwner[]> = {};

  for (const account of accounts) {
    if (account.isHidden) continue;

    const type = account.type;
    if (!groups[type]) {
      groups[type] = [];
    }
    groups[type].push(account);
  }

  return groups;
}

// Order of account types for display
const typeOrder: AccountType[] = [
  'CHECKING',
  'SAVINGS',
  'CREDIT',
  'INVESTMENT',
  'LOAN',
  'MORTGAGE',
  'ASSET',
  'OTHER',
];

export default function Accounts() {
  const { data: accounts, isLoading, error } = useAccounts();
  const { data: summary } = useAccountSummary();
  const [selectedAccount, setSelectedAccount] = useState<AccountWithOwner | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const groupedAccounts = useMemo(() => {
    if (!accounts) return {};
    return groupAccountsByType(accounts);
  }, [accounts]);

  const handleAddAccount = () => {
    setSelectedAccount(null);
    setIsModalOpen(true);
  };

  const handleEditAccount = (account: AccountWithOwner) => {
    setSelectedAccount(account);
    setIsModalOpen(true);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="text-gray-500">Loading accounts...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4">
        <div className="rounded-lg bg-error-50 p-4 text-error-600">
          Failed to load accounts. Please try again.
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-6">
      {/* Header */}
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Accounts</h1>
          <p className="mt-1 text-sm text-gray-500">
            Manage your household's financial accounts
          </p>
        </div>
        <button onClick={handleAddAccount} className="btn-primary">
          <PlusIcon className="mr-1 h-4 w-4" />
          Add
        </button>
      </header>

      {/* Summary Cards */}
      {summary && (
        <div className="mb-6 grid grid-cols-3 gap-3">
          <div className="card">
            <p className="text-xs text-gray-500">Assets</p>
            <p className="text-lg font-semibold text-gray-900">
              {formatCurrency(summary.totalAssets)}
            </p>
          </div>
          <div className="card">
            <p className="text-xs text-gray-500">Liabilities</p>
            <p className="text-lg font-semibold text-gray-900">
              {formatCurrency(summary.totalLiabilities)}
            </p>
          </div>
          <div className="card bg-primary text-white">
            <p className="text-xs opacity-80">Net Worth</p>
            <p className="text-lg font-semibold">
              {formatCurrency(summary.netWorth)}
            </p>
          </div>
        </div>
      )}

      {/* Account Groups */}
      {accounts && accounts.length === 0 ? (
        <div className="card py-12 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary-100">
            <WalletIcon className="h-6 w-6 text-primary" />
          </div>
          <h3 className="text-lg font-medium text-gray-900">No accounts yet</h3>
          <p className="mt-1 text-sm text-gray-500">
            Add your first account to start tracking your household finances.
          </p>
          <button onClick={handleAddAccount} className="btn-primary mt-4">
            Add Account
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {typeOrder.map((type) => {
            const typeAccounts = groupedAccounts[type];
            if (!typeAccounts || typeAccounts.length === 0) return null;

            return (
              <section key={type}>
                <h2 className="mb-3 text-sm font-medium text-gray-500">
                  {accountTypeLabels[type]}
                </h2>
                <div className="space-y-2">
                  {typeAccounts.map((account) => (
                    <AccountCard
                      key={account.id}
                      account={account}
                      onClick={() => handleEditAccount(account)}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {/* Account Modal */}
      <AccountModal
        account={selectedAccount}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </div>
  );
}

interface AccountCardProps {
  account: AccountWithOwner;
  onClick: () => void;
}

function AccountCard({ account, onClick }: AccountCardProps) {
  const isLiability = ['CREDIT', 'LOAN', 'MORTGAGE'].includes(account.type);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  return (
    <button
      onClick={onClick}
      className="card w-full text-left transition-shadow hover:shadow-md flex items-center gap-3"
    >
      <AccountIcon type={account.type} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-gray-900 truncate">{account.name}</span>
          {account.connectionType !== 'MANUAL' && (
            <span className="flex-shrink-0 inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">
              <LinkIcon className="mr-0.5 h-3 w-3" />
              Connected
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-gray-500">
            {account.owner ? account.owner.name : 'Joint'}
          </span>
          {account.owner && (
            <OwnerBadge name={account.owner.name} />
          )}
        </div>
      </div>

      <div className="text-right">
        <span
          className={`font-semibold ${
            isLiability && account.currentBalance < 0
              ? 'text-error'
              : 'text-gray-900'
          }`}
        >
          {formatCurrency(account.currentBalance)}
        </span>
        {account.availableBalance !== null &&
          account.availableBalance !== account.currentBalance && (
            <p className="text-xs text-gray-500">
              Available: {formatCurrency(account.availableBalance)}
            </p>
          )}
      </div>

      <ChevronRightIcon className="h-5 w-5 text-gray-400 flex-shrink-0" />
    </button>
  );
}

function OwnerBadge({ name }: { name: string }) {
  // Generate a consistent color based on the name
  const colors = [
    'bg-blue-100 text-blue-700',
    'bg-green-100 text-green-700',
    'bg-purple-100 text-purple-700',
    'bg-amber-100 text-amber-700',
    'bg-pink-100 text-pink-700',
  ];

  const colorIndex = name.charCodeAt(0) % colors.length;

  return (
    <span
      className={`inline-flex items-center justify-center h-5 w-5 rounded-full text-xs font-medium ${colors[colorIndex]}`}
      title={name}
    >
      {name.charAt(0).toUpperCase()}
    </span>
  );
}

// Icon components
function PlusIcon({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
    </svg>
  );
}

function WalletIcon({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
      />
    </svg>
  );
}

function ChevronRightIcon({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  );
}

function LinkIcon({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
      />
    </svg>
  );
}
