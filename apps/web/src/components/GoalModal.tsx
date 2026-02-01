import { useState, useEffect } from 'react';
import {
  useCreateGoal,
  useUpdateGoal,
  type Goal,
  GOAL_ICONS,
  GOAL_COLORS,
} from '../hooks/useGoals';

interface GoalModalProps {
  goal?: Goal | null;
  onClose: () => void;
}

export default function GoalModal({ goal, onClose }: GoalModalProps) {
  const createGoal = useCreateGoal();
  const updateGoal = useUpdateGoal();

  const [name, setName] = useState(goal?.name || '');
  const [targetAmount, setTargetAmount] = useState(goal?.targetAmount.toString() || '');
  const [currentAmount, setCurrentAmount] = useState(goal?.currentAmount.toString() || '0');
  const [targetDate, setTargetDate] = useState(
    goal?.targetDate ? goal.targetDate.split('T')[0] : ''
  );
  const [icon, setIcon] = useState(goal?.icon || '🎯');
  const [color, setColor] = useState(goal?.color || '#9F6FBA');
  const [error, setError] = useState('');
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);

  useEffect(() => {
    if (goal) {
      setName(goal.name);
      setTargetAmount(goal.targetAmount.toString());
      setCurrentAmount(goal.currentAmount.toString());
      setTargetDate(goal.targetDate ? goal.targetDate.split('T')[0] : '');
      setIcon(goal.icon || '🎯');
      setColor(goal.color || '#9F6FBA');
    }
  }, [goal]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Please enter a goal name');
      return;
    }

    const targetNum = parseFloat(targetAmount);
    if (isNaN(targetNum) || targetNum <= 0) {
      setError('Please enter a valid target amount greater than 0');
      return;
    }

    const currentNum = parseFloat(currentAmount) || 0;
    if (currentNum < 0) {
      setError('Current amount cannot be negative');
      return;
    }

    try {
      if (goal) {
        await updateGoal.mutateAsync({
          id: goal.id,
          name: name.trim(),
          targetAmount: targetNum,
          targetDate: targetDate ? new Date(targetDate).toISOString() : null,
          icon,
          color,
        });
      } else {
        await createGoal.mutateAsync({
          name: name.trim(),
          targetAmount: targetNum,
          currentAmount: currentNum,
          targetDate: targetDate ? new Date(targetDate).toISOString() : null,
          icon,
          color,
        });
      }
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save goal');
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
            {goal ? 'Edit Goal' : 'Create Goal'}
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded">
              {error}
            </div>
          )}

          {/* Icon & Color selector */}
          <div className="flex gap-4">
            {/* Icon */}
            <div className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-1">Icon</label>
              <button
                type="button"
                onClick={() => {
                  setShowIconPicker(!showIconPicker);
                  setShowColorPicker(false);
                }}
                className="w-14 h-14 rounded-lg border-2 border-gray-200 flex items-center justify-center text-2xl hover:border-purple-400 transition-colors"
                style={{ backgroundColor: `${color}20` }}
              >
                {icon}
              </button>
              {showIconPicker && (
                <div className="absolute top-full left-0 mt-2 bg-white rounded-lg shadow-lg border border-gray-200 p-2 z-10 w-64">
                  <div className="grid grid-cols-4 gap-2">
                    {GOAL_ICONS.map((item) => (
                      <button
                        key={item.icon}
                        type="button"
                        onClick={() => {
                          setIcon(item.icon);
                          setShowIconPicker(false);
                        }}
                        className={`w-12 h-12 rounded-lg flex items-center justify-center text-xl hover:bg-gray-100 transition-colors ${
                          icon === item.icon ? 'bg-purple-100 ring-2 ring-purple-500' : ''
                        }`}
                        title={item.label}
                      >
                        {item.icon}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Color */}
            <div className="relative">
              <label className="block text-sm font-medium text-gray-700 mb-1">Color</label>
              <button
                type="button"
                onClick={() => {
                  setShowColorPicker(!showColorPicker);
                  setShowIconPicker(false);
                }}
                className="w-14 h-14 rounded-lg border-2 border-gray-200 hover:border-purple-400 transition-colors"
                style={{ backgroundColor: color }}
              />
              {showColorPicker && (
                <div className="absolute top-full left-0 mt-2 bg-white rounded-lg shadow-lg border border-gray-200 p-2 z-10">
                  <div className="grid grid-cols-4 gap-2">
                    {GOAL_COLORS.map((item) => (
                      <button
                        key={item.color}
                        type="button"
                        onClick={() => {
                          setColor(item.color);
                          setShowColorPicker(false);
                        }}
                        className={`w-10 h-10 rounded-lg transition-transform hover:scale-110 ${
                          color === item.color ? 'ring-2 ring-offset-2 ring-purple-500' : ''
                        }`}
                        style={{ backgroundColor: item.color }}
                        title={item.label}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Goal name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Goal Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              placeholder="e.g., Emergency Fund, Vacation, New Car"
              required
              autoFocus
            />
          </div>

          {/* Target amount */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Target Amount <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={targetAmount}
                onChange={(e) => setTargetAmount(e.target.value)}
                className="w-full border border-gray-300 rounded-lg pl-8 pr-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="10,000"
                required
              />
            </div>
          </div>

          {/* Current amount (only for new goals) */}
          {!goal && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Already Saved (Optional)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={currentAmount}
                  onChange={(e) => setCurrentAmount(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg pl-8 pr-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="0"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Enter any amount you've already saved towards this goal
              </p>
            </div>
          )}

          {/* Target date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Target Date (Optional)
            </label>
            <input
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
            <p className="text-xs text-gray-500 mt-1">
              Set a target date to track your progress over time
            </p>
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
              disabled={createGoal.isPending || updateGoal.isPending}
              className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {createGoal.isPending || updateGoal.isPending
                ? 'Saving...'
                : goal
                ? 'Update Goal'
                : 'Create Goal'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
