import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ordersApi, Order } from '../api/orders';
import { appointmentsApi, Appointment } from '../api/appointments';
import { productsApi, Product } from '../api/products';
import { useAuthStore } from '../stores/authStore';
import { formatPrice, formatTime, fullName, isToday } from '../utils';

// Seuil d'alerte de stock (en dessous, on prévient le staff)
const LOW_STOCK_THRESHOLD = 5;

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);

  const [orders, setOrders] = useState<Order[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const [o, a, p] = await Promise.all([
        ordersApi.getAll(),
        appointmentsApi.getAll(),
        productsApi.getAll(),
      ]);
      setOrders(o);
      setAppointments(a);
      setProducts(p);
    } catch {
      setError('Impossible de charger les données.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  // ── Agrégats ──────────────────────────────────────────────────────────
  const pendingOrders = useMemo(
    () => orders.filter((o) => o.status === 'PENDING'),
    [orders]
  );
  const activeOrders = useMemo(
    () => orders.filter((o) => o.status === 'CONFIRMED' || o.status === 'READY'),
    [orders]
  );
  const todayAppointments = useMemo(
    () =>
      appointments
        .filter((a) => isToday(a.startAt) && a.status !== 'CANCELLED')
        .sort((x, y) => x.startAt.localeCompare(y.startAt)),
    [appointments]
  );
  const pendingAppointments = useMemo(
    () => appointments.filter((a) => a.status === 'PENDING'),
    [appointments]
  );
  const lowStock = useMemo(
    () => products.filter((p) => p.stockQty <= LOW_STOCK_THRESHOLD),
    [products]
  );

  if (isLoading) {
    return (
      <div style={{ display: 'grid', placeItems: 'center', height: 300 }}>
        <div className="spinner" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="card card-pad" style={{ color: 'var(--danger)' }}>
        {error}{' '}
        <button className="btn btn-outline btn-sm" onClick={load} style={{ marginLeft: 8 }}>
          Réessayer
        </button>
      </div>
    );
  }

  const firstName = user?.firstName ?? '';

  return (
    <div>
      {/* En-tête */}
      <div className="row between" style={{ marginBottom: 'var(--sp-5)' }}>
        <div>
          <h1>Tableau de bord</h1>
          <div className="muted small">
            Bonjour{firstName ? ` ${firstName}` : ''}, voici l'activité de l'institut.
          </div>
        </div>
        <button className="btn btn-outline btn-sm" onClick={load}>
          Actualiser
        </button>
      </div>

      {/* Compteurs */}
      <div style={styles.stats}>
        <Stat
          label="Commandes à confirmer"
          value={pendingOrders.length}
          tone={pendingOrders.length > 0 ? 'warning' : 'muted'}
          to="/orders"
        />
        <Stat
          label="Commandes en cours"
          value={activeOrders.length}
          tone="info"
          to="/orders"
        />
        <Stat
          label="RDV aujourd'hui"
          value={todayAppointments.length}
          tone="info"
          to="/appointments"
        />
        <Stat
          label="RDV à confirmer"
          value={pendingAppointments.length}
          tone={pendingAppointments.length > 0 ? 'warning' : 'muted'}
          to="/appointments"
        />
      </div>

      {/* Deux colonnes : commandes à traiter + RDV du jour */}
      <div style={styles.columns}>
        {/* ── Commandes en attente ── */}
        <section className="card">
          <div className="row between card-pad" style={styles.sectionHead}>
            <h2>Commandes à confirmer</h2>
            <Link to="/orders" className="small" style={styles.link}>
              Tout voir →
            </Link>
          </div>

          {pendingOrders.length === 0 ? (
            <div className="card-pad muted small">Aucune commande en attente.</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Téléphone</th>
                  <th>Mode</th>
                  <th style={{ textAlign: 'right' }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {pendingOrders.slice(0, 6).map((o) => (
                  <tr key={o.id}>
                    <td>
                      <div style={{ fontWeight: 500 }}>{fullName(o.user)}</div>
                      <div className="small muted">
                        {o.items.reduce((n, i) => n + i.quantity, 0)} article(s)
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
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatPrice(o.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {/* ── RDV du jour ── */}
        <section className="card">
          <div className="row between card-pad" style={styles.sectionHead}>
            <h2>Rendez-vous du jour</h2>
            <Link to="/appointments" className="small" style={styles.link}>
              Tout voir →
            </Link>
          </div>

          {todayAppointments.length === 0 ? (
            <div className="card-pad muted small">Aucun rendez-vous aujourd'hui.</div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Heure</th>
                  <th>Cliente</th>
                  <th>Prestation</th>
                  <th>Statut</th>
                </tr>
              </thead>
              <tbody>
                {todayAppointments.slice(0, 6).map((a) => (
                  <tr key={a.id}>
                    <td style={{ fontWeight: 600 }}>{formatTime(a.startAt)}</td>
                    <td>
                      <div>{fullName(a.user)}</div>
                      {a.user?.phone && <div className="small muted">{a.user.phone}</div>}
                    </td>
                    <td className="small">{a.service?.name ?? '—'}</td>
                    <td>
                      <span className={`badge ${apptBadge(a.status)}`}>
                        {apptLabel(a.status)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>

      {/* ── Stock bas ── */}
      <section className="card" style={{ marginTop: 'var(--sp-4)' }}>
        <div className="row between card-pad" style={styles.sectionHead}>
          <h2>
            Stock bas{' '}
            <span className="muted small" style={{ fontWeight: 400 }}>
              (≤ {LOW_STOCK_THRESHOLD} unités)
            </span>
          </h2>
          <Link to="/catalog" className="small" style={styles.link}>
            Gérer le catalogue →
          </Link>
        </div>

        {lowStock.length === 0 ? (
          <div className="card-pad muted small">Tous les stocks sont corrects.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Produit</th>
                <th>Catégorie</th>
                <th style={{ textAlign: 'right' }}>Stock restant</th>
              </tr>
            </thead>
            <tbody>
              {lowStock.map((p) => (
                <tr key={p.id}>
                  <td style={{ fontWeight: 500 }}>{p.name}</td>
                  <td className="small muted">{p.category?.name ?? '—'}</td>
                  <td style={{ textAlign: 'right' }}>
                    <span className={`badge ${p.stockQty === 0 ? 'badge-danger' : 'badge-warning'}`}>
                      {p.stockQty === 0 ? 'Épuisé' : `${p.stockQty} restant(s)`}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

// ── Carte de compteur ───────────────────────────────────────────────────
function Stat({
  label,
  value,
  tone,
  to,
}: {
  label: string;
  value: number;
  tone: 'warning' | 'info' | 'muted';
  to: string;
}) {
  const color =
    tone === 'warning' ? 'var(--warning)' : tone === 'info' ? 'var(--info)' : 'var(--text-muted)';
  return (
    <Link to={to} className="card card-pad" style={styles.stat}>
      <div className="label">{label}</div>
      <div className="serif" style={{ fontSize: 32, color, lineHeight: 1.1, marginTop: 4 }}>
        {value}
      </div>
    </Link>
  );
}

function apptLabel(s: string): string {
  return { PENDING: 'En attente', CONFIRMED: 'Confirmé', COMPLETED: 'Terminé', CANCELLED: 'Annulé' }[s] ?? s;
}
function apptBadge(s: string): string {
  return {
    PENDING: 'badge-warning',
    CONFIRMED: 'badge-success',
    COMPLETED: 'badge-info',
    CANCELLED: 'badge-danger',
  }[s] ?? 'badge-muted';
}

const styles: Record<string, React.CSSProperties> = {
  stats: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
    gap: 'var(--sp-4)',
    marginBottom: 'var(--sp-4)',
  },
  stat: { textDecoration: 'none', color: 'inherit', display: 'block' },
  columns: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
    gap: 'var(--sp-4)',
    alignItems: 'start',
  },
  sectionHead: { borderBottom: '1px solid var(--border)', paddingBottom: 'var(--sp-3)' },
  link: { color: 'var(--gold-deep)', textDecoration: 'none', fontWeight: 600 },
  phone: { color: 'var(--info)', textDecoration: 'none', fontWeight: 500 },
};
