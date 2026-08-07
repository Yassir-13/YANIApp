import { useEffect, useState, useMemo, Fragment } from 'react';
import { ordersApi, Order, OrderStatus } from '../api/orders';
import { formatPrice, formatDateTime, fullName } from '../utils';
import Confirm from '../components/Confirm';
import Pagination from '../components/Pagination';

// Lignes affichées par page. Les filtres et compteurs portent sur l'ensemble
// des commandes, pas sur la page : seul l'affichage est découpé.
const PAGE_SIZE = 20;

// ── Machine à états : miroir exact du backend (orders.service.ts) ────────
const NEXT_ACTIONS: Record<OrderStatus, { status: OrderStatus; label: string; danger?: boolean }[]> = {
  PENDING: [
    { status: 'CONFIRMED', label: 'Confirmer' },
    { status: 'CANCELLED', label: 'Annuler', danger: true },
  ],
  CONFIRMED: [
    { status: 'READY', label: 'Marquer prête' },
    { status: 'CANCELLED', label: 'Annuler', danger: true },
  ],
  READY: [
    { status: 'COMPLETED', label: 'Terminer' },
    { status: 'CANCELLED', label: 'Annuler', danger: true },
  ],
  COMPLETED: [],
  CANCELLED: [],
};

const STATUS_META: Record<OrderStatus, { label: string; badge: string }> = {
  PENDING: { label: 'En attente', badge: 'badge-warning' },
  CONFIRMED: { label: 'Confirmée', badge: 'badge-success' },
  READY: { label: 'Prête', badge: 'badge-info' },
  COMPLETED: { label: 'Terminée', badge: 'badge-muted' },
  CANCELLED: { label: 'Annulée', badge: 'badge-danger' },
};

const FILTERS: { key: OrderStatus | 'ALL'; label: string }[] = [
  { key: 'PENDING', label: 'À confirmer' },
  { key: 'CONFIRMED', label: 'Confirmées' },
  { key: 'READY', label: 'Prêtes' },
  { key: 'COMPLETED', label: 'Terminées' },
  { key: 'CANCELLED', label: 'Annulées' },
  { key: 'ALL', label: 'Toutes' },
];

