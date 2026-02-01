import { useState } from 'react';
import {
  useGoals,
  useDeleteGoal,
  type Goal,
  formatCurrency,
  formatTargetDate,
  getDaysUntilTarget,
  getMonthlyContributionNeeded,
} from '../hooks/useGoals';
import GoalModal from '../components/GoalModal';
import AddFundsModal from '../components/AddFundsModal';

export default function Goals() {
  const [showModal, setShowModal] = useState(false);
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [addFundsGoal, setAddFundsGoal] = useState<Goal | null>(null);
  const [showCompleted, setShowCompleted] = useState(false);
  const [celebratingGoal, setCelebratingGoal] = useState<string | null>(null);

  const { data: goals, isLoading } = useGoals(showCompleted);
  const deleteGoal = useDeleteGoal();

  const handleCreateGoal = () => {
    setEditingGoal(null);
    setShowModal(true);
  };

  const handleEditGoal = (goal: Goal) => {
    setEditingGoal(goal);
    setShowModal(true);
  };

  const handleDeleteGoal = async (goalId: string, goalName: string) => {
    if (!confirm(`Are you sure you want to delete "${goalName}"? This cannot be undone.`)) return;

    try {
      await deleteGoal.mutateAsync(goalId);
    } catch (err) {
      console.error('Failed to delete goal:', err);
      alert('Failed to delete goal. Please try again.');
    }
  };

  const handleAddFunds = (goal: Goal) => {
    setAddFundsGoal(goal);
  };

  const handleGoalCompleted = (justCompleted: boolean) => {
    if (justCompleted && addFundsGoal) {
      setCelebratingGoal(addFundsGoal.id);
      setTimeout(() => setCelebratingGoal(null), 3000);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-gray-500">Loading goals...</div>
      </div>
    );
  }

  const activeGoals = goals?.filter((g) => !g.isCompleted) || [];
  const completedGoals = goals?.filter((g) => g.isCompleted) || [];

  // Calculate totals
  const totalSaved = activeGoals.reduce((sum, g) => sum + g.currentAmount, 0);
  const totalTarget = activeGoals.reduce((sum, g) => sum + g.targetAmount, 0);
  const overallProgress = totalTarget > 0 ? (totalSaved / totalTarget) * 100 : 0;

  return (
    <div className="max-w-6xl mx-auto p-4 pb-20">
      {/* Header */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Goals</h1>
          <p className="text-sm text-gray-600 mt-1">Track your household savings goals</p>
        </div>
        <button
          onClick={handleCreateGoal}
          className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors"
        >
          + New Goal
        </button>
      </div>

      {/* Overall progress summary */}
      {activeGoals.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <h3 className="text-sm font-medium text-gray-700 mb-4">Overall Progress</h3>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div>
              <div className="text-2xl font-bold text-purple-600">
                {formatCurrency(totalSaved)}
              </div>
              <div className="text-xs text-gray-600">Saved</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">
                {formatCurrency(totalTarget)}
              </div>
              <div className="text-xs text-gray-600">Target</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-600">
                {activeGoals.length}
              </div>
              <div className="text-xs text-gray-600">Active Goals</div>
            </div>
          </div>

          {/* Overall progress bar */}
          <div className="relative h-3 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-purple-600 transition-all"
              style={{ width: `${Math.min(overallProgress, 100)}%` }}
            />
          </div>
          <div className="text-xs text-gray-600 mt-1 text-right">
            {overallProgress.toFixed(1)}% of total
          </div>
        </div>
      )}

      {/* Goals list */}
      {!goals || goals.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
          <div className="text-gray-400 text-5xl mb-4">🎯</div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            No goals yet
          </h3>
          <p className="text-gray-600 mb-4">
            Create savings goals to track your progress together as a household
          </p>
          <button
            onClick={handleCreateGoal}
            className="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700 transition-colors"
          >
            Create Your First Goal
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Active goals */}
          {activeGoals.map((goal) => (
            <GoalCard
              key={goal.id}
              goal={goal}
              onEdit={() => handleEditGoal(goal)}
              onDelete={() => handleDeleteGoal(goal.id, goal.name)}
              onAddFunds={() => handleAddFunds(goal)}
              isCelebrating={celebratingGoal === goal.id}
            />
          ))}

          {/* Completed goals toggle */}
          {completedGoals.length > 0 && (
            <button
              onClick={() => setShowCompleted(!showCompleted)}
              className="w-full py-3 text-sm text-gray-600 hover:text-gray-900 flex items-center justify-center gap-2"
            >
              {showCompleted ? '▲ Hide' : '▼ Show'} {completedGoals.length} completed goal
              {completedGoals.length !== 1 ? 's' : ''}
            </button>
          )}

          {/* Completed goals */}
          {showCompleted &&
            completedGoals.map((goal) => (
              <GoalCard
                key={goal.id}
                goal={goal}
                onEdit={() => handleEditGoal(goal)}
                onDelete={() => handleDeleteGoal(goal.id, goal.name)}
                onAddFunds={() => handleAddFunds(goal)}
                isCompleted
              />
            ))}
        </div>
      )}

      {/* Info box */}
      <div className="mt-6 bg-purple-50 border border-purple-200 rounded-lg p-4">
        <h4 className="font-semibold text-purple-900 mb-2">About Goals:</h4>
        <ul className="text-sm text-purple-800 space-y-1">
          <li>• Goals are shared across your household</li>
          <li>• Add funds to track your progress over time</li>
          <li>• Set target dates to see monthly contribution needs</li>
          <li>• Celebrate together when you reach your goals!</li>
        </ul>
      </div>

      {/* Modals */}
      {showModal && (
        <GoalModal
          goal={editingGoal}
          onClose={() => {
            setShowModal(false);
            setEditingGoal(null);
          }}
        />
      )}

      {addFundsGoal && (
        <AddFundsModal
          goal={addFundsGoal}
          onClose={() => setAddFundsGoal(null)}
          onComplete={handleGoalCompleted}
        />
      )}
    </div>
  );
}

