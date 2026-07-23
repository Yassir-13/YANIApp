import { useEffect, useState } from 'react';
import { appointmentsApi, Appointment, Slot } from '../api/appointments';
import { servicesApi, Service } from '../api/services';
import { usersApi, AppUser } from '../api/users';
import { fullName, formatDateTime } from '../utils';

type Mode = 'create' | 'reschedule';

interface Props {
  open: boolean;
  mode: Mode;
  // Requis en mode 'reschedule' : cliente et prestation déjà connues.
  appointment?: Appointment | null;
  onClose: () => void;
  onDone: () => void; // recharge la liste parente
}

// Date locale du jour au format YYYY-MM-DD (évite le décalage UTC de toISOString).
function todayLocal(): string {
  const d = new Date();
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

export default function AppointmentBookingModal({
  open,
  mode,
  appointment,
  onClose,
  onDone,
}: Props) {
  // ── Sélection cliente (mode create) ──
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<AppUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [client, setClient] = useState<AppUser | null>(null);

  // ── Sélection prestation (mode create) ──
  const [services, setServices] = useState<Service[]>([]);
  const [serviceId, setServiceId] = useState('');

  // ── Date + créneaux ──
  const [date, setDate] = useState(todayLocal());
  const [slots, setSlots] = useState<Slot[]>([]);
  const [closed, setClosed] = useState(false);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slotStartAt, setSlotStartAt] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // En reprogrammation, la prestation est celle du RDV existant.
  const effectiveServiceId = mode === 'reschedule' ? appointment?.service?.id ?? '' : serviceId;

  // Réinitialise tout à chaque ouverture.
  useEffect(() => {
    if (!open) return;
    setSearch('');
    setResults([]);
    setClient(null);
    setServiceId('');
    setDate(todayLocal());
    setSlots([]);
    setClosed(false);
    setSlotStartAt(null);
    setError(null);
    // Charge les prestations actives (utile seulement en mode create)
    if (mode === 'create') {
      servicesApi.getActive().then(setServices).catch(() => setServices([]));
    }
  }, [open, mode]);

  // (Re)charge les créneaux dès qu'on a une prestation ET une date.
  useEffect(() => {
    if (!open || !effectiveServiceId || !date) {
      setSlots([]);
      return;
    }
    setLoadingSlots(true);
    setSlotStartAt(null);
    appointmentsApi
      .getAvailability(effectiveServiceId, date)
      .then((res) => {
        setSlots(res.slots);
        setClosed(res.closed);
      })
      .catch(() => {
        setSlots([]);
        setClosed(false);
      })
      .finally(() => setLoadingSlots(false));
  }, [open, effectiveServiceId, date]);

  if (!open) return null;

  const runSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setSearching(true);
    setError(null);
    try {
      const data = await usersApi.findAll(search.trim() || undefined);
      setResults(data.filter((u) => u.role === 'CLIENT'));
    } catch {
      setError('Recherche impossible.');
    } finally {
      setSearching(false);
    }
  };

  const canSubmit =
    !!slotStartAt &&
    !!effectiveServiceId &&
    (mode === 'reschedule' || !!client) &&
    !submitting;

  const submit = async () => {
    if (!slotStartAt) return;
    setSubmitting(true);
    setError(null);
    try {
      if (mode === 'create') {
        if (!client) return;
        await appointmentsApi.createForClient(client.id, effectiveServiceId, slotStartAt);
      } else {
        if (!appointment) return;
        await appointmentsApi.reschedule(appointment.id, slotStartAt);
      }
      onDone();
      onClose();
    } catch (e: any) {
      const msg = e.response?.data?.message;
      setError(Array.isArray(msg) ? msg.join(', ') : msg || 'Opération impossible.');
    } finally {
      setSubmitting(false);
    }
  };

  const title = mode === 'create' ? 'Nouveau rendez-vous' : 'Reprogrammer le rendez-vous';

  return (
    <div style={styles.backdrop} onClick={onClose}>
      <div className="card" style={styles.card} onClick={(e) => e.stopPropagation()}>
        <div style={styles.accent} />
        <h2 style={{ marginBottom: 'var(--sp-4)' }}>{title}</h2>

        {/* Contexte en reprogrammation : cliente + prestation figées */}
        {mode === 'reschedule' && appointment && (
          <div className="card card-pad" style={{ marginBottom: 'var(--sp-4)' }}>
            <div style={{ fontWeight: 500 }}>{fullName(appointment.user)}</div>
            <div className="small muted">
              {appointment.service?.name ?? 'Prestation'} · actuellement le{' '}
              {formatDateTime(appointment.startAt)}
            </div>
          </div>
        )}

        {/* Étape 1 (create) : choisir la cliente */}
        {mode === 'create' && (
          <div style={{ marginBottom: 'var(--sp-4)' }}>
            <label className="label" style={styles.stepLabel}>1. Cliente</label>
            {client ? (
              <div className="row between" style={styles.selectedBox}>
                <div>
                  <div style={{ fontWeight: 500 }}>{fullName(client)}</div>
                  <div className="small muted">{client.email}</div>
                </div>
                <button className="btn btn-outline btn-sm" onClick={() => setClient(null)}>
                  Changer
                </button>
              </div>
            ) : (
              <>
                <form onSubmit={runSearch} className="row gap-2">
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Nom, email ou téléphone…"
                    autoFocus
                  />
                  <button type="submit" className="btn btn-outline" disabled={searching}>
                    {searching ? '…' : 'Chercher'}
                  </button>
                </form>
                {results.length > 0 && (
                  <div style={{ marginTop: 'var(--sp-2)', maxHeight: 160, overflowY: 'auto' }}>
                    {results.slice(0, 8).map((u) => (
                      <button key={u.id} onClick={() => setClient(u)} style={styles.resultRow}>
                        <div style={{ fontWeight: 500 }}>{fullName(u)}</div>
                        <div className="small muted">{u.email}{u.phone ? ` · ${u.phone}` : ''}</div>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Étape 2 (create) : choisir la prestation */}
        {mode === 'create' && (
          <div style={{ marginBottom: 'var(--sp-4)' }}>
            <label className="label" style={styles.stepLabel}>2. Prestation</label>
            <select value={serviceId} onChange={(e) => setServiceId(e.target.value)}>
              <option value="">— Choisir une prestation —</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} · {s.durationMin} min
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Étape date + créneau */}
        <div style={{ marginBottom: 'var(--sp-3)' }}>
          <label className="label" style={styles.stepLabel}>
            {mode === 'create' ? '3. Date & créneau' : 'Nouveau créneau'}
          </label>
          <input
            type="date"
            value={date}
            min={todayLocal()}
            onChange={(e) => setDate(e.target.value)}
            style={{ maxWidth: 200 }}
            disabled={mode === 'create' && !effectiveServiceId}
          />
        </div>

        {/* Grille de créneaux */}
        {mode === 'create' && !effectiveServiceId ? (
          <div className="muted small">Choisissez d'abord une prestation.</div>
        ) : loadingSlots ? (
          <div style={{ display: 'grid', placeItems: 'center', height: 80 }}>
            <div className="spinner" />
          </div>
        ) : closed ? (
          <div className="muted small">Le centre est fermé ce jour-là.</div>
        ) : slots.length === 0 ? (
          <div className="muted small">Aucun créneau ce jour-là.</div>
        ) : (
          <div style={styles.slotsGrid}>
            {slots.map((s) => {
              const active = s.startAt === slotStartAt;
              return (
                <button
                  key={s.time}
                  disabled={!s.available}
                  onClick={() => setSlotStartAt(s.startAt)}
                  className={active ? 'btn btn-gold btn-sm' : 'btn btn-outline btn-sm'}
                  style={{
                    opacity: s.available ? 1 : 0.4,
                    textDecoration: s.available ? 'none' : 'line-through',
                  }}
                >
                  {s.time}
                </button>
              );
            })}
          </div>
        )}

        {error && (
          <div style={styles.error}>{error}</div>
        )}

        <div className="row gap-2" style={{ justifyContent: 'flex-end', marginTop: 'var(--sp-5)' }}>
          <button className="btn btn-outline" onClick={onClose} disabled={submitting}>
            Annuler
          </button>
          <button className="btn btn-gold" onClick={submit} disabled={!canSubmit}>
            {submitting ? 'Enregistrement…' : mode === 'create' ? 'Réserver' : 'Déplacer'}
          </button>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  backdrop: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(20,16,12,0.55)',
    display: 'grid',
    placeItems: 'center',
    zIndex: 100,
    padding: 'var(--sp-4)',
    overflowY: 'auto',
  },
  card: {
    width: '100%',
    maxWidth: 480,
    padding: 'var(--sp-5)',
    position: 'relative',
    overflow: 'hidden',
    margin: 'auto',
  },
  accent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    background: 'linear-gradient(90deg, var(--gold-light), var(--gold))',
  },
  stepLabel: { display: 'block', marginBottom: 6 },
  selectedBox: {
    padding: 'var(--sp-3)',
    borderRadius: 'var(--radius-sm)',
    background: 'var(--surface-alt)',
  },
  resultRow: {
    display: 'block',
    width: '100%',
    textAlign: 'left',
    padding: '8px 10px',
    borderRadius: 'var(--radius-sm)',
    border: 'none',
    background: 'transparent',
    cursor: 'pointer',
  },
  slotsGrid: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 'var(--sp-2)',
  },
  error: {
    marginTop: 'var(--sp-3)',
    padding: '8px 10px',
    borderRadius: 'var(--radius-sm)',
    background: 'var(--danger-bg)',
    color: 'var(--danger)',
    fontSize: 13,
  },
};
