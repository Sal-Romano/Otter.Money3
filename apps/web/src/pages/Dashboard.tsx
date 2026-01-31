import { Link } from 'react-router-dom';
import { useAuthStore } from '../stores/auth';
import { useDashboardSummary, useNetWorthHistory } from '../hooks/useDashboard';
import { useBudgetSpending, getCurrentPeriod } from '../hooks/useBudgets';
import { useSpendingBreakdown, useSpendingTrends, getCurrentPeriod as getAnalyticsPeriod } from '../hooks/useAnalytics';
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { TrendsSummary } from '../components/SpendingTrendsChart';

export default function Dashboard() {
  const { user, household } = useAuthStore();
  const { data: summary, isLoading } = useDashboardSummary();
  const { data: netWorthHistory } = useNetWorthHistory();
  const { data: budgetData, isLoading: budgetLoading } = useBudgetSpending(getCurrentPeriod());
  const { data: spendingBreakdown } = useSpendingBreakdown(getAnalyticsPeriod());
  const { data: trendsData } = useSpendingTrends(3);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatCurrencyFull = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  // Format date for chart
  const formatChartDate = (dateStr: string) => {
    const [, month] = dateStr.split('-');
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return monthNames[parseInt(month) - 1];
  };

  return (
    <div className="px-4 py-6">
      {/* Header */}
      <header className="mb-6">
        <p className="text-sm text-gray-500">
          {household?.name || 'Your Household'}
        </p>
        <h1 className="text-2xl font-bold text-gray-900">
          Hey, {user?.name?.split(' ')[0]}!
        </h1>
      </header>

      {/* Net Worth Card */}
      <div className="card mb-4 bg-primary text-white">
        <p className="text-sm opacity-80">Household Net Worth</p>
        {isLoading ? (
          <div className="mt-1 h-9 w-32 animate-pulse rounded bg-white/20" />
        ) : (
          <p className="mt-1 text-3xl font-bold">
            {summary ? formatCurrency(summary.netWorth) : '$0'}
          </p>
        )}

        {/* Net Worth Chart */}
        {netWorthHistory && netWorthHistory.length > 1 && (
          <div className="mt-4 h-24 -mx-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={netWorthHistory}>
                <defs>
                  <linearGradient id="netWorthGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="white" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="white" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="date"
                  tickFormatter={formatChartDate}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: 'white', fontSize: 10, opacity: 0.7 }}
                />
                <YAxis hide domain={['dataMin - 1000', 'dataMax + 1000']} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1f2937',
                    border: 'none',
                    borderRadius: '8px',
                    color: 'white',
                  }}
                  formatter={(value: number) => [formatCurrency(value), 'Net Worth']}
                  labelFormatter={(label) => formatChartDate(label)}
                />
                <Area
                  type="monotone"
                  dataKey="total"
                  stroke="white"
                  strokeWidth={2}
                  fill="url(#netWorthGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Quick Stats */}
      <div className="mb-6 grid grid-cols-2 gap-3">
        <div className="card">
          <p className="text-xs text-gray-500">Assets</p>
          {isLoading ? (
            <div className="mt-1 h-6 w-20 animate-pulse rounded bg-gray-200" />
          ) : (
            <p className="text-lg font-semibold text-gray-900">
              {summary ? formatCurrency(summary.totalAssets) : '$0'}
            </p>
          )}
        </div>
        <div className="card">
          <p className="text-xs text-gray-500">Liabilities</p>
          {isLoading ? (
            <div className="mt-1 h-6 w-20 animate-pulse rounded bg-gray-200" />
          ) : (
            <p className="text-lg font-semibold text-gray-900">
              {summary ? formatCurrency(summary.totalLiabilities) : '$0'}
            </p>
          )}
        </div>
      </div>

      {/* Partner Breakdown */}
      {summary && Object.keys(summary.byPartner).length > 1 && (
        <section className="mb-6">
          <h2 className="mb-3 font-semibold text-gray-900">Net Worth by Partner</h2>
          <div className="card space-y-3">
            {Object.entries(summary.byPartner)
              .filter(([, data]) => data.assets !== 0 || data.liabilities !== 0)
              .map(([partnerId, data]) => (
                <div key={partnerId} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <PartnerBadge
                      name={summary.memberNames[partnerId] || partnerId}
                    />
                    <span className="text-sm text-gray-600">
                      {summary.memberNames[partnerId] || partnerId}
                    </span>
                  </div>
                  <span className={`font-medium ${data.netWorth >= 0 ? 'text-gray-900' : 'text-error'}`}>
                    {formatCurrency(data.netWorth)}
                  </span>
                </div>
              ))}
          </div>
        </section>
      )}

      {/* Quick Actions */}
      {summary && summary.accountCount === 0 && (
        <section className="mb-6">
          <div className="card bg-primary-50 border border-primary-200">
            <h3 className="font-medium text-primary-900">Get Started</h3>
            <p className="mt-1 text-sm text-primary-700">
              Add your first account to start tracking your household finances.
            </p>
            <Link to="/accounts" className="btn-primary mt-3 inline-block">
              Add Account
            </Link>
          </div>
        </section>
      )}

      {/* Recent Transactions */}
      <section className="mb-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Recent Transactions</h2>
          <Link to="/transactions" className="text-sm text-primary">
            View all
          </Link>
        </div>
        <div className="card">
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="h-10 w-10 animate-pulse rounded-full bg-gray-200" />
                  <div className="flex-1">
                    <div className="h-4 w-24 animate-pulse rounded bg-gray-200" />
                    <div className="mt-1 h-3 w-16 animate-pulse rounded bg-gray-200" />
                  </div>
                  <div className="h-4 w-16 animate-pulse rounded bg-gray-200" />
                </div>
              ))}
            </div>
          ) : summary && summary.recentTransactions.length > 0 ? (
            <div className="space-y-3">
              {summary.recentTransactions.map((tx) => (
                <div key={tx.id} className="flex items-center gap-3">
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-full text-sm"
                    style={{
                      backgroundColor: tx.category?.color
                        ? `${tx.category.color}20`
                        : '#f3f4f6',
                      color: tx.category?.color || '#6b7280',
                    }}
                  >
                    {tx.category?.icon ? (
                      <span>{tx.category.icon}</span>
                    ) : (
                      <span>{tx.amount < 0 ? '−' : '+'}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">
                      {tx.merchantName || tx.description}
                    </p>
                    <p className="text-xs text-gray-500">
                      {tx.account.name} • {new Date(tx.date).toLocaleDateString()}
                    </p>
                  </div>
                  <span
                    className={`font-medium ${tx.amount < 0 ? 'text-gray-900' : 'text-success'}`}
                  >
                    {tx.amount < 0 ? '-' : '+'}
                    {formatCurrencyFull(Math.abs(tx.amount))}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="py-8 text-center text-sm text-gray-500">
              No transactions yet. Connect an account to get started!
            </p>
          )}
        </div>
      </section>

      {/* Budget Status */}
      <section className="mb-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Budget Status</h2>
          <Link to="/budget" className="text-sm text-primary">
            {budgetData?.data && budgetData.data.length > 0 ? 'View all' : 'Set up'}
          </Link>
        </div>
        <div className="card">
          {budgetLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="h-10 w-10 animate-pulse rounded-full bg-gray-200" />
                  <div className="flex-1">
                    <div className="h-4 w-32 animate-pulse rounded bg-gray-200" />
                    <div className="mt-2 h-2 animate-pulse rounded bg-gray-200" />
                  </div>
                </div>
              ))}
            </div>
          ) : budgetData?.data && budgetData.data.length > 0 ? (
            <div className="space-y-4">
              {budgetData.data.slice(0, 3).map((item) => (
                <div key={item.categoryId}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{item.categoryIcon || '📦'}</span>
                      <span className="text-sm font-medium text-gray-900">
                        {item.categoryName}
                      </span>
                    </div>
                    <span className="text-sm text-gray-600">
                      ${item.totalSpent.toLocaleString()} / ${item.budgetAmount.toLocaleString()}
                    </span>
                  </div>
                  <div className="relative h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className={`absolute inset-y-0 left-0 rounded-full transition-all ${
                        item.status === 'exceeded'
                          ? 'bg-red-500'
                          : item.status === 'warning'
                          ? 'bg-yellow-500'
                          : 'bg-purple-600'
                      }`}
                      style={{ width: `${Math.min(item.percentUsed, 100)}%` }}
                    />
                  </div>
                  {item.status === 'exceeded' && (
                    <p className="text-xs text-red-600 mt-1">
                      Over budget by ${(item.totalSpent - item.budgetAmount).toLocaleString()}
                    </p>
                  )}
                  {item.status === 'warning' && (
                    <p className="text-xs text-yellow-600 mt-1">
                      {item.percentUsed.toFixed(0)}% used
                    </p>
                  )}
                </div>
              ))}
              {budgetData.data.length > 3 && (
                <Link
                  to="/budget"
                  className="block text-center text-sm text-primary hover:text-primary-dark pt-2"
                >
                  View {budgetData.data.length - 3} more
                </Link>
              )}
            </div>
          ) : (
            <div className="py-8 text-center">
              <p className="text-sm text-gray-500 mb-3">
                No budget set. Create one to track your spending!
              </p>
              <Link
                to="/budget"
                className="inline-block text-sm text-primary hover:text-primary-dark font-medium"
              >
                Create Budget →
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* Spending Insights */}
      <section className="mb-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Spending Insights</h2>
          <Link to="/analytics" className="text-sm text-primary">
            View details
          </Link>
        </div>
        <div className="card">
          {spendingBreakdown && spendingBreakdown.totalSpending > 0 ? (
            <div>
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-gray-500">This Month's Spending</p>
                  {trendsData && <TrendsSummary data={trendsData.trends} />}
                </div>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(spendingBreakdown.totalSpending)}
                </p>
              </div>

              {/* Top 3 Categories */}
              {spendingBreakdown.breakdown.length > 0 && (
                <div className="space-y-3 border-t border-gray-200 pt-4">
                  <p className="text-xs font-medium text-gray-600 uppercase">Top Categories</p>
                  {spendingBreakdown.breakdown.slice(0, 3).map((category) => (
                    <div key={category.categoryId} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{category.categoryIcon || '📦'}</span>
                        <span className="text-sm text-gray-700">{category.categoryName}</span>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium text-gray-900">
                          {formatCurrency(category.totalAmount)}
                        </div>
                        <div className="text-xs text-gray-500">
                          {category.percentage.toFixed(0)}%
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="py-8 text-center">
              <p className="text-sm text-gray-500 mb-3">
                No spending data yet for this month.
              </p>
              <Link
                to="/analytics"
                className="inline-block text-sm text-primary hover:text-primary-dark font-medium"
              >
                View Analytics →
              </Link>
            </div>
          )}
        </div>
      </section>

      {/* Upcoming Bills */}
      <section className="mb-6">
        <h2 className="mb-3 font-semibold text-gray-900">Upcoming Bills</h2>
        <div className="card">
          <p className="py-8 text-center text-sm text-gray-500">
            No upcoming bills detected.
          </p>
        </div>
      </section>

      {/* Wally FAB - Placeholder */}
      <button
        className="fixed bottom-24 right-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-white shadow-lg transition-transform hover:scale-105 active:scale-95"
        onClick={() => alert('Wally AI coming soon!')}
        aria-label="Chat with Wally"
      >
        <img
          src="/images/otter_swimming_vector.svg"
          alt=""
          className="h-8 w-8"
        />
      </button>
    </div>
  );
}

function PartnerBadge({ name }: { name: string }) {
  const colors = [
    'bg-blue-100 text-blue-700',
    'bg-green-100 text-green-700',
    'bg-purple-100 text-purple-700',
    'bg-amber-100 text-amber-700',
    'bg-pink-100 text-pink-700',
  ];

  const colorIndex = name === 'Joint' ? 4 : name.charCodeAt(0) % colors.length;

  return (
    <span
      className={`inline-flex items-center justify-center h-8 w-8 rounded-full text-sm font-medium ${colors[colorIndex]}`}
    >
      {name === 'Joint' ? 'J' : name.charAt(0).toUpperCase()}
    </span>
  );
}
