import { useEffect, useState, FormEvent } from 'react';
import {
  loyaltyApi,
  Reward,
  LoyaltyAccount,
  ManualTransaction,
  MANUAL_POINTS_CAP,
} from '../api/loyalty';
import { usersApi, AppUser } from '../api/users';
import { useAuthStore } from '../stores/authStore';
import { formatDateTime, fullName } from '../utils';
import Confirm from '../components/Confirm';
import Pagination from '../components/Pagination';

// Lignes d'audit affichées par page (le cumul de points reste global).
const AUDIT_PAGE_SIZE = 20;

type Tab = 'credit' | 'rewards' | 'audit';

export default function LoyaltyPage() {
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'ADMIN';

  const [tab, setTab] = useState<Tab>('credit');

  return (
    <div>
      <div style={{ marginBottom: 'var(--sp-4)' }}>
        <h1>Fidélité</h1>
        <div className="muted small">
          Créditez des points, gérez les récompenses et suivez les opérations manuelles.
        </div>
      </div>

      <div className="row gap-2" style={{ marginBottom: 'var(--sp-4)' }}>
        <TabBtn active={tab === 'credit'} onClick={() => setTab('credit')}>
          Créditer une cliente
        </TabBtn>
        {isAdmin && (
          <>
            <TabBtn active={tab === 'rewards'} onClick={() => setTab('rewards')}>
              Récompenses
            </TabBtn>
            <TabBtn active={tab === 'audit'} onClick={() => setTab('audit')}>
              Audit
            </TabBtn>
          </>
        )}
      </div>

      {tab === 'credit' && <CreditTab />}
      {tab === 'rewards' && isAdmin && <RewardsTab />}
      {tab === 'audit' && isAdmin && <AuditTab />}
    </div>
  );
}

