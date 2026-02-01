import { useState } from 'react';
import {
  useAddFunds,
  useWithdrawFunds,
  type Goal,
  formatCurrency,
} from '../hooks/useGoals';

interface AddFundsModalProps {
  goal: Goal;
  onClose: () => void;
  onComplete?: (justCompleted: boolean) => void;
}

export default function AddFundsModal({ goal, onClose, onComplete }: AddFundsModalProps) {
  const addFunds = useAddFunds();
  const withdrawFunds = useWithdrawFunds();

  const [mode, setMode] = useState<'add' | 'withdraw'>('add');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setError('Please enter a valid amount greater than 0');
      return;
    }

    if (mode === 'withdraw' && amountNum > goal.currentAmount) {
      setError(`Cannot withdraw more than the current amount (${formatCurrency(goal.currentAmount)})`);
      return;
    }

    try {
      if (mode === 'add') {
        const result = await addFunds.mutateAsync({ id: goal.id, amount: amountNum });
        if (result.justCompleted) {
          onComplete?.(true);
        }
      } else {
        await withdrawFunds.mutateAsync({ id: goal.id, amount: amountNum });
      }
      onClose();
    } catch (err: any) {
      setError(err.message || `Failed to ${mode} funds`);
    }
  };

  // Quick amount buttons
  const quickAmounts = [50, 100, 250, 500, 1000];
  const remainingToGoal = goal.remaining;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <div className="border-b border-gray-200 px-6 py-4">
          <div className="flex items-center gap-3">
            <span
              className="text-2xl flex items-center justify-center w-12 h-12 rounded-full"
              style={{
                backgroundColor: goal.color ? `${goal.color}20` : '#f3f4f6',
              }}
            >
              {goal.icon || '🎯'}
            </span>
            <div>
              <h2 className="text-xl font-bold text-gray-900">{goal.name}</h2>
              <p className="text-sm text-gray-600">
                {formatCurrency(goal.currentAmount)} of {formatCurrency(goal.targetAmount)}
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded">
              {error}
            </div>
          )}

          {/* Mode toggle */}
          <div className="flex rounded-lg overflow-hidden border border-gray-200">
            <button
              type="button"
              onClick={() => setMode('add')}
              className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
                mode === 'add'
                  ? 'bg-purple-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              Add Funds
            </button>
            <button
              type="button"
              onClick={() => setMode('withdraw')}
              className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
                mode === 'withdraw'
                  ? 'bg-purple-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              Withdraw
            </button>
          </div>

          {/* Amount input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Amount <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full border border-gray-300 rounded-lg pl-8 pr-3 py-3 text-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="0.00"
                required
                autoFocus
              />
            </div>
          </div>

          {/* Quick amounts */}
          {mode === 'add' && (
            <div>
              <p className="text-xs text-gray-500 mb-2">Quick add:</p>
              <div className="flex flex-wrap gap-2">
                {quickAmounts.map((quickAmount) => (
                  <button
                    key={quickAmount}
                    type="button"
                    onClick={() => setAmount(quickAmount.toString())}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      amount === quickAmount.toString()
                        ? 'bg-purple-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    ${quickAmount}
                  </button>
                ))}
                {remainingToGoal > 0 && remainingToGoal <= 10000 && (
                  <button
                    type="button"
                    onClick={() => setAmount(remainingToGoal.toString())}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      amount === remainingToGoal.toString()
                        ? 'bg-purple-600 text-white'
                        : 'bg-green-100 text-green-700 hover:bg-green-200'
                    }`}
                  >
                    Complete ({formatCurrency(remainingToGoal)})
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Preview */}
          {amount && parseFloat(amount) > 0 && (
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm text-gray-600">After this {mode === 'add' ? 'contribution' : 'withdrawal'}:</p>
              <div className="mt-2 flex justify-between items-center">
                <span className="text-gray-700">New Balance</span>
                <span className="font-semibold text-gray-900">
                  {mode === 'add'
                    ? formatCurrency(goal.currentAmount + parseFloat(amount))
                    : formatCurrency(Math.max(0, goal.currentAmount - parseFloat(amount)))}
                </span>
              </div>
              {mode === 'add' && goal.currentAmount + parseFloat(amount) >= goal.targetAmount && (
                <div className="mt-2 flex items-center gap-2 text-green-600">
                  <span>🎉</span>
                  <span className="text-sm font-medium">Goal complete!</span>
                </div>
              )}
            </div>
          )}

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
              disabled={addFunds.isPending || withdrawFunds.isPending}
              className={`flex-1 px-4 py-2 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                mode === 'add'
                  ? 'bg-purple-600 hover:bg-purple-700'
                  : 'bg-orange-500 hover:bg-orange-600'
              }`}
            >
              {addFunds.isPending || withdrawFunds.isPending
                ? 'Processing...'
                : mode === 'add'
                ? 'Add Funds'
                : 'Withdraw'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
