import { useState, useEffect } from 'react';
import { useCreateBudget, useUpdateBudget, type Budget } from '../hooks/useBudgets';
import { CategoryPicker } from './CategoryPicker';
import { CategoryIcon } from './CategoryIcon';
import { useCategoryById } from '../hooks/useCategories';

interface BudgetModalProps {
  budget?: Budget | null;
  period: string;
  onClose: () => void;
}

export default function BudgetModal({ budget, period, onClose }: BudgetModalProps) {
  const createBudget = useCreateBudget();
  const updateBudget = useUpdateBudget();
  const { data: selectedCategory } = useCategoryById(budget?.categoryId || null);

  const [categoryId, setCategoryId] = useState<string | null>(budget?.categoryId || null);
  const [amount, setAmount] = useState(budget?.amount.toString() || '');
  const [rollover, setRollover] = useState(budget?.rollover || false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (budget) {
      setCategoryId(budget.categoryId);
      setAmount(budget.amount.toString());
      setRollover(budget.rollover);
    }
  }, [budget]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!categoryId) {
      setError('Please select a category');
      return;
    }

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setError('Please enter a valid amount greater than 0');
      return;
    }

    try {
      if (budget) {
        await updateBudget.mutateAsync({
          id: budget.id,
          amount: amountNum,
          rollover,
          period,
        });
      } else {
        await createBudget.mutateAsync({
          categoryId,
          amount: amountNum,
          period,
          rollover,
        });
      }
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save budget');
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4">
          <h2 className="text-xl font-bold text-gray-900">
            {budget ? 'Edit Budget' : 'Create Budget'}
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded">
              {error}
            </div>
          )}

          {/* Category selector */}
          {budget ? (
            // Show read-only category for editing
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Category
              </label>
              <div className="flex items-center gap-2 px-3 py-2.5 bg-gray-100 rounded-lg border border-gray-200">
                {selectedCategory && (
                  <>
                    <span
                      className="flex-shrink-0 w-6 h-6 rounded flex items-center justify-center bg-gray-200 text-gray-600"
                      style={
                        selectedCategory.color
                          ? { backgroundColor: `${selectedCategory.color}20`, color: selectedCategory.color }
                          : undefined
                      }
                    >
                      <CategoryIcon icon={selectedCategory.icon} size={14} />
                    </span>
                    <span className="text-gray-900">{selectedCategory.name}</span>
                  </>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Category cannot be changed. Delete and create a new budget to change category.
              </p>
            </div>
          ) : (
            // Show picker for new budgets
            <div>
              <CategoryPicker
                value={categoryId}
                onChange={setCategoryId}
                categoryType="EXPENSE"
                label="Category"
                allowUncategorized={false}
                placeholder="Select a category..."
              />
              <p className="text-xs text-gray-500 mt-1">
                Parent category budgets include spending from all subcategories.
              </p>
            </div>
          )}

          {/* Amount */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Budget Amount <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full border border-gray-300 rounded-lg pl-8 pr-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="0.00"
                required
              />
            </div>
          </div>

          {/* Rollover toggle */}
          <div className="flex items-start">
            <input
              type="checkbox"
              id="rollover"
              checked={rollover}
              onChange={(e) => setRollover(e.target.checked)}
              className="mt-1 h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
            />
            <label htmlFor="rollover" className="ml-2">
              <span className="block text-sm font-medium text-gray-700">
                Rollover unused budget
              </span>
              <span className="block text-xs text-gray-500">
                Add remaining budget to next month (coming soon)
              </span>
            </label>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createBudget.isPending || updateBudget.isPending}
              className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {createBudget.isPending || updateBudget.isPending
                ? 'Saving...'
                : budget
                ? 'Update Budget'
                : 'Create Budget'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
