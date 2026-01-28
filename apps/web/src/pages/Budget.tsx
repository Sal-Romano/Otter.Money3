import { useState } from 'react';
import {
  useBudgets,
  useBudgetSpending,
  useDeleteBudget,
  useCopyBudget,
  getCurrentPeriod,
  getNextPeriod,
  getPrevPeriod,
  formatPeriod,
  type Budget as BudgetType,
} from '../hooks/useBudgets';
import BudgetModal from '../components/BudgetModal';

export default function Budget() {
  const [selectedPeriod, setSelectedPeriod] = useState(getCurrentPeriod());
  const [showModal, setShowModal] = useState(false);
  const [editingBudget, setEditingBudget] = useState<BudgetType | null>(null);

  const { data: budgets, isLoading: loadingBudgets } = useBudgets(selectedPeriod);
  const { data: spendingData, isLoading: loadingSpending } = useBudgetSpending(selectedPeriod);
  const deleteBudget = useDeleteBudget();
  const copyBudget = useCopyBudget();

  const currentPeriod = getCurrentPeriod();
  const isCurrentPeriod = selectedPeriod === currentPeriod;

  const handleCreateBudget = () => {
    setEditingBudget(null);
    setShowModal(true);
  };

  const handleEditBudget = (budget: BudgetType) => {
    setEditingBudget(budget);
    setShowModal(true);
  };

  const handleDeleteBudget = async (budgetId: string) => {
    if (!confirm('Are you sure you want to delete this budget?')) return;

    try {
      await deleteBudget.mutateAsync({ id: budgetId, period: selectedPeriod });
    } catch (err) {
      console.error('Failed to delete budget:', err);
      alert('Failed to delete budget. Please try again.');
    }
  };

  const handleCopyFromPrevious = async () => {
    const prevPeriod = getPrevPeriod(selectedPeriod);
    const confirmMessage = `Copy all budgets from ${formatPeriod(prevPeriod)} to ${formatPeriod(
      selectedPeriod
    )}?\n\nThis will replace any existing budgets for ${formatPeriod(selectedPeriod)}.`;

    if (!confirm(confirmMessage)) return;

    try {
      const result = await copyBudget.mutateAsync({
        fromPeriod: prevPeriod,
        toPeriod: selectedPeriod,
      });
      alert(result.message);
    } catch (err: any) {
      console.error('Failed to copy budgets:', err);
      alert(err.message || 'Failed to copy budgets. Please try again.');
    }
  };

  const handlePrevPeriod = () => {
    setSelectedPeriod(getPrevPeriod(selectedPeriod));
  };

  const handleNextPeriod = () => {
    setSelectedPeriod(getNextPeriod(selectedPeriod));
  };

  const handleCurrentPeriod = () => {
    setSelectedPeriod(currentPeriod);
  };

  if (loadingBudgets || loadingSpending) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-gray-500">Loading budgets...</div>
      </div>
    );
  }

  const spending = spendingData?.data || [];
  const members = spendingData?.members || [];

  // Calculate overall totals
  const totalBudgeted = spending.reduce((sum, s) => sum + s.budgetAmount, 0);
  const totalSpent = spending.reduce((sum, s) => sum + s.totalSpent, 0);
  const totalRemaining = Math.max(0, totalBudgeted - totalSpent);
  const overallPercentUsed = totalBudgeted > 0 ? (totalSpent / totalBudgeted) * 100 : 0;

  return (
    <div className="max-w-6xl mx-auto p-4 pb-20">
      {/* Header */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Budget</h1>
          <p className="text-sm text-gray-600 mt-1">Track household spending by category</p>
        </div>
        <button
          onClick={handleCreateBudget}
          className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors"
        >
          + Add Budget
        </button>
      </div>

      {/* Period selector */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
        <div className="flex items-center justify-between">
          <button
            onClick={handlePrevPeriod}
            className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
          >
            ← Previous
          </button>

          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-gray-900">{formatPeriod(selectedPeriod)}</h2>
            {!isCurrentPeriod && (
              <button
                onClick={handleCurrentPeriod}
                className="text-sm text-purple-600 hover:text-purple-700 font-medium"
              >
                Go to current
              </button>
            )}
          </div>

          <button
            onClick={handleNextPeriod}
            className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
          >
            Next →
          </button>
        </div>

        {/* Quick actions */}
        {budgets && budgets.length === 0 && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <button
              onClick={handleCopyFromPrevious}
              disabled={copyBudget.isPending}
              className="text-sm text-purple-600 hover:text-purple-700 font-medium disabled:opacity-50"
            >
              {copyBudget.isPending ? 'Copying...' : 'Copy from previous month'}
            </button>
          </div>
        )}
      </div>

      {/* Overall summary */}
      {spending.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <h3 className="text-sm font-medium text-gray-700 mb-4">Overall Budget</h3>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div>
              <div className="text-2xl font-bold text-gray-900">
                ${totalBudgeted.toLocaleString()}
              </div>
              <div className="text-xs text-gray-600">Budgeted</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-purple-600">
                ${totalSpent.toLocaleString()}
              </div>
              <div className="text-xs text-gray-600">Spent</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-600">
                ${totalRemaining.toLocaleString()}
              </div>
              <div className="text-xs text-gray-600">Remaining</div>
            </div>
          </div>

          {/* Overall progress bar */}
          <div className="relative h-3 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={`absolute inset-y-0 left-0 rounded-full transition-all ${
                overallPercentUsed > 100
                  ? 'bg-red-500'
                  : overallPercentUsed >= 90
                  ? 'bg-yellow-500'
                  : 'bg-purple-600'
              }`}
              style={{ width: `${Math.min(overallPercentUsed, 100)}%` }}
            />
          </div>
          <div className="text-xs text-gray-600 mt-1 text-right">
            {overallPercentUsed.toFixed(1)}% used
          </div>
        </div>
      )}

      {/* Budget list */}
      {!budgets || budgets.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
          <div className="text-gray-400 text-5xl mb-4">💰</div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            No budgets for {formatPeriod(selectedPeriod)}
          </h3>
          <p className="text-gray-600 mb-4">
            Create budgets to track your household spending by category
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={handleCreateBudget}
              className="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700 transition-colors"
            >
              Create Budget
            </button>
            <button
              onClick={handleCopyFromPrevious}
              disabled={copyBudget.isPending}
              className="border border-purple-600 text-purple-600 px-6 py-2 rounded-lg hover:bg-purple-50 transition-colors disabled:opacity-50"
            >
              {copyBudget.isPending ? 'Copying...' : 'Copy from Previous Month'}
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {budgets.map((budget) => {
            // Find spending data for this budget (may not exist if no transactions yet)
            const spendingItem = spending.find((s) => s.categoryId === budget.categoryId);

            // If no spending data, create default values
            const item = spendingItem || {
              categoryId: budget.categoryId,
              categoryName: budget.category.name,
              categoryType: budget.category.type,
              categoryIcon: budget.category.icon,
              categoryColor: budget.category.color,
              budgetAmount: budget.amount,
              totalSpent: 0,
              byPartner: members.map(m => ({ userId: m.id, userName: m.name, spent: 0 })),
              percentUsed: 0,
              remaining: budget.amount,
              status: 'on-track' as const,
            };

            return (
              <div
                key={item.categoryId}
                className="bg-white rounded-lg shadow-sm border border-gray-200 p-5"
              >
                {/* Category header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <span
                      className="text-2xl flex items-center justify-center w-12 h-12 rounded-full"
                      style={{
                        backgroundColor: item.categoryColor
                          ? `${item.categoryColor}20`
                          : '#f3f4f6',
                      }}
                    >
                      {item.categoryIcon || '📦'}
                    </span>
                    <div>
                      <h3 className="font-semibold text-gray-900">{item.categoryName}</h3>
                      <div className="text-sm text-gray-600">
                        ${item.totalSpent.toLocaleString()} of ${item.budgetAmount.toLocaleString()}
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEditBudget(budget)}
                      className="text-sm text-purple-600 hover:text-purple-700 font-medium"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteBudget(budget.id)}
                      className="text-sm text-red-600 hover:text-red-700 font-medium"
                      disabled={deleteBudget.isPending}
                    >
                      Delete
                    </button>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="mb-3">
                  <div className="relative h-3 bg-gray-200 rounded-full overflow-hidden">
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
                  <div className="flex justify-between items-center mt-1">
                    <span className="text-xs text-gray-600">{item.percentUsed.toFixed(1)}% used</span>
                    <span
                      className={`text-xs font-medium ${
                        item.status === 'exceeded'
                          ? 'text-red-600'
                          : item.status === 'warning'
                          ? 'text-yellow-600'
                          : 'text-green-600'
                      }`}
                    >
                      ${item.remaining.toLocaleString()} remaining
                    </span>
                  </div>
                </div>

                {/* Partner breakdown */}
                {members.length > 1 && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <div className="text-xs font-medium text-gray-700 mb-2">Spending by partner:</div>
                    <div className="grid grid-cols-2 gap-3">
                      {item.byPartner.map((partner) => (
                        <div key={partner.userId} className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">{partner.userName}</span>
                          <span className="text-sm font-medium text-gray-900">
                            ${partner.spent.toLocaleString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Status badge */}
                {item.status === 'exceeded' && (
                  <div className="mt-3 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                    <div className="text-sm text-red-800">
                      ⚠️ Budget exceeded by ${(item.totalSpent - item.budgetAmount).toLocaleString()}
                    </div>
                  </div>
                )}
                {item.status === 'warning' && (
                  <div className="mt-3 bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2">
                    <div className="text-sm text-yellow-800">
                      ⚡ Approaching budget limit
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Info box */}
      <div className="mt-6 bg-purple-50 border border-purple-200 rounded-lg p-4">
        <h4 className="font-semibold text-purple-900 mb-2">How budgets work:</h4>
        <ul className="text-sm text-purple-800 space-y-1">
          <li>• Budgets are shared across your household</li>
          <li>• Both partners' spending counts toward the budget</li>
          <li>• Only expense categories can have budgets</li>
          <li>• Budgets are set monthly and reset each period</li>
        </ul>
      </div>

      {/* Modal */}
      {showModal && (
        <BudgetModal
          budget={editingBudget}
          period={selectedPeriod}
          onClose={() => {
            setShowModal(false);
            setEditingBudget(null);
          }}
        />
      )}
    </div>
  );
}
