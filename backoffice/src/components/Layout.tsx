import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { fullName } from '../utils';

// Navigation principale. `adminOnly` masque l'entrée pour le rôle STAFF.
const NAV = [
  { to: '/', label: 'Tableau de bord', icon: '◇', end: true },
  { to: '/orders', label: 'Commandes', icon: '▤' },
  { to: '/appointments', label: 'Rendez-vous', icon: '▦' },
  { to: '/catalog', label: 'Catalogue', icon: '▣' },
  { to: '/loyalty', label: 'Fidélité', icon: '◈' },
  { to: '/users', label: 'Utilisateurs', icon: '◉', adminOnly: true },
];

export default function Layout() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const visibleNav = NAV.filter((n) => !n.adminOnly || user?.role === 'ADMIN');

  return (
    <div style={styles.shell}>
      {/* ── Barre latérale ── */}
      <aside style={styles.sidebar}>
        <div style={styles.brand}>
          <div style={styles.brandName} className="serif">Yani Concept</div>
          <div style={styles.brandSub} className="label">Administration</div>
        </div>

        <nav style={styles.nav}>
          {visibleNav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              style={({ isActive }) => ({
                ...styles.navLink,
                ...(isActive ? styles.navLinkActive : {}),
              })}
            >
              <span style={styles.navIcon}>{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* ── Pied : utilisateur connecté ── */}
        <div style={styles.userBox}>
          <div style={styles.userName}>{fullName(user)}</div>
          <div style={styles.userRole} className="small">
            {user?.role === 'ADMIN' ? 'Administrateur' : 'Personnel'}
          </div>
          <button className="btn btn-outline btn-sm" style={{ marginTop: 8, width: '100%' }} onClick={handleLogout}>
            Se déconnecter
          </button>
        </div>
      </aside>

      {/* ── Contenu ── */}
      <main style={styles.main}>
        <Outlet />
      </main>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  shell: { display: 'flex', minHeight: '100vh' },
  sidebar: {
    width: 220,
    flexShrink: 0,
    background: '#14100c',
    display: 'flex',
    flexDirection: 'column',
    padding: '20px 12px',
    position: 'sticky',
    top: 0,
    height: '100vh',
  },
  brand: { padding: '0 8px 20px' },
  brandName: { color: '#f5efe1', fontSize: 20, lineHeight: 1.2 },
  brandSub: { color: '#d8a848', marginTop: 2, fontSize: 10 },
  nav: { display: 'flex', flexDirection: 'column', gap: 2, flex: 1 },
  navLink: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '9px 10px',
    borderRadius: 6,
    color: 'rgba(245,239,225,0.65)',
    textDecoration: 'none',
    fontSize: 13,
    fontWeight: 500,
    transition: 'background 0.15s, color 0.15s',
  },
  navLinkActive: {
    background: 'rgba(216,168,72,0.14)',
    color: '#e4c15e',
  },
  navIcon: { fontSize: 12, opacity: 0.8, width: 14 },
  userBox: {
    borderTop: '1px solid rgba(255,255,255,0.08)',
    paddingTop: 12,
    marginTop: 12,
  },
  userName: { color: '#f5efe1', fontSize: 13, fontWeight: 600 },
  userRole: { color: 'rgba(245,239,225,0.5)' },
  main: { flex: 1, padding: 'var(--sp-5)', minWidth: 0 },
};
