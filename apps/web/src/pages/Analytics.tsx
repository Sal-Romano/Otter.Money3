import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  useSpendingBreakdown,
  useSpendingTrends,
  useSpendingComparison,
  useSpendingByPartner,
  getCurrentPeriod,
  getPrevPeriod,
} from '../hooks/useAnalytics';
import { useHouseholdMembers } from '../hooks/useHousehold';
import { DateRangeSelector } from '../components/DateRangeSelector';
import { SpendingDonutChart } from '../components/SpendingBreakdownChart';
import { SpendingTrendsChart, TrendsSummary } from '../components/SpendingTrendsChart';

export default function Analytics() {
  const navigate = useNavigate();
  const [selectedPeriod, setSelectedPeriod] = useState(getCurrentPeriod());
  const [selectedPartnerId, setSelectedPartnerId] = useState<string | undefined>(undefined);
  const [viewMode, setViewMode] = useState<'breakdown' | 'trends' | 'comparison' | 'partners'>('breakdown');
  const [trendMonths, setTrendMonths] = useState(6);
  const [chartType, setChartType] = useState<'bar' | 'line'>('bar');

  // Fetch data
  const { data: membersData } = useHouseholdMembers();
  const { data: breakdownData, isLoading: breakdownLoading } = useSpendingBreakdown(
    selectedPeriod,
    undefined,
    undefined,
    selectedPartnerId
  );
  const { data: trendsData, isLoading: trendsLoading } = useSpendingTrends(
    trendMonths,
    undefined,
    selectedPartnerId
  );
  const { data: comparisonData } = useSpendingComparison(
    selectedPeriod,
    getPrevPeriod(selectedPeriod)
  );
  const { data: partnerData } = useSpendingByPartner(selectedPeriod);

  const members = Array.isArray(membersData) ? membersData : [];

  const handleCategoryClick = (categoryId: string) => {
    // Navigate to transactions filtered by category
    navigate(`/transactions?categoryId=${categoryId}&period=${selectedPeriod}`);
  };

  // Loading state
  if (breakdownLoading && viewMode === 'breakdown') {
    return (
      <div className="p-4 space-y-4">
        <div className="h-8 w-48 bg-gray-200 rounded animate-pulse" />
        <div className="h-64 bg-gray-200 rounded animate-pulse" />
      </div>
    );
  }

  return (
    <div className="p-4 pb-24 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Spending Analytics</h1>
      </div>

      {/* Period Selector */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <DateRangeSelector period={selectedPeriod} onPeriodChange={setSelectedPeriod} />
      </div>

      {/* Partner Filter */}
      {members.length > 1 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <label className="text-sm font-medium text-gray-700 mb-2 block">Filter by partner</label>
          <div className="flex gap-2">
            <button
              onClick={() => setSelectedPartnerId(undefined)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedPartnerId === undefined
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Household
            </button>
            {members.map((member) => (
              <button
                key={member.id}
                onClick={() => setSelectedPartnerId(member.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  selectedPartnerId === member.id
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {member.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* View Mode Tabs */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-1 flex gap-1">
        <button
          onClick={() => setViewMode('breakdown')}
          className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            viewMode === 'breakdown'
              ? 'bg-purple-600 text-white'
              : 'text-gray-700 hover:bg-gray-100'
          }`}
        >
          Breakdown
        </button>
        <button
          onClick={() => setViewMode('trends')}
          className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            viewMode === 'trends'
              ? 'bg-purple-600 text-white'
              : 'text-gray-700 hover:bg-gray-100'
          }`}
        >
          Trends
        </button>
        <button
          onClick={() => setViewMode('comparison')}
          className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            viewMode === 'comparison'
              ? 'bg-purple-600 text-white'
              : 'text-gray-700 hover:bg-gray-100'
          }`}
        >
          Comparison
        </button>
        {members.length > 1 && (
          <button
            onClick={() => setViewMode('partners')}
            className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              viewMode === 'partners'
                ? 'bg-purple-600 text-white'
                : 'text-gray-700 hover:bg-gray-100'
            }`}
          >
            Partners
          </button>
        )}
      </div>

      {/* Breakdown View */}
      {viewMode === 'breakdown' && breakdownData && (
        <div className="space-y-4">
          {/* Summary Card */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Spending by Category</h2>
              {trendsData && <TrendsSummary data={trendsData.trends} />}
            </div>
            <div className="text-3xl font-bold text-gray-900 mb-1">
              ${breakdownData.totalSpending.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <div className="text-sm text-gray-600">
              Total spending • {breakdownData.breakdown.length} categories
            </div>
          </div>

          {/* Chart */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <SpendingDonutChart
              data={breakdownData.breakdown}
              onCategoryClick={handleCategoryClick}
            />
          </div>

          {/* Top Categories List */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Categories</h3>
            <div className="space-y-3">
              {breakdownData.breakdown.slice(0, 5).map((category) => (
                <div
                  key={category.categoryId}
                  className="flex items-center justify-between cursor-pointer hover:bg-gray-50 p-3 rounded-lg transition-colors"
                  onClick={() => handleCategoryClick(category.categoryId)}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <span className="text-2xl">{category.categoryIcon || '📦'}</span>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-gray-900">{category.categoryName}</div>
                      <div className="text-xs text-gray-500">
                        {category.transactionCount} transaction{category.transactionCount !== 1 ? 's' : ''}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-gray-900">
                      ${category.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </div>
                    <div className="text-xs text-gray-500">{category.percentage.toFixed(1)}%</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Partner Breakdown (if multiple members) */}
          {members.length > 1 && !selectedPartnerId && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Spending by Partner</h3>
              {partnerData && (
                <div className="grid grid-cols-2 gap-4">
                  {partnerData.byPartner.map((partner) => (
                    <div key={partner.userId} className="bg-gray-50 rounded-lg p-4">
                      <div className="text-sm text-gray-600 mb-1">{partner.userName}</div>
                      <div className="text-2xl font-bold text-gray-900">
                        ${partner.expense.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {partner.transactionCount} transactions
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Trends View */}
      {viewMode === 'trends' && (
        <div className="space-y-4">
          {/* Controls */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <label className="text-sm font-medium text-gray-700">Show:</label>
                <select
                  value={trendMonths}
                  onChange={(e) => setTrendMonths(parseInt(e.target.value))}
                  className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value={3}>3 months</option>
                  <option value={6}>6 months</option>
                  <option value={12}>12 months</option>
                </select>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setChartType('bar')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    chartType === 'bar'
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Bar
                </button>
                <button
                  onClick={() => setChartType('line')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    chartType === 'line'
                      ? 'bg-purple-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Line
                </button>
              </div>
            </div>
          </div>

          {/* Chart */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Spending Over Time</h2>
            {trendsLoading ? (
              <div className="h-64 bg-gray-200 rounded animate-pulse" />
            ) : trendsData ? (
              <SpendingTrendsChart
                data={trendsData.trends}
                showIncome={true}
                showNetCashFlow={false}
                chartType={chartType}
              />
            ) : null}
          </div>

          {/* Monthly Summary */}
          {trendsData && trendsData.trends.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Monthly Summary</h3>
              <div className="space-y-2">
                {trendsData.trends.slice().reverse().map((trend) => {
                  const savings = trend.netCashFlow;
                  const savingsRate = trend.totalIncome > 0
                    ? ((savings / trend.totalIncome) * 100)
                    : 0;

                  return (
                    <div
                      key={trend.period}
                      className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg"
                    >
                      <div className="text-sm font-medium text-gray-900">
                        {new Date(trend.period + '-01').toLocaleDateString('en-US', {
                          month: 'short',
                          year: 'numeric',
                        })}
                      </div>
                      <div className="flex items-center gap-6 text-sm">
                        <div>
                          <span className="text-gray-600">Spent: </span>
                          <span className="font-medium text-gray-900">
                            ${trend.totalExpense.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-600">Saved: </span>
                          <span className={`font-medium ${savings >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            ${Math.abs(savings).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                          </span>
                          <span className="text-gray-500 ml-1">
                            ({savingsRate.toFixed(0)}%)
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Comparison View */}
      {viewMode === 'comparison' && comparisonData && (
        <div className="space-y-4">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Month-over-Month Comparison</h2>

            {/* Overall Change */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="text-sm text-gray-600 mb-1">
                  {new Date(comparisonData.period1.period + '-01').toLocaleDateString('en-US', {
                    month: 'long',
                    year: 'numeric',
                  })}
                </div>
                <div className="text-2xl font-bold text-gray-900">
                  ${comparisonData.period1.totalExpense.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </div>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="text-sm text-gray-600 mb-1">
                  {new Date(comparisonData.period2.period + '-01').toLocaleDateString('en-US', {
                    month: 'long',
                    year: 'numeric',
                  })}
                </div>
                <div className="text-2xl font-bold text-gray-900">
                  ${comparisonData.period2.totalExpense.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </div>
              </div>
            </div>

            {/* Change Summary */}
            <div className="border-t border-gray-200 pt-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">Change:</span>
                <div className="flex items-center gap-2">
                  <span className={`text-lg font-bold ${
                    comparisonData.comparison.expenseChange > 0 ? 'text-red-600' : 'text-green-600'
                  }`}>
                    {comparisonData.comparison.expenseChange > 0 ? '+' : ''}
                    ${Math.abs(comparisonData.comparison.expenseChange).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </span>
                  <span className={`text-sm ${
                    comparisonData.comparison.expenseChange > 0 ? 'text-red-600' : 'text-green-600'
                  }`}>
                    ({comparisonData.comparison.expenseChangePercent > 0 ? '+' : ''}
                    {comparisonData.comparison.expenseChangePercent.toFixed(1)}%)
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Category Comparison */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">By Category</h3>
            <div className="space-y-3">
              {comparisonData.period1.byCategory.slice(0, 10).map((cat1) => {
                const cat2 = comparisonData.period2.byCategory.find(
                  (c) => c.categoryId === cat1.categoryId
                );
                const change = cat1.totalAmount - (cat2?.totalAmount || 0);
                const changePercent = cat2 && cat2.totalAmount > 0
                  ? ((change / cat2.totalAmount) * 100)
                  : 0;

                return (
                  <div
                    key={cat1.categoryId}
                    className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{cat1.categoryIcon || '📦'}</span>
                      <span className="font-medium text-gray-900">{cat1.categoryName}</span>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-gray-600">
                        ${cat1.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                      </span>
                      {cat2 && (
                        <span className={`font-medium ${
                          change > 0 ? 'text-red-600' : 'text-green-600'
                        }`}>
                          {change > 0 ? '+' : ''}
                          {changePercent.toFixed(0)}%
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Partners View */}
      {viewMode === 'partners' && partnerData && (
        <div className="space-y-4">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Spending by Partner</h2>

            {/* Partner Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              {partnerData.byPartner.map((partner) => {
                const percentOfTotal = partnerData.household.totalExpense > 0
                  ? (partner.expense / partnerData.household.totalExpense) * 100
                  : 0;

                return (
                  <div key={partner.userId} className="bg-gray-50 rounded-lg p-5">
                    <div className="text-sm font-medium text-gray-700 mb-3">{partner.userName}</div>
                    <div className="text-3xl font-bold text-gray-900 mb-2">
                      ${partner.expense.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">{percentOfTotal.toFixed(0)}% of household</span>
                      <span className="text-gray-600">{partner.transactionCount} transactions</span>
                    </div>
                    {partner.income > 0 && (
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600">Income:</span>
                          <span className="font-medium text-green-600">
                            ${partner.income.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-sm mt-1">
                          <span className="text-gray-600">Net:</span>
                          <span className={`font-medium ${
                            partner.netCashFlow >= 0 ? 'text-green-600' : 'text-red-600'
                          }`}>
                            ${Math.abs(partner.netCashFlow).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Household Total */}
            <div className="border-t border-gray-200 pt-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700">Household Total:</span>
                <span className="text-xl font-bold text-gray-900">
                  ${partnerData.household.totalExpense.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
