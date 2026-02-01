import { Link } from 'react-router-dom';
import { useGoalSummary, formatCurrency } from '../hooks/useGoals';

export default function GoalsWidget() {
  const { data: summary, isLoading } = useGoalSummary();

  if (isLoading) {
    return (
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Savings Goals</h2>
          <Link to="/goals" className="text-sm text-primary">
            View all
          </Link>
        </div>
        <div className="card">
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="h-10 w-10 animate-pulse rounded-full bg-gray-200" />
                <div className="flex-1">
                  <div className="h-4 w-24 animate-pulse rounded bg-gray-200" />
                  <div className="mt-2 h-2 animate-pulse rounded bg-gray-200" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const hasGoals = summary && summary.goals.length > 0;

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-semibold text-gray-900">Savings Goals</h2>
        <Link to="/goals" className="text-sm text-primary">
          {hasGoals ? 'View all' : 'Create goal'}
        </Link>
      </div>
      <div className="card">
        {hasGoals ? (
          <div className="space-y-4">
            {/* Overall progress */}
            {summary.totalActiveGoals > 0 && (
              <div className="pb-3 border-b border-gray-200">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-600">Total Saved</span>
                  <span className="font-medium text-gray-900">
                    {formatCurrency(summary.totalSaved)} / {formatCurrency(summary.totalTarget)}
                  </span>
                </div>
                <div className="relative h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="absolute inset-y-0 left-0 rounded-full bg-purple-600 transition-all"
                    style={{ width: `${Math.min(summary.overallProgress, 100)}%` }}
                  />
                </div>
              </div>
            )}

            {/* Individual goals */}
            {summary.goals.map((goal) => (
              <div key={goal.id}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span
                      className="text-lg flex items-center justify-center w-8 h-8 rounded-full"
                      style={{
                        backgroundColor: goal.color ? `${goal.color}20` : '#f3f4f6',
                      }}
                    >
                      {goal.icon || '🎯'}
                    </span>
                    <span className="text-sm font-medium text-gray-900">{goal.name}</span>
                  </div>
                  <span className="text-sm text-gray-600">
                    {formatCurrency(goal.currentAmount)} / {formatCurrency(goal.targetAmount)}
                  </span>
                </div>
                <div className="relative h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="absolute inset-y-0 left-0 rounded-full bg-purple-600 transition-all"
                    style={{ width: `${Math.min(goal.percentComplete, 100)}%` }}
                  />
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-xs text-gray-500">
                    {goal.percentComplete.toFixed(0)}% complete
                  </span>
                  {goal.targetDate && (
                    <span className="text-xs text-gray-500">
                      Due {new Date(goal.targetDate).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                  )}
                </div>
              </div>
            ))}

            {/* View more link */}
            {summary.totalActiveGoals > 3 && (
              <Link
                to="/goals"
                className="block text-center text-sm text-primary hover:text-primary-dark pt-2"
              >
                View {summary.totalActiveGoals - 3} more goal{summary.totalActiveGoals - 3 !== 1 ? 's' : ''}
              </Link>
            )}

            {/* Completed this month */}
            {summary.completedThisMonth > 0 && (
              <div className="pt-3 border-t border-gray-200 text-center">
                <span className="text-sm text-green-600">
                  🎉 {summary.completedThisMonth} goal{summary.completedThisMonth !== 1 ? 's' : ''} completed this month!
                </span>
              </div>
            )}
          </div>
        ) : (
          <div className="py-8 text-center">
            <div className="text-4xl mb-2">🎯</div>
            <p className="text-sm text-gray-500 mb-3">
              Set savings goals to track your progress together
            </p>
            <Link
              to="/goals"
              className="inline-block text-sm text-primary hover:text-primary-dark font-medium"
            >
              Create a Goal →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
