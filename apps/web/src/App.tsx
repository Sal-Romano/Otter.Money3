import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/auth';

// Pages
import Login from './pages/Login';
import Register from './pages/Register';
import JoinHousehold from './pages/JoinHousehold';
import Dashboard from './pages/Dashboard';
import Layout from './components/Layout';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      {/* Public routes */}
      <Route
        path="/login"
        element={
          <PublicRoute>
            <Login />
          </PublicRoute>
        }
      />
      <Route
        path="/register"
        element={
          <PublicRoute>
            <Register />
          </PublicRoute>
        }
      />
      <Route
        path="/join/:inviteCode?"
        element={
          <PublicRoute>
            <JoinHousehold />
          </PublicRoute>
        }
      />

      {/* Protected routes */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="transactions" element={<div className="p-4">Transactions - Coming Soon</div>} />
        <Route path="accounts" element={<div className="p-4">Accounts - Coming Soon</div>} />
        <Route path="budget" element={<div className="p-4">Budget - Coming Soon</div>} />
        <Route path="settings" element={<div className="p-4">Settings - Coming Soon</div>} />
      </Route>

      {/* Catch all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
