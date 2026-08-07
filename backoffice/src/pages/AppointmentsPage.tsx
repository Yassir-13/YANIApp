import { useEffect, useState, useMemo } from 'react';
import { appointmentsApi, Appointment, AppointmentStatus } from '../api/appointments';
import { formatPrice, formatDateTime, formatTime, fullName, isToday } from '../utils';
import Confirm from '../components/Confirm';
import AppointmentBookingModal from '../components/AppointmentBookingModal';
import Pagination from '../components/Pagination';

// Lignes affichées par page. Les filtres et compteurs continuent de porter
// sur l'ensemble des rendez-vous : seul l'affichage est découpé.
const PAGE_SIZE = 20;

// Actions proposées selon le statut courant. Ce tableau reflète la machine à
// états du backend : COMPLETED et CANCELLED sont des états finaux.
const NEXT_ACTIONS: Record<AppointmentStatus, { status: AppointmentStatus; label: string; danger?: boolean }[]> = {
  PENDING: [
    { status: 'CONFIRMED', label: 'Confirmer' },
    { status: 'CANCELLED', label: 'Annuler', danger: true },
  ],
  CONFIRMED: [
    { status: 'COMPLETED', label: 'Terminer' },
    { status: 'CANCELLED', label: 'Annuler', danger: true },
  ],
  COMPLETED: [],
  CANCELLED: [],
};

const STATUS_META: Record<AppointmentStatus, { label: string; badge: string }> = {
  PENDING: { label: 'En attente', badge: 'badge-warning' },
  CONFIRMED: { label: 'Confirmé', badge: 'badge-success' },
  COMPLETED: { label: 'Terminé', badge: 'badge-muted' },
  CANCELLED: { label: 'Annulé', badge: 'badge-danger' },
};

// Le passage à COMPLETED déclenche le crédit fidélité côté backend
const ACTION_WARNING: Partial<Record<AppointmentStatus, string>> = {
  COMPLETED: 'Les points de fidélité seront crédités à la cliente.',
};

type Filter = AppointmentStatus | 'ALL' | 'TODAY' | 'UPCOMING';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'TODAY', label: "Aujourd'hui" },
  { key: 'UPCOMING', label: 'À venir' },
  { key: 'PENDING', label: 'À confirmer' },
  { key: 'CONFIRMED', label: 'Confirmés' },
  { key: 'COMPLETED', label: 'Terminés' },
  { key: 'CANCELLED', label: 'Annulés' },
  { key: 'ALL', label: 'Tous' },
];