interface GoalCardProps {
  goal: Goal;
  onEdit: () => void;
  onDelete: () => void;
  onAddFunds: () => void;
  isCompleted?: boolean;
  isCelebrating?: boolean;
}

function GoalCard({
  goal,
  onEdit,
  onDelete,
  onAddFunds,
  isCompleted = false,
  isCelebrating = false,
}: GoalCardProps) {
  const daysUntil = getDaysUntilTarget(goal.targetDate);
  const monthlyNeeded = getMonthlyContributionNeeded(goal.remaining, goal.targetDate);

  return (
    <div
      className={`bg-white rounded-lg shadow-sm border transition-all ${
        isCelebrating
          ? 'border-green-400 ring-2 ring-green-200 animate-pulse'
          : isCompleted
          ? 'border-green-200 bg-green-50'
          : 'border-gray-200'
      }`}
    >
      {/* Goal header */}
      <div className="p-5">
        <div className="flex items-start justify-between mb-4">
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
              <h3 className="font-semibold text-gray-900">{goal.name}</h3>
              <div className="text-sm text-gray-600">
                {isCompleted ? (
                  <span className="text-green-600 font-medium">
                    ✓ Completed {goal.completedAt ? new Date(goal.completedAt).toLocaleDateString() : ''}
                  </span>
                ) : (
                  <span>
                    {formatCurrency(goal.currentAmount)} of {formatCurrency(goal.targetAmount)}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={onEdit}
              className="text-sm text-purple-600 hover:text-purple-700 font-medium"
            >
              Edit
            </button>
            <button
              onClick={onDelete}
              className="text-sm text-red-600 hover:text-red-700 font-medium"
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
                isCompleted ? 'bg-green-500' : 'bg-purple-600'
              }`}
              style={{ width: `${Math.min(goal.percentComplete, 100)}%` }}
            />
          </div>
          <div className="flex justify-between items-center mt-1">
            <span className="text-xs text-gray-600">
              {goal.percentComplete.toFixed(1)}% complete
            </span>
            {!isCompleted && (
              <span className="text-xs font-medium text-purple-600">
                {formatCurrency(goal.remaining)} to go
              </span>
            )}
          </div>
        </div>

        {/* Target date & monthly contribution */}
        {!isCompleted && (goal.targetDate || monthlyNeeded) && (
          <div className="flex flex-wrap gap-3 mb-3">
            {goal.targetDate && (
              <div className="text-xs bg-gray-100 rounded-full px-3 py-1 text-gray-700">
                📅 {formatTargetDate(goal.targetDate)}
                {daysUntil !== null && (
                  <span className={daysUntil < 0 ? 'text-red-600' : ''}>
                    {daysUntil < 0
                      ? ` (${Math.abs(daysUntil)} days overdue)`
                      : daysUntil === 0
                      ? ' (today!)'
                      : ` (${daysUntil} days left)`}
                  </span>
                )}
              </div>
            )}
            {monthlyNeeded && monthlyNeeded > 0 && (
              <div className="text-xs bg-purple-100 rounded-full px-3 py-1 text-purple-700">
                💡 {formatCurrency(monthlyNeeded)}/month needed
              </div>
            )}
          </div>
        )}

        {/* Add funds button */}
        {!isCompleted && (
          <button
            onClick={onAddFunds}
            className="w-full mt-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
          >
            Add Funds
          </button>
        )}

        {/* Celebration message */}
        {isCelebrating && (
          <div className="mt-3 bg-green-100 border border-green-200 rounded-lg px-4 py-3 text-center">
            <span className="text-2xl">🎉</span>
            <p className="text-green-800 font-semibold mt-1">
              Congratulations! You've reached your goal!
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