// Effets de bord expliqués au staff avant qu'il valide
const ACTION_WARNING: Partial<Record<OrderStatus, string>> = {
  CONFIRMED: 'Le stock des produits sera décrémenté.',
  COMPLETED: 'Les points de fidélité seront crédités à la cliente.',
  CANCELLED: 'Le stock sera restauré si la commande avait déjà été confirmée.',
};

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [filter, setFilter] = useState<OrderStatus | 'ALL'>('PENDING');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const [pendingAction, setPendingAction] = useState<{
    order: Order;
    status: OrderStatus;
    label: string;
    danger?: boolean;
  } | null>(null);
  const [acting, setActing] = useState(false);

  const load = async () => {
    setIsLoading(true);
    try {
      setError(null);
      const data = await ordersApi.getAll();
      setOrders(data);
    } catch {
      setError('Impossible de charger les commandes.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const counts = useMemo(() => {
    const c: Record<string, number> = { ALL: orders.length };
    for (const o of orders) c[o.status] = (c[o.status] ?? 0) + 1;
    return c;
  }, [orders]);

  const filtered = useMemo(
    () => (filter === 'ALL' ? orders : orders.filter((o) => o.status === filter)),
    [orders, filter]
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  // Changer de filtre remet à la première page : rester en page 4 alors que
  // le nouveau filtre n'a qu'une page afficherait un tableau vide.
  useEffect(() => {
    setPage(1);
  }, [filter]);

  const visible = useMemo(
    () => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filtered, page]
  );

  const runAction = async () => {
    if (!pendingAction) return;
    setActing(true);
    try {
      await ordersApi.updateStatus(pendingAction.order.id, pendingAction.status);
      setPendingAction(null);
      await load();
    } catch (e: any) {
      setError(e.response?.data?.message || 'Action impossible.');
      setPendingAction(null);
    } finally {
      setActing(false);
    }
  };

  return (
    <div>
      <div className="row between" style={{ marginBottom: 'var(--sp-4)' }}>
        <div>
          <h1>Commandes</h1>
          <div className="muted small">
            Appelez la cliente, confirmez, préparez, puis remettez la commande.
          </div>
        </div>
        <button className="btn btn-outline btn-sm" onClick={load}>Actualiser</button>
      </div>

      {/* Onglets de filtre */}
      <div className="row gap-2" style={{ marginBottom: 'var(--sp-4)', flexWrap: 'wrap' }}>
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={filter === f.key ? 'btn btn-gold btn-sm' : 'btn btn-outline btn-sm'}
          >
            {f.label}
            {counts[f.key] > 0 && (
              <span style={{ marginLeft: 6, opacity: 0.7 }}>{counts[f.key]}</span>
            )}
          </button>
        ))}
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
        <div className="card card-pad muted">Aucune commande dans cette catégorie.</div>
      ) : (
        <div className="card">
          <table>
            <thead>
              <tr>
                <th style={{ width: 30 }}></th>
                <th>Cliente</th>
                <th>Téléphone</th>
                <th>Mode</th>
                <th>Date</th>
                <th style={{ textAlign: 'right' }}>Total</th>
                <th>Statut</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((o) => {
                const meta = STATUS_META[o.status];
                const actions = NEXT_ACTIONS[o.status];
                const isOpen = expanded === o.id;
                const itemCount = o.items.reduce((n, i) => n + i.quantity, 0);

                return (
                  <Fragment key={o.id}>
                    <tr>
                      <td>
                        <button
                          onClick={() => setExpanded(isOpen ? null : o.id)}
                          style={styles.expandBtn}
                          title={isOpen ? 'Replier' : 'Voir le détail'}
                        >
                          {isOpen ? '▾' : '▸'}
                        </button>
                      </td>
                      <td>
                        <div style={{ fontWeight: 500 }}>{fullName(o.user)}</div>
                        <div className="small muted" style={{ marginTop: 2 }}>
                          {o.items
                            .map((it) => `${it.quantity}× ${it.product?.name ?? 'Produit'}`)
                            .join(', ')}
                        </div>
                      </td>
                      <td>
                        {o.user?.phone ? (
                          <a href={`tel:${o.user.phone}`} style={styles.phone}>
                            {o.user.phone}
                          </a>
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                      <td>
                        <span className="badge badge-muted">
                          {o.fulfillment === 'PICKUP' ? 'Retrait' : 'Livraison'}
                        </span>
                      </td>
                      <td className="small muted">{formatDateTime(o.createdAt)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatPrice(o.total)}</td>
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
                                key={a.status}
                                className={a.danger ? 'btn btn-danger btn-sm' : 'btn btn-gold btn-sm'}
                                onClick={() => setPendingAction({ order: o, ...a })}
                              >
                                {a.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>

                    {/* Détail dépliable */}
                    {isOpen && (
                      <tr>
                        <td colSpan={8} style={styles.detailCell}>
                          <div style={styles.detailGrid}>
                            <div>
                              <div className="label" style={{ marginBottom: 6 }}>Articles</div>
                              {o.items.map((it) => (
                                <div key={it.id} className="row between" style={styles.itemRow}>
                                  <span>
                                    {it.quantity} × {it.product?.name ?? 'Produit'}
                                  </span>
                                  <span className="muted">
                                    {formatPrice(parseFloat(it.unitPrice) * it.quantity)}
                                  </span>
                                </div>
                              ))}
                            </div>

                            <div>
                              <div className="label" style={{ marginBottom: 6 }}>Informations</div>
                              <div style={styles.infoRow}>
                                <span className="muted">Email</span>
                                <span>{o.user?.email ?? '—'}</span>
                              </div>
                              {o.fulfillment === 'DELIVERY' && (
                                <div style={styles.infoRow}>
                                  <span className="muted">Adresse</span>
                                  <span style={{ textAlign: 'right', maxWidth: 240 }}>
                                    {o.address ?? '—'}
                                  </span>
                                </div>
                              )}
                              {o.note && (
                                <div style={styles.infoRow}>
                                  <span className="muted">Note</span>
                                  <span style={{ textAlign: 'right', maxWidth: 240 }}>{o.note}</span>
                                </div>
                              )}
                              <div style={styles.infoRow}>
                                <span className="muted">Référence</span>
                                <span className="small" style={{ fontFamily: 'monospace' }}>
                                  {o.id.slice(0, 8)}
                                </span>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>

          <Pagination
            page={page}
            totalPages={totalPages}
            total={filtered.length}
            onChange={setPage}
            label="commande(s)"
          />
        </div>
      )}

      {/* Confirmation d'action */}
      <Confirm
        open={!!pendingAction}
        title={pendingAction ? `${pendingAction.label} la commande` : ''}
        message={
          pendingAction && (
            <>
              Commande de <strong>{fullName(pendingAction.order.user)}</strong> —{' '}
              {formatPrice(pendingAction.order.total)}.
              {ACTION_WARNING[pendingAction.status] && (
                <div style={{ marginTop: 8 }}>{ACTION_WARNING[pendingAction.status]}</div>
              )}
            </>
          )
        }
        confirmLabel={pendingAction?.label}
        danger={pendingAction?.danger}
        loading={acting}
        onConfirm={runAction}
        onCancel={() => setPendingAction(null)}
      />
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  expandBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: 'var(--text-muted)',
    fontSize: 12,
    padding: 4,
  },
  phone: { color: 'var(--info)', textDecoration: 'none', fontWeight: 500 },
  detailCell: { background: 'var(--surface-alt)', padding: 'var(--sp-4)' },
  detailGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
    gap: 'var(--sp-5)',
  },
  itemRow: { fontSize: 13, padding: '3px 0' },
  infoRow: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 'var(--sp-4)',
    fontSize: 13,
    padding: '3px 0',
  },
};