import { useAuthStore } from '../stores/auth';

export default function Dashboard() {
  const { user, household } = useAuthStore();

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
        <p className="mt-1 text-3xl font-bold">$0.00</p>
        <p className="mt-1 text-sm opacity-80">
          <span className="text-success-300">+$0.00</span> this month
        </p>
      </div>

      {/* Quick Stats */}
      <div className="mb-6 grid grid-cols-2 gap-3">
        <div className="card">
          <p className="text-xs text-gray-500">Assets</p>
          <p className="text-lg font-semibold text-gray-900">$0.00</p>
        </div>
        <div className="card">
          <p className="text-xs text-gray-500">Liabilities</p>
          <p className="text-lg font-semibold text-gray-900">$0.00</p>
        </div>
      </div>

      {/* Recent Transactions */}
      <section className="mb-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Recent Transactions</h2>
          <a href="/transactions" className="text-sm text-primary">
            View all
          </a>
        </div>
        <div className="card">
          <p className="py-8 text-center text-sm text-gray-500">
            No transactions yet. Connect an account to get started!
          </p>
        </div>
      </section>

      {/* Budget Status */}
      <section className="mb-6">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Budget Status</h2>
          <a href="/budget" className="text-sm text-primary">
            View all
          </a>
        </div>
        <div className="card">
          <p className="py-8 text-center text-sm text-gray-500">
            No budget set. Create one to track your spending!
          </p>
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
