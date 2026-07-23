import React, { useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import './theme/index.css';
import { useAuthStore } from './stores/authStore';
import Layout from './components/Layout';
import RequireAuth from './components/RequireAuth';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import OrdersPage from './pages/OrdersPage';
import AppointmentsPage from './pages/AppointmentsPage';
import CatalogPage from './pages/CatalogPage';
import LoyaltyPage from './pages/LoyaltyPage';
import UsersPage from './pages/UsersPage';
import OpeningHoursPage from './pages/OpeningHoursPage';

function App() {
  const loadSession = useAuthStore((s) => s.loadSession);

  // Restaure la session au démarrage (token en localStorage → /auth/me)
  useEffect(() => {
    loadSession();
  }, [loadSession]);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route
          element={
            <RequireAuth>
              <Layout />
            </RequireAuth>
          }
        >
          <Route index element={<DashboardPage />} />
          <Route path="/orders" element={<OrdersPage />} />
          <Route path="/appointments" element={<AppointmentsPage />} />
          <Route path="/catalog" element={<CatalogPage />} />
          <Route path="/loyalty" element={<LoyaltyPage />} />
          <Route path="/hours" element={<OpeningHoursPage />} />
          <Route path="/users" element={<UsersPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
