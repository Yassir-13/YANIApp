import React, { useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

// Polices embarquées dans le build, et non chargées depuis Google Fonts.
//
// C'était la SEULE ressource externe de la page. Tant qu'elle existait, la
// question des jetons en `localStorage` restait ouverte : un script tiers
// compromis les aurait lus. Décision du 2026-08-14 (I33) — on assume le
// `localStorage`, mais on ferme la porte d'entrée.
//
// Effet de bord bienvenu : le backoffice s'ouvre sans connexion vers l'extérieur
// et n'expose plus l'adresse IP de l'institut à un tiers à chaque chargement.
import '@fontsource/cormorant-garamond/600.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';

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
          {/* Réservée à l'administratrice : cacher le lien du menu ne suffisait
              pas, l'adresse tapée à la main ouvrait la page. */}
          <Route
            path="/users"
            element={
              <RequireAuth roles={['ADMIN']}>
                <UsersPage />
              </RequireAuth>
            }
          />
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
