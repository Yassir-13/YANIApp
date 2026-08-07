import { useEffect, useState, FormEvent } from 'react';
import { usersApi, AppUser, Role } from '../api/users';
import { useAuthStore } from '../stores/authStore';
import { formatDate, fullName } from '../utils';
import Confirm from '../components/Confirm';
import Pagination from '../components/Pagination';

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

  // Pagination servie par le backend (le filtre par rôle et la recherche
  // sont appliqués côté serveur : filtrer la page affichée donnerait faux).
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // Nombre d'administrateurs, sur TOUTE la base et non sur la page courante.
  // Sert à ne proposer « Promouvoir gérant » que si le poste est libre.
  const [adminCount, setAdminCount] = useState(0);

  // Changement de rôle en attente de confirmation
  const [pending, setPending] = useState<{ user: AppUser; role: Role } | null>(null);
  const [acting, setActing] = useState(false);

  // `submittedSearch` est le terme réellement envoyé au serveur : taper dans
  // le champ ne relance pas la requête, seule la validation le fait.
  const [submittedSearch, setSubmittedSearch] = useState('');

  const load = async (opts?: { page?: number; search?: string; role?: Role | 'ALL' }) => {
    const p = opts?.page ?? page;
    const s = opts?.search ?? submittedSearch;
    const r = opts?.role ?? roleFilter;

    setIsLoading(true);
    try {
      setError(null);
      const res = await usersApi.findAll({
        search: s || undefined,
        role: r === 'ALL' ? undefined : r,
        page: p,
      });
      setUsers(res.data);
      setTotal(res.total);
      setTotalPages(res.totalPages);

      // Une page vidée par une suppression ou un changement de filtre :
      // on recule plutôt que d'afficher un tableau vide trompeur.
      if (res.data.length === 0 && res.total > 0 && p > 1) {
        setPage(1);
        return load({ page: 1, search: s, role: r });
      }
    } catch {
      setError('Impossible de charger les utilisateurs.');
    } finally {
      setIsLoading(false);
    }
  };

  // Compte les administrateurs sur l'ensemble de la base (limit=1 : seul
  // `total` nous intéresse, on ne rapatrie aucune ligne inutile).
  const loadAdminCount = async () => {
    try {
      const res = await usersApi.findAll({ role: 'ADMIN', limit: 1 });
      setAdminCount(res.total);
    } catch {
      // Sans ce compteur, on n'affichera simplement pas « Promouvoir gérant » :
      // le backend refuse de toute façon un second administrateur.
      setAdminCount(0);
    }
  };

  useEffect(() => {
    load({ page: 1 });
    loadAdminCount();
  }, []);

  const runSearch = (e: FormEvent) => {
    e.preventDefault();
    const s = search.trim();
    setSubmittedSearch(s);
    setPage(1);
    load({ page: 1, search: s });
  };

  const changeRoleFilter = (r: Role | 'ALL') => {
    setRoleFilter(r);
    setPage(1);
    load({ page: 1, role: r });
  };

  const goToPage = (p: number) => {
    setPage(p);
    load({ page: p });
  };

  // La liste affichée est déjà filtrée et paginée par le serveur.
  const visible = users;

  const runRoleChange = async () => {
    if (!pending) return;
    setActing(true);
    try {
      await usersApi.updateRole(pending.user.id, pending.role);
      setPending(null);
      await load();
      // Un changement de rôle peut créer ou libérer le poste d'administrateur.
      await loadAdminCount();
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
        <button className="btn btn-outline btn-sm" onClick={() => load()}>
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
                setSubmittedSearch('');
                setPage(1);
                load({ page: 1, search: '' });
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
              onClick={() => changeRoleFilter(f.key)}
              className={roleFilter === f.key ? 'btn btn-gold btn-sm' : 'btn btn-outline btn-sm'}
            >
              {f.label}
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

          <Pagination
            page={page}
            totalPages={totalPages}
            total={total}
            onChange={goToPage}
            label="utilisateur(s)"
          />
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
