import { useEffect, useState, FormEvent } from 'react';
import {
  loyaltyApi,
  Reward,
  Milestone,
  LoyaltyAccount,
  ManualTransaction,
  RewardVoucher,
  MANUAL_POINTS_CAP,
  MIN_VISIT_THRESHOLD,
  MAX_VISIT_THRESHOLD,
} from '../api/loyalty';
import { usersApi, AppUser } from '../api/users';
import { useAuthStore } from '../stores/authStore';
import { formatDateTime, fullName } from '../utils';
import Confirm from '../components/Confirm';
import Pagination from '../components/Pagination';

// Lignes d'audit affichées par page (le cumul de points reste global).
const AUDIT_PAGE_SIZE = 20;

// Remises affichées par page. Contrairement aux bons dus — bornés par ce qui
// reste à remettre — cette liste grossit sans fin : elle est paginée côté
// serveur dès maintenant.
const HONORED_PAGE_SIZE = 20;

type Tab = 'vouchers' | 'credit' | 'rewards' | 'milestones' | 'audit';

export default function LoyaltyPage() {
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'ADMIN';

  // « À honorer » en premier : c'est le geste du comptoir, pas de la gestion.
  const [tab, setTab] = useState<Tab>('vouchers');

  return (
    <div>
      <div style={{ marginBottom: 'var(--sp-4)' }}>
        <h1>Fidélité</h1>
        <div className="muted small">
          Remettez les récompenses dues, créditez des points, gérez le programme.
        </div>
      </div>

      <div className="row gap-2" style={{ marginBottom: 'var(--sp-4)' }}>
        <TabBtn active={tab === 'vouchers'} onClick={() => setTab('vouchers')}>
          À honorer
        </TabBtn>
        <TabBtn active={tab === 'credit'} onClick={() => setTab('credit')}>
          Créditer une cliente
        </TabBtn>
        {isAdmin && (
          <>
            <TabBtn active={tab === 'rewards'} onClick={() => setTab('rewards')}>
              Récompenses
            </TabBtn>
            <TabBtn active={tab === 'milestones'} onClick={() => setTab('milestones')}>
              Paliers de visites
            </TabBtn>
            <TabBtn active={tab === 'audit'} onClick={() => setTab('audit')}>
              Audit
            </TabBtn>
          </>
        )}
      </div>

      {tab === 'vouchers' && <VouchersTab />}
      {tab === 'credit' && <CreditTab />}
      {tab === 'rewards' && isAdmin && <RewardsTab />}
      {tab === 'milestones' && isAdmin && <MilestonesTab />}
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
//  Onglet 1 : les bons à honorer au comptoir
// ─────────────────────────────────────────────────────────────────────────
//
// Ce que l'institut doit aux clientes. Deux origines, une seule liste : une
// récompense offerte qu'une cliente a réclamée dans l'app, ou une récompense
// qu'elle a payée avec ses points. Avant, le premier cas disparaissait de
// partout à la réclamation, et le second n'apparaissait nulle part.
function VouchersTab() {
  const [pending, setPending] = useState<RewardVoucher[]>([]);
  const [honored, setHonored] = useState<RewardVoucher[]>([]);
  const [honoredTotal, setHonoredTotal] = useState(0);
  const [honoredPages, setHonoredPages] = useState(1);
  const [page, setPage] = useState(1);

  const [filter, setFilter] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [confirming, setConfirming] = useState<RewardVoucher | null>(null);
  const [saving, setSaving] = useState(false);

  const load = async (p = page) => {
    setIsLoading(true);
    try {
      setError(null);
      const [dus, remis] = await Promise.all([
        loyaltyApi.pendingVouchers(),
        loyaltyApi.honoredVouchers({ page: p, limit: HONORED_PAGE_SIZE }),
      ]);
      setPending(dus);
      setHonored(remis.data);
      setHonoredTotal(remis.total);
      setHonoredPages(remis.totalPages);
    } catch {
      setError('Impossible de charger les bons.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const confirmHonor = async () => {
    if (!confirming) return;
    setSaving(true);
    setMessage(null);
    try {
      const res = await loyaltyApi.honorVoucher(confirming.id);
      setMessage({ text: res.message, ok: true });
      setConfirming(null);
      await load(page);
    } catch (e: any) {
      setMessage({
        text: e.response?.data?.message || 'Remise impossible.',
        ok: false,
      });
      setConfirming(null);
    } finally {
      setSaving(false);
    }
  };

  // Filtre local : la liste des bons dus est courte par construction (elle ne
  // contient que ce qui reste à remettre), donc pas besoin d'aller-retour
  // serveur pour retrouver un code dicté par une cliente.
  const terme = filter.trim().toLowerCase();
  const visibles = terme
    ? pending.filter((v) =>
        [
          v.code,
          v.reward.name,
          fullName(v.account?.user),
          v.account?.user?.email ?? '',
        ]
          .join(' ')
          .toLowerCase()
          .includes(terme),
      )
    : pending;

  return (
    <div style={{ display: 'grid', gap: 'var(--sp-4)' }}>
      <section className="card">
        <div className="row between card-pad" style={styles.sectionHead}>
          <div>
            <h2>Récompenses à remettre</h2>
            <div className="small muted">
              {pending.length} bon(s) en attente
            </div>
          </div>
          <button className="btn btn-outline btn-sm" onClick={() => load(page)}>
            Actualiser
          </button>
        </div>

        {message && (
          <div
            className="card-pad small"
            style={{ color: message.ok ? 'var(--success)' : 'var(--danger)' }}
          >
            {message.text}
          </div>
        )}
        {error && <div className="card-pad" style={{ color: 'var(--danger)' }}>{error}</div>}

        <div className="card-pad">
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Code, nom de la cliente ou récompense…"
          />
        </div>

        {isLoading ? (
          <div style={{ display: 'grid', placeItems: 'center', height: 160 }}>
            <div className="spinner" />
          </div>
        ) : visibles.length === 0 ? (
          <div className="card-pad muted small">
            {pending.length === 0
              ? 'Aucune récompense en attente.'
              : 'Aucun bon ne correspond à cette recherche.'}
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Code</th>
                <th>Cliente</th>
                <th>Récompense</th>
                <th>Origine</th>
                <th>Depuis</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {visibles.map((v) => (
                <tr key={v.id}>
                  <td>
                    <span className="serif" style={styles.code}>{v.code}</span>
                  </td>
                  <td>
                    <div style={{ fontWeight: 500 }}>{fullName(v.account?.user)}</div>
                    <div className="small muted">{v.account?.user?.phone || v.account?.user?.email}</div>
                  </td>
                  <td>{v.reward.name}</td>
                  <td>
                    <span className="badge badge-muted">
                      {v.source === 'MILESTONE'
                        ? 'Offerte'
                        : `${v.pointsSpent} pts`}
                    </span>
                  </td>
                  <td className="small muted">{formatDateTime(v.createdAt)}</td>
                  <td style={{ textAlign: 'right' }}>
                    <button
                      className="btn btn-gold btn-sm"
                      onClick={() => setConfirming(v)}
                    >
                      Remis
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* La trace : qui a remis quoi, et quand. */}
      <section className="card">
        <div className="card-pad" style={styles.sectionHead}>
          <h2>Déjà remises</h2>
          <div className="small muted">{honoredTotal} remise(s) enregistrée(s)</div>
        </div>

        {honored.length === 0 ? (
          <div className="card-pad muted small">Aucune remise enregistrée.</div>
        ) : (
          <>
            <table>
              <thead>
                <tr>
                  <th>Remise le</th>
                  <th>Cliente</th>
                  <th>Récompense</th>
                  <th>Par</th>
                  <th>Code</th>
                </tr>
              </thead>
              <tbody>
                {honored.map((v) => (
                  <tr key={v.id}>
                    <td className="small muted">{formatDateTime(v.honoredAt!)}</td>
                    <td>
                      <div style={{ fontWeight: 500 }}>{fullName(v.account?.user)}</div>
                      <div className="small muted">{v.account?.user?.email}</div>
                    </td>
                    <td>{v.reward.name}</td>
                    <td>
                      <div>{fullName(v.honoredBy)}</div>
                      {v.honoredBy?.role && (
                        <span className="badge badge-muted" style={{ marginTop: 2 }}>
                          {v.honoredBy.role === 'ADMIN' ? 'Admin' : 'Personnel'}
                        </span>
                      )}
                    </td>
                    <td className="small muted">{v.code}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination
              page={page}
              totalPages={honoredPages}
              total={honoredTotal}
              onChange={setPage}
              label="remise(s)"
            />
          </>
        )}
      </section>

      <Confirm
        open={!!confirming}
        title="Confirmer la remise"
        message={
          confirming
            ? `Remettre « ${confirming.reward.name} » à ${fullName(confirming.account?.user)} ? Le bon sortira de la liste.`
            : undefined
        }
        confirmLabel="Oui, remise"
        loading={saving}
        onConfirm={confirmHonor}
        onCancel={() => setConfirming(null)}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
//  Onglet 2 : créditer une cliente
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
                  <div className="small muted" style={{ marginTop: 4 }}>
                    {account ? `${account.visitCount} visite(s)` : '—'}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="label">Solde actuel</div>
                  <div className="serif" style={{ fontSize: 26, color: 'var(--gold-deep)' }}>
                    {account ? account.pointsBalance : '—'}
                  </div>
                </div>
              </div>

              {/* Bons encore dus. Ils sont rappelés ici, sur la fiche, et pas
                  seulement dans l'onglet « À honorer » : une cliente dont le
                  téléphone est déchargé se retrouve par son nom. */}
              {account && account.vouchers && account.vouchers.length > 0 && (
                <div style={styles.grantsBox}>
                  <div className="label" style={{ marginBottom: 6 }}>
                    Récompense(s) à remettre
                  </div>
                  {account.vouchers.map((v) => (
                    <div key={v.id} className="row between" style={{ marginTop: 4 }}>
                      <span style={{ fontWeight: 500 }}>{v.reward.name}</span>
                      <span className="serif" style={styles.code}>{v.code}</span>
                    </div>
                  ))}
                  <div className="small muted" style={{ marginTop: 6 }}>
                    À remettre depuis l'onglet « À honorer ».
                  </div>
                </div>
              )}

              {/* Récompenses offertes qu'elle n'a pas encore réclamées dans
                  l'app : rien ne l'oblige à passer par son téléphone. */}
              {account && account.grants && account.grants.length > 0 && (
                <div style={styles.grantsBox}>
                  <div className="label" style={{ marginBottom: 6 }}>
                    Récompense(s) offerte(s), pas encore réclamées
                  </div>
                  {account.grants.map((g) => (
                    <div key={g.id} className="row between" style={{ marginTop: 4 }}>
                      <span style={{ fontWeight: 500 }}>{g.reward.name}</span>
                      <span className="small muted">
                        débloquée le {formatDateTime(g.createdAt)}
                      </span>
                    </div>
                  ))}
                </div>
              )}

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
  // Les traductions sont ici de simples champs sous leur original, et non des
  // onglets comme dans le catalogue : ce formulaire tient en une colonne et
  // sert deux ou trois récompenses, pas quatre-vingt-huit prestations.
  const [nameAr, setNameAr] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [descriptionAr, setDescriptionAr] = useState('');
  const [descriptionEn, setDescriptionEn] = useState('');
  const [cost, setCost] = useState('');
  const [saving, setSaving] = useState(false);

  // Récompense en cours d'édition : le formulaire sert à la fois à créer et à
  // modifier, plutôt que de dupliquer les champs dans une modale.
  const [editing, setEditing] = useState<Reward | null>(null);

  const [toDeactivate, setToDeactivate] = useState<Reward | null>(null);
  const [acting, setActing] = useState(false);

  const resetForm = () => {
    setEditing(null);
    setName('');
    setDescription('');
    setNameAr('');
    setNameEn('');
    setDescriptionAr('');
    setDescriptionEn('');
    setCost('');
  };

  const startEdit = (r: Reward) => {
    setEditing(r);
    setName(r.name);
    setDescription(r.description ?? '');
    setNameAr(r.nameAr ?? '');
    setNameEn(r.nameEn ?? '');
    setDescriptionAr(r.descriptionAr ?? '');
    setDescriptionEn(r.descriptionEn ?? '');
    setCost(String(r.pointsCost));
    setError(null);
  };

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
      // Une traduction effacée part en `null` : `undefined` disparaîtrait du
      // JSON et la colonne garderait l'ancien texte. À la création il n'y a
      // rien à effacer, le champ est simplement absent.
      const vide = editing ? null : undefined;
      const traduction = (t: string) => t.trim() || vide;

      const payload = {
        name: name.trim(),
        description: description.trim() || undefined,
        nameAr: traduction(nameAr),
        nameEn: traduction(nameEn),
        descriptionAr: traduction(descriptionAr),
        descriptionEn: traduction(descriptionEn),
        pointsCost: parseInt(cost, 10),
      };
      if (editing) {
        await loyaltyApi.updateReward(editing.id, payload);
      } else {
        await loyaltyApi.createReward(payload);
      }
      resetForm();
      await load();
    } catch (e: any) {
      const msg = e.response?.data?.message;
      setError(
        Array.isArray(msg)
          ? msg.join(', ')
          : msg || (editing ? 'Modification impossible.' : 'Création impossible.'),
      );
    } finally {
      setSaving(false);
    }
  };

  const reactivate = async (r: Reward) => {
    setError(null);
    try {
      await loyaltyApi.updateReward(r.id, { active: true });
      await load();
    } catch (e: any) {
      setError(e.response?.data?.message || 'Action impossible.');
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
        <div className="row between card-pad" style={styles.sectionHead}>
          <h2>{editing ? 'Modifier la récompense' : 'Nouvelle récompense'}</h2>
          {editing && (
            <button type="button" className="btn btn-outline btn-sm" onClick={resetForm}>
              Annuler
            </button>
          )}
        </div>
        <form onSubmit={submit} className="card-pad">
          <label className="label" style={{ display: 'block', marginBottom: 5 }}>Nom</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Soin visage offert"
            required
          />
          <div style={{ display: 'grid', gap: 4, marginTop: 4 }}>
            <input
              value={nameAr}
              onChange={(e) => setNameAr(e.target.value)}
              dir="rtl"
              placeholder="العربية — optionnel"
            />
            <input
              value={nameEn}
              onChange={(e) => setNameEn(e.target.value)}
              placeholder="English — optionnel"
            />
          </div>

          <label className="label" style={{ display: 'block', margin: '12px 0 5px' }}>Description</label>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optionnel"
          />
          <div style={{ display: 'grid', gap: 4, marginTop: 4 }}>
            <input
              value={descriptionAr}
              onChange={(e) => setDescriptionAr(e.target.value)}
              dir="rtl"
              placeholder="العربية — optionnel"
            />
            <input
              value={descriptionEn}
              onChange={(e) => setDescriptionEn(e.target.value)}
              placeholder="English — optionnel"
            />
          </div>

          <div className="small muted" style={{ marginTop: 6 }}>
            Traductions facultatives : laissées vides, les clientes voient le
            français.
          </div>

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
            {saving
              ? 'Enregistrement…'
              : editing
                ? 'Enregistrer les modifications'
                : 'Créer la récompense'}
          </button>

          {error && <div style={{ ...styles.message, background: 'var(--danger-bg)', color: 'var(--danger)' }}>{error}</div>}
        </form>
      </section>

      <section className="card">
        <div className="row between card-pad" style={styles.sectionHead}>
          <h2>Récompenses existantes</h2>
          <button className="btn btn-outline btn-sm" onClick={() => load()}>Actualiser</button>
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
                    <div style={{ fontWeight: 500 }}>
                      {r.name}
                      {(!r.nameAr?.trim() || !r.nameEn?.trim()) && (
                        <span className="badge badge-warning" style={{ marginLeft: 8 }}>
                          À traduire
                        </span>
                      )}
                    </div>
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
                    <div className="row gap-2" style={{ justifyContent: 'flex-end' }}>
                      <button className="btn btn-outline btn-sm" onClick={() => startEdit(r)}>
                        Modifier
                      </button>
                      {r.active ? (
                        <button className="btn btn-danger btn-sm" onClick={() => setToDeactivate(r)}>
                          Désactiver
                        </button>
                      ) : (
                        <button className="btn btn-outline btn-sm" onClick={() => reactivate(r)}>
                          Réactiver
                        </button>
                      )}
                    </div>
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
//  Onglet 3 : paliers de visites
// ─────────────────────────────────────────────────────────────────────────
function MilestonesTab() {
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [threshold, setThreshold] = useState('10');
  const [rewardId, setRewardId] = useState('');
  const [recurring, setRecurring] = useState(true);
  const [saving, setSaving] = useState(false);

  const [editing, setEditing] = useState<Milestone | null>(null);
  const [toDeactivate, setToDeactivate] = useState<Milestone | null>(null);
  const [acting, setActing] = useState(false);

  const load = async () => {
    setIsLoading(true);
    try {
      setError(null);
      const [ms, rw] = await Promise.all([
        loyaltyApi.getAllMilestones(),
        loyaltyApi.getAllRewards(),
      ]);
      setMilestones(ms);
      setRewards(rw);
    } catch {
      setError('Impossible de charger les paliers.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  // Une récompense désactivée ne peut pas être proposée à un nouveau palier :
  // elle n'aurait jamais l'occasion d'être débloquée.
  const selectableRewards = rewards.filter((r) => r.active);

  const resetForm = () => {
    setEditing(null);
    setThreshold('10');
    setRewardId('');
    setRecurring(true);
  };

  const startEdit = (m: Milestone) => {
    setEditing(m);
    setThreshold(String(m.visitThreshold));
    setRewardId(m.rewardId);
    setRecurring(m.recurring);
    setError(null);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const n = parseInt(threshold, 10);
    if (!n || n < MIN_VISIT_THRESHOLD || n > MAX_VISIT_THRESHOLD) {
      setError(
        `Le seuil doit être compris entre ${MIN_VISIT_THRESHOLD} et ${MAX_VISIT_THRESHOLD} visites.`,
      );
      return;
    }
    if (!rewardId) {
      setError('Choisissez la récompense offerte.');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const payload = { visitThreshold: n, rewardId, recurring };
      if (editing) {
        await loyaltyApi.updateMilestone(editing.id, payload);
      } else {
        await loyaltyApi.createMilestone(payload);
      }
      resetForm();
      await load();
    } catch (e: any) {
      const msg = e.response?.data?.message;
      setError(Array.isArray(msg) ? msg.join(', ') : msg || 'Enregistrement impossible.');
    } finally {
      setSaving(false);
    }
  };

  const reactivate = async (m: Milestone) => {
    setError(null);
    try {
      await loyaltyApi.updateMilestone(m.id, { active: true });
      await load();
    } catch (e: any) {
      setError(e.response?.data?.message || 'Action impossible.');
    }
  };

  const runDeactivate = async () => {
    if (!toDeactivate) return;
    setActing(true);
    try {
      await loyaltyApi.deactivateMilestone(toDeactivate.id);
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
        <div className="row between card-pad" style={styles.sectionHead}>
          <h2>{editing ? 'Modifier le palier' : 'Nouveau palier'}</h2>
          {editing && (
            <button type="button" className="btn btn-outline btn-sm" onClick={resetForm}>
              Annuler
            </button>
          )}
        </div>

        <form onSubmit={submit} className="card-pad">
          <label className="label" style={{ display: 'block', marginBottom: 5 }}>
            Nombre de visites
          </label>
          <input
            type="number"
            min={MIN_VISIT_THRESHOLD}
            max={MAX_VISIT_THRESHOLD}
            value={threshold}
            onChange={(e) => setThreshold(e.target.value)}
            placeholder="10"
            required
          />

          <label className="label" style={{ display: 'block', margin: '12px 0 5px' }}>
            Récompense offerte
          </label>
          {selectableRewards.length === 0 ? (
            <div className="small muted">
              Créez d'abord une récompense dans l'onglet « Récompenses ».
            </div>
          ) : (
            <select value={rewardId} onChange={(e) => setRewardId(e.target.value)} required>
              <option value="">Choisir…</option>
              {selectableRewards.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          )}

          <label className="row gap-2" style={{ margin: '14px 0 0', alignItems: 'center' }}>
            <input
              type="checkbox"
              checked={recurring}
              onChange={(e) => setRecurring(e.target.checked)}
              style={{ width: 'auto' }}
            />
            <span className="small">Rejouer à chaque multiple (10e, 20e, 30e…)</span>
          </label>

          <button
            type="submit"
            className="btn btn-gold"
            style={{ marginTop: 'var(--sp-4)', width: '100%' }}
            disabled={saving || selectableRewards.length === 0}
          >
            {saving
              ? 'Enregistrement…'
              : editing
                ? 'Enregistrer les modifications'
                : 'Créer le palier'}
          </button>

          {error && (
            <div style={{ ...styles.message, background: 'var(--danger-bg)', color: 'var(--danger)' }}>
              {error}
            </div>
          )}

          <div className="small muted" style={{ marginTop: 'var(--sp-3)' }}>
            Une visite correspond à une prestation réalisée à l'institut. Les commandes de
            produits ne comptent pas. Modifier un palier n'affecte que les prochains
            déblocages : les récompenses déjà offertes restent celles annoncées aux clientes.
          </div>
        </form>
      </section>

      <section className="card">
        <div className="row between card-pad" style={styles.sectionHead}>
          <h2>Paliers existants</h2>
          <button className="btn btn-outline btn-sm" onClick={() => load()}>Actualiser</button>
        </div>

        {isLoading ? (
          <div style={{ display: 'grid', placeItems: 'center', height: 120 }}>
            <div className="spinner" />
          </div>
        ) : milestones.length === 0 ? (
          <div className="card-pad muted small">Aucun palier configuré.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Déclenchement</th>
                <th>Récompense</th>
                <th>Statut</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {milestones.map((m) => (
                <tr key={m.id} style={{ opacity: m.active ? 1 : 0.55 }}>
                  <td>
                    <div style={{ fontWeight: 500 }}>{m.visitThreshold} visites</div>
                    <div className="small muted">
                      {m.recurring ? 'À chaque multiple' : 'Une seule fois'}
                    </div>
                  </td>
                  <td>
                    <div style={{ fontWeight: 500 }}>{m.reward.name}</div>
                    {!m.reward.active && (
                      <div className="small" style={{ color: 'var(--danger)' }}>
                        Récompense désactivée — palier sans effet
                      </div>
                    )}
                  </td>
                  <td>
                    <span className={`badge ${m.active ? 'badge-success' : 'badge-muted'}`}>
                      {m.active ? 'Actif' : 'Désactivé'}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div className="row gap-2" style={{ justifyContent: 'flex-end' }}>
                      <button className="btn btn-outline btn-sm" onClick={() => startEdit(m)}>
                        Modifier
                      </button>
                      {m.active ? (
                        <button className="btn btn-danger btn-sm" onClick={() => setToDeactivate(m)}>
                          Désactiver
                        </button>
                      ) : (
                        <button className="btn btn-outline btn-sm" onClick={() => reactivate(m)}>
                          Réactiver
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <Confirm
        open={!!toDeactivate}
        title={`Désactiver le palier ${toDeactivate?.visitThreshold ?? ''} visites`}
        message="Plus aucune cliente ne débloquera cette récompense. Celles déjà débloquées restent réclamables."
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
//  Onglet 4 : audit des ajouts manuels
// ─────────────────────────────────────────────────────────────────────────
function AuditTab() {
  const [rows, setRows] = useState<ManualTransaction[]>([]);
  const [count, setCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  // Cumul de points sur l'ENSEMBLE du journal, calculé par le serveur : une
  // fois la liste paginée, l'additionner ici ne donnerait que le total de la
  // page — un chiffre d'audit faux, et qui n'aurait pas l'air faux.
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const load = async (p = page) => {
    setIsLoading(true);
    try {
      setError(null);
      const res = await loyaltyApi.auditManual({ page: p, limit: AUDIT_PAGE_SIZE });
      setRows(res.data);
      setCount(res.total);
      setTotalPages(res.totalPages);
      setTotal(res.pointsTotal);
      setPage(p);
    } catch {
      setError("Impossible de charger l'audit.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load(1);
  }, []);

  return (
    <section className="card">
      <div className="row between card-pad" style={styles.sectionHead}>
        <div>
          <h2>Ajouts manuels</h2>
          <div className="small muted">
            {count} opération(s) · {total} points crédités au total
          </div>
        </div>
        <button className="btn btn-outline btn-sm" onClick={() => load()}>Actualiser</button>
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
            {rows.map((r) => (
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
          total={count}
          onChange={load}
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
  // Le code se lit à voix haute au comptoir : espacé, lisible, monospace.
  code: {
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    fontSize: 15,
    fontWeight: 600,
    letterSpacing: 2,
    color: 'var(--gold-deep)',
  },
  grantsBox: {
    marginTop: 'var(--sp-3)',
    padding: 'var(--sp-3)',
    borderRadius: 'var(--radius-sm)',
    background: 'var(--gold-soft)',
    border: '1px solid var(--border)',
  },
  message: {
    marginTop: 'var(--sp-3)',
    padding: '8px 10px',
    borderRadius: 'var(--radius-sm)',
    fontSize: 13,
  },
};