export default function AppointmentsPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [filter, setFilter] = useState<Filter>('TODAY');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const [pendingAction, setPendingAction] = useState<{
    appt: Appointment;
    status: AppointmentStatus;
    label: string;
    danger?: boolean;
  } | null>(null);
  const [acting, setActing] = useState(false);

  // Modal de réservation : soit création (booking sans RDV), soit
  // reprogrammation (RDV existant à déplacer).
  const [booking, setBooking] = useState(false);
  const [rescheduling, setRescheduling] = useState<Appointment | null>(null);

  const load = async () => {
    setIsLoading(true);
    try {
      setError(null);
      // En tant que STAFF/ADMIN, cette route renvoie tous les rendez-vous
      const data = await appointmentsApi.getAll();
      setAppointments(data);
    } catch {
      setError('Impossible de charger les rendez-vous.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const counts = useMemo(() => {
    const now = Date.now();
    const c: Record<string, number> = {
      ALL: appointments.length,
      TODAY: appointments.filter((a) => isToday(a.startAt) && a.status !== 'CANCELLED').length,
      UPCOMING: appointments.filter(
        (a) => new Date(a.startAt).getTime() > now && a.status !== 'CANCELLED'
      ).length,
    };
    for (const a of appointments) c[a.status] = (c[a.status] ?? 0) + 1;
    return c;
  }, [appointments]);

  const filtered = useMemo(() => {
    const now = Date.now();
    let list = appointments;

    if (filter === 'TODAY') {
      list = list.filter((a) => isToday(a.startAt) && a.status !== 'CANCELLED');
    } else if (filter === 'UPCOMING') {
      list = list.filter((a) => new Date(a.startAt).getTime() > now && a.status !== 'CANCELLED');
    } else if (filter !== 'ALL') {
      list = list.filter((a) => a.status === filter);
    }

    // Les RDV passés en dernier pour les vues historiques, sinon chronologique
    const desc = filter === 'COMPLETED' || filter === 'CANCELLED' || filter === 'ALL';
    return [...list].sort((x, y) =>
      desc ? y.startAt.localeCompare(x.startAt) : x.startAt.localeCompare(y.startAt)
    );
  }, [appointments, filter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  // Changer de filtre remet à la première page.
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
      await appointmentsApi.updateStatus(pendingAction.appt.id, pendingAction.status);
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
          <h1>Rendez-vous</h1>
          <div className="muted small">
            Confirmez les demandes, puis marquez les prestations réalisées.
          </div>
        </div>
        <div className="row gap-2">
          <button className="btn btn-outline btn-sm" onClick={load}>Actualiser</button>
          <button className="btn btn-gold btn-sm" onClick={() => setBooking(true)}>
            + Nouveau RDV
          </button>
        </div>
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
            {counts[f.key] > 0 && <span style={{ marginLeft: 6, opacity: 0.7 }}>{counts[f.key]}</span>}
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
        <div className="card card-pad muted">Aucun rendez-vous dans cette catégorie.</div>
      ) : (
        <div className="card">
          <table>
            <thead>
              <tr>
                <th>Date & heure</th>
                <th>Cliente</th>
                <th>Téléphone</th>
                <th>Prestation</th>
                <th style={{ textAlign: 'right' }}>Prix</th>
                <th>Statut</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((a) => {
                const meta = STATUS_META[a.status];
                const actions = NEXT_ACTIONS[a.status];
                const today = isToday(a.startAt);

                // Montant à facturer = celui annoncé à la cliente lors de la
                // réservation. Si le tarif a changé depuis, on affiche l'écart
                // pour que le staff comprenne pourquoi les deux diffèrent.
                const billed = a.priceAtBooking ?? a.service?.price ?? null;
                const current = a.service?.price ?? null;
                const priceChanged =
                  a.priceAtBooking != null &&
                  current != null &&
                  parseFloat(a.priceAtBooking) !== parseFloat(current);

                return (
                  <tr key={a.id}>
                    <td>
                      {today ? (
                        <>
                          <div style={{ fontWeight: 600 }}>{formatTime(a.startAt)}</div>
                          <div className="small" style={{ color: 'var(--gold-deep)', fontWeight: 600 }}>
                            Aujourd'hui
                          </div>
                        </>
                      ) : (
                        <div>{formatDateTime(a.startAt)}</div>
                      )}
                    </td>
                    <td style={{ fontWeight: 500 }}>{fullName(a.user)}</td>
                    <td>
                      {a.user?.phone ? (
                        <a href={`tel:${a.user.phone}`} style={styles.phone}>
                          {a.user.phone}
                        </a>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                    <td>
                      <div>{a.service?.name ?? '—'}</div>
                      {a.service && (
                        <div className="small muted">{a.service.durationMin} min</div>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {billed === null ? (
                        <span className="muted">—</span>
                      ) : (
                        <>
                          <div style={{ fontWeight: 600 }}>{formatPrice(billed)}</div>
                          {priceChanged && (
                            <div
                              className="small muted"
                              title="Le tarif de la prestation a changé depuis la réservation. Le montant à facturer reste celui annoncé à la cliente."
                            >
                              tarif actuel {formatPrice(current!)}
                            </div>
                          )}
                        </>
                      )}
                    </td>
                    <td>
                      <span className={`badge ${meta.badge}`}>{meta.label}</span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {actions.length === 0 ? (
                        <span className="muted small">—</span>
                      ) : (
                        <div className="row gap-2" style={{ justifyContent: 'flex-end' }}>
                          {/* Reprogrammer : seulement depuis un état actif */}
                          {(a.status === 'PENDING' || a.status === 'CONFIRMED') && (
                            <button
                              className="btn btn-outline btn-sm"
                              onClick={() => setRescheduling(a)}
                            >
                              Reprogrammer
                            </button>
                          )}
                          {actions.map((act) => (
                            <button
                              key={act.status}
                              className={act.danger ? 'btn btn-danger btn-sm' : 'btn btn-gold btn-sm'}
                              onClick={() => setPendingAction({ appt: a, ...act })}
                            >
                              {act.label}
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
            total={filtered.length}
            onChange={setPage}
            label="rendez-vous"
          />
        </div>
      )}

      <Confirm
        open={!!pendingAction}
        title={pendingAction ? `${pendingAction.label} le rendez-vous` : ''}
        message={
          pendingAction && (
            <>
              <strong>{fullName(pendingAction.appt.user)}</strong> —{' '}
              {pendingAction.appt.service?.name ?? 'Prestation'} le{' '}
              {formatDateTime(pendingAction.appt.startAt)}.
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

      {/* Réservation pour une cliente */}
      <AppointmentBookingModal
        open={booking}
        mode="create"
        onClose={() => setBooking(false)}
        onDone={load}
      />

      {/* Reprogrammation d'un RDV existant */}
      <AppointmentBookingModal
        open={!!rescheduling}
        mode="reschedule"
        appointment={rescheduling}
        onClose={() => setRescheduling(null)}
        onDone={load}
      />
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  phone: { color: 'var(--info)', textDecoration: 'none', fontWeight: 500 },
};