import { useEffect, useState, useMemo, FormEvent } from 'react';
import { usersApi, AppUser, Role } from '../api/users';
import { useAuthStore } from '../stores/authStore';
import { formatDate, fullName } from '../utils';
import Confirm from '../components/Confirm';

const ROLE_META: Record<Role, { label: string; badge: string }> = {
  CLIENT: { label: 'Cliente', badge: 'badge-muted' },
  STAFF: { label: 'Personnel', badge: 'badge-info' },
  ADMIN: { label: 'Administrateur', badge: 'badge-warning' },
};

const ROLE_FILTERS: { key: Role | 'ALL'; label: string }[] = [
  { key: 'ALL', label: 'Tous' },
  { key: 'CLIENT', label: 'Clientes' },
  { key: 'STAFF', label: 'Personnel' },
  { key: 'ADMIN', label: 'Administrateur' },
];

export default function UsersPage() {
  const me = useAuthStore((s) => s.user);

  const [users, setUsers] = useState<AppUser[]>([]);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<Role | 'ALL'>('ALL');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Changement de rôle en attente de confirmation
  const [pending, setPending] = useState<{ user: AppUser; role: Role } | null>(null);
  const [acting, setActing] = useState(false);

  const load = async (q?: string) => {
    setIsLoading(true);
    try {
      setError(null);
      setUsers(await usersApi.findAll(q));
    } catch {
      setError('Impossible de charger les utilisateurs.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const runSearch = (e: FormEvent) => {
    e.preventDefault();
    load(search.trim() || undefined);
  };

  const visible = useMemo(
    () => (roleFilter === 'ALL' ? users : users.filter((u) => u.role === roleFilter)),
    [users, roleFilter]
  );

  const counts = useMemo(() => {
    const c: Record<string, number> = { ALL: users.length };
    for (const u of users) c[u.role] = (c[u.role] ?? 0) + 1;
    return c;
  }, [users]);

  const adminCount = counts.ADMIN ?? 0;

  const runRoleChange = async () => {
    if (!pending) return;
    setActing(true);
    try {
      await usersApi.updateRole(pending.user.id, pending.role);
      setPending(null);
      await load(search.trim() || undefined);
    } catch (e: any) {
      setError(e.response?.data?.message || 'Changement de rôle impossible.');
      setPending(null);
    } finally {
      setActing(false);
    }
  };

  // Le rôle qu'on peut proposer en un clic, selon le rôle actuel.
  // Règles backend : un seul ADMIN, et le dernier admin ne peut être rétrogradé.
  const nextRoles = (u: AppUser): { role: Role; label: string; danger?: boolean }[] => {
    if (u.id === me?.id) return []; // on ne modifie pas son propre rôle
    switch (u.role) {
      case 'CLIENT':
        return [{ role: 'STAFF', label: 'Promouvoir personnel' }];
      case 'STAFF':
        return [
          { role: 'CLIENT', label: 'Rétrograder cliente', danger: true },
          // Promouvoir un admin n'est possible que si le poste est libre
          ...(adminCount === 0
            ? [{ role: 'ADMIN' as Role, label: 'Promouvoir gérant' }]
            : []),
        ];
      case 'ADMIN':
        return [{ role: 'STAFF', label: 'Rétrograder personnel', danger: true }];
      default:
        return [];
    }
  };

  return (
    <div>
      <div className="row between" style={{ marginBottom: 'var(--sp-4)' }}>
        <div>
          <h1>Utilisateurs</h1>
          <div className="muted small">
            Clientes et personnel de l'institut. Un seul administrateur est autorisé.
          </div>
        </div>
        <button className="btn btn-outline btn-sm" onClick={() => load(search.trim() || undefined)}>
          Actualiser
        </button>
      </div>

      {/* Recherche + filtres */}
      <div className="card card-pad" style={{ marginBottom: 'var(--sp-4)' }}>
        <form onSubmit={runSearch} className="row gap-2" style={{ marginBottom: 'var(--sp-3)' }}>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher par nom, email ou téléphone…"
            style={{ maxWidth: 320 }}
          />
          <button type="submit" className="btn btn-outline">Chercher</button>
          {search && (
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => {
                setSearch('');
                load();
              }}
            >
              Réinitialiser
            </button>
          )}
        </form>

        <div className="row gap-2" style={{ flexWrap: 'wrap' }}>
          {ROLE_FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setRoleFilter(f.key)}
              className={roleFilter === f.key ? 'btn btn-gold btn-sm' : 'btn btn-outline btn-sm'}
            >
              {f.label}
              {counts[f.key] > 0 && <span style={{ marginLeft: 6, opacity: 0.7 }}>{counts[f.key]}</span>}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="card card-pad" style={{ marginBottom: 'var(--sp-4)', color: 'var(--danger)' }}>
          {error}
        </div>
      )}

      {isLoading ? (
        <div style={{ display: 'grid', placeItems: 'center', height: 200 }}>
          <div className="spinner" />
        </div>
      ) : visible.length === 0 ? (
        <div className="card card-pad muted">Aucun utilisateur ne correspond.</div>
      ) : (
        <div className="card">
          <table>
            <thead>
              <tr>
                <th>Nom</th>
                <th>Email</th>
                <th>Téléphone</th>
                <th>Inscrit le</th>
                <th>Rôle</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((u) => {
                const meta = ROLE_META[u.role];
                const actions = nextRoles(u);
                const isMe = u.id === me?.id;

                return (
                  <tr key={u.id}>
                    <td>
                      <div style={{ fontWeight: 500 }}>
                        {fullName(u)}
                        {isMe && <span className="small muted"> (vous)</span>}
                      </div>
                    </td>
                    <td className="small">{u.email}</td>
                    <td className="small">
                      {u.phone ? (
                        <a href={`tel:${u.phone}`} style={styles.phone}>{u.phone}</a>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td className="small muted">{formatDate(u.createdAt)}</td>
                    <td>
                      <span className={`badge ${meta.badge}`}>{meta.label}</span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {actions.length === 0 ? (
                        <span className="muted small">—</span>
                      ) : (
                        <div className="row gap-2" style={{ justifyContent: 'flex-end' }}>
                          {actions.map((a) => (
                            <button
                              key={a.role}
                              className={a.danger ? 'btn btn-danger btn-sm' : 'btn btn-outline btn-sm'}
                              onClick={() => setPending({ user: u, role: a.role })}
                            >
                              {a.label}
                            </button>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Confirm
        open={!!pending}
        title="Changer le rôle"
        message={
          pending && (
            <>
              <strong>{fullName(pending.user)}</strong> deviendra{' '}
              <strong>{ROLE_META[pending.role].label.toLowerCase()}</strong>.
              {pending.role === 'ADMIN' && (
                <div style={{ marginTop: 8 }}>
                  Cette personne aura un accès complet : catalogue, récompenses, rôles.
                </div>
              )}
              {pending.role === 'STAFF' && pending.user.role === 'CLIENT' && (
                <div style={{ marginTop: 8 }}>
                  Elle pourra gérer les commandes, les rendez-vous et créditer des points.
                </div>
              )}
            </>
          )
        }
        confirmLabel="Changer le rôle"
        danger={pending?.role === 'CLIENT'}
        loading={acting}
        onConfirm={runRoleChange}
        onCancel={() => setPending(null)}
      />
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  phone: { color: 'var(--info)', textDecoration: 'none' },
};