function TabBtn({ active, onClick, children }: any) {
  return (
    <button
      className={active ? 'btn btn-gold btn-sm' : 'btn btn-outline btn-sm'}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────
//  Onglet 1 : créditer une cliente
// ─────────────────────────────────────────────────────────────────────────
function CreditTab() {
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<AppUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<AppUser | null>(null);
  const [account, setAccount] = useState<LoyaltyAccount | null>(null);

  const [points, setPoints] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  const runSearch = async (e: FormEvent) => {
    e.preventDefault();
    setSearching(true);
    setMessage(null);
    try {
      const res = await usersApi.findAll({ search: search.trim() || undefined, limit: 50 });
      // Le personnel n'a pas de compte fidélité à créditer
      setResults(res.data.filter((u) => u.role === 'CLIENT'));
    } catch {
      setMessage({ text: 'Recherche impossible.', ok: false });
    } finally {
      setSearching(false);
    }
  };

  const selectUser = async (u: AppUser) => {
    setSelected(u);
    setAccount(null);
    setMessage(null);
    try {
      const acc = await loyaltyApi.getClientAccount(u.id);
      setAccount(acc);
    } catch {
      setMessage({ text: 'Compte fidélité introuvable pour cette cliente.', ok: false });
    }
  };

  const submitCredit = async (e: FormEvent) => {
    e.preventDefault();
    if (!selected) return;

    const n = parseInt(points, 10);
    if (!n || n < 1) {
      setMessage({ text: 'Saisissez un nombre de points valide.', ok: false });
      return;
    }
    if (n > MANUAL_POINTS_CAP) {
      setMessage({ text: `Un ajout manuel ne peut dépasser ${MANUAL_POINTS_CAP} points.`, ok: false });
      return;
    }

    setSaving(true);
    setMessage(null);
    try {
      await loyaltyApi.addManualPoints({
        userId: selected.id,
        points: n,
        reason: reason.trim() || undefined,
      });
      setPoints('');
      setReason('');
      // Recharge le solde pour refléter le crédit
      const acc = await loyaltyApi.getClientAccount(selected.id);
      setAccount(acc);
      setMessage({ text: `${n} points crédités à ${fullName(selected)}.`, ok: true });
    } catch (e: any) {
      const msg = e.response?.data?.message;
      setMessage({
        text: Array.isArray(msg) ? msg.join(', ') : msg || 'Crédit impossible.',
        ok: false,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={styles.twoCols}>
      {/* Recherche */}
      <section className="card">
        <div className="card-pad" style={styles.sectionHead}>
          <h2>Rechercher une cliente</h2>
        </div>
        <div className="card-pad">
          <form onSubmit={runSearch} className="row gap-2">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Nom, email ou téléphone…"
            />
            <button type="submit" className="btn btn-outline" disabled={searching}>
              {searching ? '…' : 'Chercher'}
            </button>
          </form>

          {results.length > 0 && (
            <div style={{ marginTop: 'var(--sp-3)' }}>
              {results.slice(0, 8).map((u) => (
                <button
                  key={u.id}
                  onClick={() => selectUser(u)}
                  style={{
                    ...styles.resultRow,
                    background: selected?.id === u.id ? 'var(--gold-soft)' : 'transparent',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 500 }}>{fullName(u)}</div>
                    <div className="small muted">{u.email}</div>
                  </div>
                  {u.phone && <div className="small muted">{u.phone}</div>}
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Crédit */}
      <section className="card">
        <div className="card-pad" style={styles.sectionHead}>
          <h2>Créditer des points</h2>
        </div>
        <div className="card-pad">
          {!selected ? (
            <div className="muted small">Sélectionnez une cliente pour créditer son compte.</div>
          ) : (
            <>
              <div style={styles.accountBox}>
                <div>
                  <div className="label">Cliente</div>
                  <div style={{ fontWeight: 600 }}>{fullName(selected)}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="label">Solde actuel</div>
                  <div className="serif" style={{ fontSize: 26, color: 'var(--gold-deep)' }}>
                    {account ? account.pointsBalance : '—'}
                  </div>
                </div>
              </div>

              <form onSubmit={submitCredit} style={{ marginTop: 'var(--sp-4)' }}>
                <label className="label" style={{ display: 'block', marginBottom: 5 }}>
                  Points à créditer (max {MANUAL_POINTS_CAP})
                </label>
                <input
                  type="number"
                  min="1"
                  max={MANUAL_POINTS_CAP}
                  value={points}
                  onChange={(e) => setPoints(e.target.value)}
                  placeholder="20"
                  required
                />

                <label className="label" style={{ display: 'block', margin: '12px 0 5px' }}>
                  Motif
                </label>
                <input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Geste commercial, erreur de caisse…"
                />

                <button
                  type="submit"
                  className="btn btn-gold"
                  style={{ marginTop: 'var(--sp-4)', width: '100%' }}
                  disabled={saving}
                >
                  {saving ? 'Crédit en cours…' : 'Créditer les points'}
                </button>
              </form>

              <div className="small muted" style={{ marginTop: 'var(--sp-3)' }}>
                Chaque ajout manuel est tracé et consultable dans l'audit.
              </div>
            </>
          )}

          {message && (
            <div
              style={{
                ...styles.message,
                background: message.ok ? 'var(--success-bg)' : 'var(--danger-bg)',
                color: message.ok ? 'var(--success)' : 'var(--danger)',
              }}
            >
              {message.text}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
//  Onglet 2 : récompenses
// ─────────────────────────────────────────────────────────────────────────
function RewardsTab() {
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [cost, setCost] = useState('');
  const [saving, setSaving] = useState(false);

  const [toDeactivate, setToDeactivate] = useState<Reward | null>(null);
  const [acting, setActing] = useState(false);

  const load = async () => {
    setIsLoading(true);
    try {
      setError(null);
      setRewards(await loyaltyApi.getAllRewards());
    } catch {
      setError('Impossible de charger les récompenses.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await loyaltyApi.createReward({
        name: name.trim(),
        description: description.trim() || undefined,
        pointsCost: parseInt(cost, 10),
      });
      setName('');
      setDescription('');
      setCost('');
      await load();
    } catch (e: any) {
      const msg = e.response?.data?.message;
      setError(Array.isArray(msg) ? msg.join(', ') : msg || 'Création impossible.');
    } finally {
      setSaving(false);
    }
  };

  const runDeactivate = async () => {
    if (!toDeactivate) return;
    setActing(true);
    try {
      await loyaltyApi.deactivateReward(toDeactivate.id);
      setToDeactivate(null);
      await load();
    } catch (e: any) {
      setError(e.response?.data?.message || 'Action impossible.');
      setToDeactivate(null);
    } finally {
      setActing(false);
    }
  };

  return (
    <div style={styles.twoCols}>
      <section className="card">
        <div className="card-pad" style={styles.sectionHead}>
          <h2>Nouvelle récompense</h2>
        </div>
        <form onSubmit={submit} className="card-pad">
          <label className="label" style={{ display: 'block', marginBottom: 5 }}>Nom</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Soin visage offert"
            required
          />

          <label className="label" style={{ display: 'block', margin: '12px 0 5px' }}>Description</label>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optionnel"
          />

          <label className="label" style={{ display: 'block', margin: '12px 0 5px' }}>Coût en points</label>
          <input
            type="number"
            min="1"
            value={cost}
            onChange={(e) => setCost(e.target.value)}
            placeholder="300"
            required
          />

          <button type="submit" className="btn btn-gold" style={{ marginTop: 'var(--sp-4)', width: '100%' }} disabled={saving}>
            {saving ? 'Création…' : 'Créer la récompense'}
          </button>

          {error && <div style={{ ...styles.message, background: 'var(--danger-bg)', color: 'var(--danger)' }}>{error}</div>}
        </form>
      </section>

      <section className="card">
        <div className="row between card-pad" style={styles.sectionHead}>
          <h2>Récompenses existantes</h2>
          <button className="btn btn-outline btn-sm" onClick={load}>Actualiser</button>
        </div>

        {isLoading ? (
          <div style={{ display: 'grid', placeItems: 'center', height: 120 }}>
            <div className="spinner" />
          </div>
        ) : rewards.length === 0 ? (
          <div className="card-pad muted small">Aucune récompense.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Nom</th>
                <th style={{ textAlign: 'right' }}>Coût</th>
                <th>Statut</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rewards.map((r) => (
                <tr key={r.id} style={{ opacity: r.active ? 1 : 0.55 }}>
                  <td>
                    <div style={{ fontWeight: 500 }}>{r.name}</div>
                    {r.description && <div className="small muted">{r.description}</div>}
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--gold-deep)' }}>
                    {r.pointsCost} pts
                  </td>
                  <td>
                    <span className={`badge ${r.active ? 'badge-success' : 'badge-muted'}`}>
                      {r.active ? 'Active' : 'Désactivée'}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {r.active ? (
                      <button className="btn btn-danger btn-sm" onClick={() => setToDeactivate(r)}>
                        Désactiver
                      </button>
                    ) : (
                      <span className="muted small">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <Confirm
        open={!!toDeactivate}
        title={`Désactiver « ${toDeactivate?.name ?? ''} »`}
        message="Cette récompense ne sera plus échangeable par les clientes."
        confirmLabel="Désactiver"
        danger
        loading={acting}
        onConfirm={runDeactivate}
        onCancel={() => setToDeactivate(null)}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
//  Onglet 3 : audit des ajouts manuels
// ─────────────────────────────────────────────────────────────────────────
function AuditTab() {
  const [rows, setRows] = useState<ManualTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const load = async () => {
    setIsLoading(true);
    try {
      setError(null);
      setRows(await loyaltyApi.auditManual());
    } catch {
      setError("Impossible de charger l'audit.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  // Le cumul porte sur TOUTES les opérations, pas sur la page affichée :
  // un total d'audit partiel serait trompeur.
  const total = rows.reduce((n, r) => n + r.pointsDelta, 0);

  const totalPages = Math.max(1, Math.ceil(rows.length / AUDIT_PAGE_SIZE));
  const visible = rows.slice((page - 1) * AUDIT_PAGE_SIZE, page * AUDIT_PAGE_SIZE);

  return (
    <section className="card">
      <div className="row between card-pad" style={styles.sectionHead}>
        <div>
          <h2>Ajouts manuels</h2>
          <div className="small muted">
            {rows.length} opération(s) · {total} points crédités au total
          </div>
        </div>
        <button className="btn btn-outline btn-sm" onClick={load}>Actualiser</button>
      </div>

      {error && <div className="card-pad" style={{ color: 'var(--danger)' }}>{error}</div>}

      {isLoading ? (
        <div style={{ display: 'grid', placeItems: 'center', height: 160 }}>
          <div className="spinner" />
        </div>
      ) : rows.length === 0 ? (
        <div className="card-pad muted small">Aucun ajout manuel enregistré.</div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Cliente</th>
              <th>Par</th>
              <th>Motif</th>
              <th style={{ textAlign: 'right' }}>Points</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => (
              <tr key={r.id}>
                <td className="small muted">{formatDateTime(r.createdAt)}</td>
                <td>
                  <div style={{ fontWeight: 500 }}>{fullName(r.owner)}</div>
                  <div className="small muted">{r.owner?.email}</div>
                </td>
                <td>
                  <div>{fullName(r.createdBy)}</div>
                  {r.createdBy?.role && (
                    <span className="badge badge-muted" style={{ marginTop: 2 }}>
                      {r.createdBy.role === 'ADMIN' ? 'Admin' : 'Personnel'}
                    </span>
                  )}
                </td>
                <td className="small">{r.reason || <span className="muted">—</span>}</td>
                <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--success)' }}>
                  +{r.pointsDelta}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {!isLoading && rows.length > 0 && (
        <Pagination
          page={page}
          totalPages={totalPages}
          total={rows.length}
          onChange={setPage}
          label="opération(s)"
        />
      )}
    </section>
  );
}

const styles: Record<string, React.CSSProperties> = {
  twoCols: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
    gap: 'var(--sp-4)',
    alignItems: 'start',
  },
  sectionHead: { borderBottom: '1px solid var(--border)' },
  resultRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    padding: '8px 10px',
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    cursor: 'pointer',
    textAlign: 'left',
    fontFamily: 'inherit',
    fontSize: 13,
  },
  accountBox: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 'var(--sp-3)',
    borderRadius: 'var(--radius-sm)',
    background: 'var(--surface-alt)',
  },
  message: {
    marginTop: 'var(--sp-3)',
    padding: '8px 10px',
    borderRadius: 'var(--radius-sm)',
    fontSize: 13,
  },
};
