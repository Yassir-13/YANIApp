import { useEffect, useState } from 'react';
import { openingHoursApi, OpeningDay } from '../api/openingHours';
import { useAuthStore } from '../stores/authStore';

// Ordre d'affichage à la française : lundi d'abord, dimanche en dernier.
// La valeur reste la convention backend (0 = dimanche … 6 = samedi).
const DAYS: { value: number; label: string }[] = [
  { value: 1, label: 'Lundi' },
  { value: 2, label: 'Mardi' },
  { value: 3, label: 'Mercredi' },
  { value: 4, label: 'Jeudi' },
  { value: 5, label: 'Vendredi' },
  { value: 6, label: 'Samedi' },
  { value: 0, label: 'Dimanche' },
];

// Valeurs par défaut proposées pour un jour non encore configuré.
const DEFAULT_OPEN = '09:00';
const DEFAULT_CLOSE = '19:00';

interface EditableDay {
  dayOfWeek: number;
  openTime: string;
  closeTime: string;
  isClosed: boolean;
  saving: boolean;
  error: string | null;
  saved: boolean; // vient d'être enregistré (feedback fugace)
}

// Signature d'un jour pour détecter une modification non enregistrée.
const signature = (d: { openTime: string; closeTime: string; isClosed: boolean }) =>
  `${d.isClosed}|${d.openTime}|${d.closeTime}`;

export default function OpeningHoursPage() {
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'ADMIN';

  const [days, setDays] = useState<EditableDay[]>([]);
  // Empreinte enregistrée de chaque jour, pour savoir ce qui a changé.
  const [baseline, setBaseline] = useState<Record<number, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setIsLoading(true);
    try {
      setError(null);
      const existing = await openingHoursApi.getAll();
      const byDay = new Map<number, OpeningDay>(existing.map((d) => [d.dayOfWeek, d]));

      // Un jour absent en base = fermé (comportement du moteur de disponibilité).
      const rows: EditableDay[] = DAYS.map(({ value }) => {
        const found = byDay.get(value);
        return {
          dayOfWeek: value,
          openTime: found?.openTime ?? DEFAULT_OPEN,
          closeTime: found?.closeTime ?? DEFAULT_CLOSE,
          isClosed: found ? found.isClosed : true,
          saving: false,
          error: null,
          saved: false,
        };
      });

      setDays(rows);
      setBaseline(Object.fromEntries(rows.map((r) => [r.dayOfWeek, signature(r)])));
    } catch {
      setError('Impossible de charger les horaires.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const patch = (dayOfWeek: number, changes: Partial<EditableDay>) =>
    setDays((prev) =>
      prev.map((d) =>
        d.dayOfWeek === dayOfWeek ? { ...d, ...changes, saved: false } : d,
      ),
    );

  const saveDay = async (day: EditableDay) => {
    // Cohérence locale avant l'appel (le backend revalide de toute façon).
    if (!day.isClosed && day.openTime >= day.closeTime) {
      patch(day.dayOfWeek, {
        error: "L'ouverture doit précéder la fermeture.",
      });
      return;
    }

    patch(day.dayOfWeek, { saving: true, error: null });
    try {
      await openingHoursApi.setForDay({
        dayOfWeek: day.dayOfWeek,
        openTime: day.openTime,
        closeTime: day.closeTime,
        isClosed: day.isClosed,
      });
      setBaseline((b) => ({ ...b, [day.dayOfWeek]: signature(day) }));
      patch(day.dayOfWeek, { saving: false, saved: true });
    } catch (e: any) {
      const msg = e.response?.data?.message;
      patch(day.dayOfWeek, {
        saving: false,
        error: Array.isArray(msg) ? msg.join(', ') : msg || 'Enregistrement impossible.',
      });
    }
  };

  const dirty = (d: EditableDay) => baseline[d.dayOfWeek] !== signature(d);

  return (
    <div>
      <div className="row between" style={{ marginBottom: 'var(--sp-4)' }}>
        <div>
          <h1>Horaires d'ouverture</h1>
          <div className="muted small">
            {isAdmin
              ? "Définissez les plages horaires du centre. Elles pilotent les créneaux de réservation proposés aux clientes."
              : 'Consultation des horaires. La modification est réservée à l’administrateur.'}
          </div>
        </div>
        <button className="btn btn-outline btn-sm" onClick={load}>Actualiser</button>
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
      ) : (
        <div className="card">
          <table>
            <thead>
              <tr>
                <th style={{ width: 140 }}>Jour</th>
                <th>Ouverture</th>
                <th>Fermeture</th>
                <th style={{ textAlign: 'center' }}>Fermé</th>
                {isAdmin && <th style={{ textAlign: 'right', width: 160 }}>Action</th>}
              </tr>
            </thead>
            <tbody>
              {days.map((d) => {
                const label = DAYS.find((x) => x.value === d.dayOfWeek)!.label;
                return (
                  <tr key={d.dayOfWeek}>
                    <td style={{ fontWeight: 500 }}>{label}</td>
                    <td>
                      <input
                        type="time"
                        value={d.openTime}
                        disabled={!isAdmin || d.isClosed}
                        onChange={(e) => patch(d.dayOfWeek, { openTime: e.target.value })}
                        style={{ maxWidth: 130 }}
                      />
                    </td>
                    <td>
                      <input
                        type="time"
                        value={d.closeTime}
                        disabled={!isAdmin || d.isClosed}
                        onChange={(e) => patch(d.dayOfWeek, { closeTime: e.target.value })}
                        style={{ maxWidth: 130 }}
                      />
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={d.isClosed}
                        disabled={!isAdmin}
                        onChange={(e) => patch(d.dayOfWeek, { isClosed: e.target.checked })}
                        style={{ width: 'auto' }}
                      />
                    </td>
                    {isAdmin && (
                      <td style={{ textAlign: 'right' }}>
                        {d.error ? (
                          <span className="small" style={{ color: 'var(--danger)' }}>{d.error}</span>
                        ) : d.saved && !dirty(d) ? (
                          <span className="small" style={{ color: 'var(--success)' }}>Enregistré ✓</span>
                        ) : (
                          <button
                            className="btn btn-gold btn-sm"
                            disabled={d.saving || !dirty(d)}
                            onClick={() => saveDay(d)}
                          >
                            {d.saving ? '…' : 'Enregistrer'}
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="muted small" style={{ marginTop: 'var(--sp-3)' }}>
        Un jour marqué « Fermé » n'affiche aucun créneau. Les heures sont exprimées
        en heure locale du centre (Africa/Casablanca).
      </div>
    </div>
  );
}
