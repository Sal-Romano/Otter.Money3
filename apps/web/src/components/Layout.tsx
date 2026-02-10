import { Outlet, NavLink } from 'react-router-dom';
import { clsx } from 'clsx';

const navItems = [
  { to: '/', label: 'Home', icon: HomeIcon },
  { to: '/transactions', label: 'Transactions', icon: ListIcon },
  { to: '/accounts', label: 'Accounts', icon: WalletIcon },
  { to: '/analytics', label: 'Analytics', icon: AnalyticsIcon },
  { to: '/settings', label: 'Settings', icon: SettingsIcon },
];

export default function Layout() {
  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Desktop Left Sidebar */}
      <aside className="hidden md:flex md:w-[72px] md:fixed md:inset-y-0 md:left-0 md:z-50 md:flex-col md:items-center md:border-r md:border-gray-200 md:bg-white md:py-4">
        {/* Logo */}
        <div className="mb-6">
          <img
            src="/images/otters_logo_vector_nobg.svg"
            alt="Otter Money"
            className="h-10 w-10"
          />
        </div>

        {/* Navigation */}
        <nav className="flex flex-1 flex-col items-center gap-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                clsx(
                  'flex flex-col items-center justify-center w-16 py-2 rounded-lg text-xs transition-colors',
                  isActive
                    ? 'text-primary bg-primary/10'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                )
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon className="mb-1 h-5 w-5" filled={isActive} />
                  <span className="text-[10px]">{item.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* Main Content */}
      <div className="flex min-w-0 flex-1 flex-col overflow-x-hidden md:ml-[72px] md:mr-[72px]">
        <main className="flex-1 pb-20 md:pb-6">
          <div className="md:mx-auto md:max-w-2xl lg:max-w-3xl">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Desktop Right Pane */}
      <aside className="hidden md:flex md:w-[72px] md:fixed md:inset-y-0 md:right-0 md:z-50 md:flex-col md:items-center md:justify-center md:border-l md:border-gray-200 md:bg-white">
        <div className="flex flex-col items-center text-center px-2">
          <img
            src="/images/otter_swimming_vector.svg"
            alt=""
            className="h-8 w-8 mb-2 opacity-50"
          />
          <span className="text-[9px] text-gray-400 leading-tight">
            Wally AI
            <br />
            Coming Soon
          </span>
        </div>
      </aside>

      {/* Mobile Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 border-t border-gray-200 bg-white pb-safe md:hidden">
        <div className="mx-auto flex max-w-lg items-center justify-around">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                clsx(
                  'flex flex-1 flex-col items-center py-2 text-xs transition-colors',
                  isActive ? 'text-primary' : 'text-gray-500 hover:text-gray-700'
                )
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon className="mb-1 h-6 w-6" filled={isActive} />
                  <span>{item.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}

// Simple icon components
function HomeIcon({ className, filled }: { className?: string; filled?: boolean }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      {filled ? (
        <path
          fill="currentColor"
          d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
        />
      ) : (
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
        />
      )}
    </svg>
  );
}

function ListIcon({ className, filled }: { className?: string; filled?: boolean }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        fill={filled ? 'currentColor' : 'none'}
        d="M4 6h16M4 12h16M4 18h16"
      />
    </svg>
  );
}

function WalletIcon({ className, filled }: { className?: string; filled?: boolean }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        fill={filled ? 'currentColor' : 'none'}
        d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
      />
    </svg>
  );
}

function AnalyticsIcon({ className, filled }: { className?: string; filled?: boolean }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        fill={filled ? 'currentColor' : 'none'}
        d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        fill={filled ? 'currentColor' : 'none'}
        d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z"
      />
    </svg>
  );
}

function SettingsIcon({ className, filled }: { className?: string; filled?: boolean }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        fill={filled ? 'currentColor' : 'none'}
        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}
