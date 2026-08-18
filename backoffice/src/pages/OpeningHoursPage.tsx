import { useEffect, useState, FormEvent } from 'react';
import {
  openingHoursApi,
  OpeningRange,
  RangePayload,
  Closure,
} from '../api/openingHours';
import {
  settingsApi,
  CenterSettings,
  ECARTS_AUTORISES,
  CAPACITE_MIN,
  CAPACITE_MAX,
} from '../api/settings';
import { useAuthStore } from '../stores/authStore';
import { todayLocal } from '../utils';
import Confirm from '../components/Confirm';

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

// Plage proposée quand on rouvre un jour fermé ou qu'on en ajoute une seconde.
const PLAGE_MATIN: RangePayload = { startTime: '09:00', endTime: '13:00' };
const PLAGE_APRES_MIDI: RangePayload = { startTime: '14:00', endTime: '18:00' };

interface EditableDay {
  dayOfWeek: number;
  ranges: RangePayload[];
  saving: boolean;
  error: string | null;
  saved: boolean; // vient d'être enregistré (retour fugace)
}

// Empreinte d'un jour, pour détecter une modification non enregistrée.
const signature = (ranges: RangePayload[]) =>
  ranges.map((r) => `${r.startTime}-${r.endTime}`).join('|');

// « 2026-08-20 » → « 20 août 2026 ». Construit en heure LOCALE, et non via
// `new Date(iso)` qui interpréterait la chaîne en UTC et afficherait la veille
// dans tout fuseau négatif — une date de fermeture est un jour du calendrier,
// pas un instant.
const formatJour = (iso: string) => {
  const [a, m, j] = iso.split('-').map(Number);
  return new Date(a, m - 1, j).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

export default function OpeningHoursPage() {
  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.role === 'ADMIN';

  const [days, setDays] = useState<EditableDay[]>([]);
  const [baseline, setBaseline] = useState<Record<number, string>>({});
  const [closures, setClosures] = useState<Closure[]>([]);
  const [settings, setSettings] = useState<CenterSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setIsLoading(true);
    try {
      setError(null);
      const [plages, fermetures, reglages] = await Promise.all([
        openingHoursApi.getAll(),
        openingHoursApi.getClosures(),
        settingsApi.get(),
      ]);

      const parJour = new Map<number, OpeningRange[]>();
      for (const p of plages) {
        parJour.set(p.dayOfWeek, [...(parJour.get(p.dayOfWeek) ?? []), p]);
      }

      const rows: EditableDay[] = DAYS.map(({ value }) => ({
        dayOfWeek: value,
        // Aucune plage = jour fermé. Il n'y a plus de ligne « fermée » à lire.
        ranges: (parJour.get(value) ?? []).map((p) => ({
          startTime: p.startTime,
          endTime: p.endTime,
        })),
        saving: false,
        error: null,
        saved: false,
      }));

      setDays(rows);
      setBaseline(
        Object.fromEntries(rows.map((r) => [r.dayOfWeek, signature(r.ranges)])),
      );
      setClosures(fermetures);
      setSettings(reglages);
    } catch {
      setError('Impossible de charger la configuration des réservations.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  // ── Horaires ────────────────────────────────────────────────────────

  const patch = (dayOfWeek: number, changes: Partial<EditableDay>) =>
    setDays((prev) =>
      prev.map((d) =>
        d.dayOfWeek === dayOfWeek ? { ...d, ...changes, saved: false } : d,
      ),
    );

  const setRanges = (day: EditableDay, ranges: RangePayload[]) =>
    patch(day.dayOfWeek, { ranges, error: null });

  const addRange = (day: EditableDay) => {
    // La deuxième plage proposée est l'après-midi : c'est le geste attendu
    // quand on vient de poser une matinée.
    const modele = day.ranges.length === 0 ? PLAGE_MATIN : PLAGE_APRES_MIDI;
    setRanges(day, [...day.ranges, { ...modele }]);
  };

  const editRange = (
    day: EditableDay,
    index: number,
    champ: keyof RangePayload,
    valeur: string,
  ) =>
    setRanges(
      day,
      day.ranges.map((r, i) => (i === index ? { ...r, [champ]: valeur } : r)),
    );

  // Cohérence locale avant l'appel (le backend revalide de toute façon).
  const incoherence = (ranges: RangePayload[]): string | null => {
    const triees = [...ranges].sort((a, b) => a.startTime.localeCompare(b.startTime));
    for (const [i, p] of triees.entries()) {
      if (p.startTime >= p.endTime) {
        return `Plage ${p.startTime}–${p.endTime} : le début doit précéder la fin.`;
      }
      const suivante = triees[i + 1];
      if (suivante && suivante.startTime < p.endTime) {
        return 'Deux plages de ce jour se chevauchent.';
      }
    }
    return null;
  };

  const saveDay = async (day: EditableDay) => {
    const probleme = incoherence(day.ranges);
    if (probleme) {
      patch(day.dayOfWeek, { error: probleme });
      return;
    }

    patch(day.dayOfWeek, { saving: true, error: null });
    try {
      await openingHoursApi.setForDay(day.dayOfWeek, day.ranges);
      setBaseline((b) => ({ ...b, [day.dayOfWeek]: signature(day.ranges) }));
      patch(day.dayOfWeek, { saving: false, saved: true });
    } catch (e: any) {
      const msg = e.response?.data?.message;
      patch(day.dayOfWeek, {
        saving: false,
        error: Array.isArray(msg) ? msg.join(', ') : msg || 'Enregistrement impossible.',
      });
    }
  };

  const dirty = (d: EditableDay) => baseline[d.dayOfWeek] !== signature(d.ranges);

  return (
    <div>
      <div className="row between" style={{ marginBottom: 'var(--sp-4)' }}>
        <div>
          <h1>Réservations</h1>
          <div className="muted small">
            {isAdmin
              ? 'Horaires, fermetures et capacité du centre. Tout ce qui décide des créneaux proposés aux clientes.'
              : 'Consultation. La modification est réservée à l’administrateur.'}
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
        <>
          <SectionHoraires
            days={days}
            isAdmin={isAdmin}
            dirty={dirty}
            onAdd={addRange}
            onEdit={editRange}
            onRemove={(day, index) =>
              setRanges(day, day.ranges.filter((_, i) => i !== index))
            }
            onSave={saveDay}
          />

          <SectionFermetures
            closures={closures}
            isAdmin={isAdmin}
            onChanged={(next) => setClosures(next)}
          />

          {settings && (
            <SectionReglages
              settings={settings}
              isAdmin={isAdmin}
              onSaved={setSettings}
            />
          )}
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  Horaires hebdomadaires
// ═══════════════════════════════════════════════════════════

interface HorairesProps {
  days: EditableDay[];
  isAdmin: boolean;
  dirty: (d: EditableDay) => boolean;
  onAdd: (d: EditableDay) => void;
  onEdit: (d: EditableDay, i: number, champ: keyof RangePayload, v: string) => void;
  onRemove: (d: EditableDay, i: number) => void;
  onSave: (d: EditableDay) => void;
}

function SectionHoraires({
  days,
  isAdmin,
  dirty,
  onAdd,
  onEdit,
  onRemove,
  onSave,
}: HorairesProps) {
  return (
    <section style={{ marginBottom: 'var(--sp-5)' }}>
      <h2 style={{ marginBottom: 4 }}>Horaires d'ouverture</h2>
      <div className="muted small" style={{ marginBottom: 'var(--sp-3)' }}>
        Un jour peut avoir plusieurs plages — 9h-13h puis 14h-18h pour une pause
        déjeuner. Une prestation n'est jamais proposée si elle déborde de sa plage.
      </div>

      <div className="card">
        {days.map((d, i) => {
          const label = DAYS.find((x) => x.value === d.dayOfWeek)!.label;
          return (
            <div
              key={d.dayOfWeek}
              style={{
                padding: 'var(--sp-3) var(--sp-4)',
                borderTop: i === 0 ? 'none' : '1px solid var(--border)',
              }}
            >
              <div className="row between" style={{ gap: 'var(--sp-3)', flexWrap: 'wrap' }}>
                <div style={{ fontWeight: 500, minWidth: 90 }}>{label}</div>

                <div style={{ flex: 1, minWidth: 260 }}>
                  {d.ranges.length === 0 ? (
                    // Même conteneur en bloc que les lignes de plage : sans lui
                    // le badge et le bouton se retrouvaient collés l'un à
                    // l'autre sur la même ligne.
                    <div style={{ marginBottom: 6 }}>
                      <span className="badge badge-muted">Fermé</span>
                    </div>
                  ) : (
                    d.ranges.map((r, index) => (
                      <div
                        key={index}
                        className="row gap-2"
                        style={{ marginBottom: 6, flexWrap: 'wrap' }}
                      >
                        <input
                          type="time"
                          value={r.startTime}
                          disabled={!isAdmin}
                          onChange={(e) => onEdit(d, index, 'startTime', e.target.value)}
                          style={{ maxWidth: 120 }}
                        />
                        <span className="muted">→</span>
                        <input
                          type="time"
                          value={r.endTime}
                          disabled={!isAdmin}
                          onChange={(e) => onEdit(d, index, 'endTime', e.target.value)}
                          style={{ maxWidth: 120 }}
                        />
                        {isAdmin && (
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => onRemove(d, index)}
                            title="Retirer cette plage"
                          >
                            Retirer
                          </button>
                        )}
                      </div>
                    ))
                  )}

                  {isAdmin && (
                    <button
                      className="btn btn-outline btn-sm"
                      onClick={() => onAdd(d)}
                      disabled={d.ranges.length >= 6}
                    >
                      + Ajouter une plage
                    </button>
                  )}
                </div>

                {isAdmin && (
                  <div style={{ textAlign: 'right', minWidth: 150 }}>
                    {d.error ? (
                      <span className="small" style={{ color: 'var(--danger)' }}>{d.error}</span>
                    ) : d.saved && !dirty(d) ? (
                      <span className="small" style={{ color: 'var(--success)' }}>Enregistré ✓</span>
                    ) : (
                      <button
                        className="btn btn-gold btn-sm"
                        disabled={d.saving || !dirty(d)}
                        onClick={() => onSave(d)}
                      >
                        {d.saving ? '…' : 'Enregistrer'}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="muted small" style={{ marginTop: 'var(--sp-2)' }}>
        Un jour sans aucune plage est fermé. Les heures sont exprimées en heure
        locale du centre (Africa/Casablanca).
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════
//  Fermetures exceptionnelles
// ═══════════════════════════════════════════════════════════

function SectionFermetures({
  closures,
  isAdmin,
  onChanged,
}: {
  closures: Closure[];
  isAdmin: boolean;
  onChanged: (next: Closure[]) => void;
}) {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [aSupprimer, setASupprimer] = useState<Closure | null>(null);
  const [suppression, setSuppression] = useState(false);

  // Le jour du CENTRE. Il ne sert ici qu'à griser les fermetures déjà passées
  // et à borner le sélecteur de date — aucune disponibilité ne se décide dans
  // le navigateur.
  const jour = todayLocal();

  const ajouter = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErreur(null);
    try {
      // Une date de fin vide vaut une fermeture d'un seul jour : c'est le cas
      // le plus courant (un jour férié) et ça évite de saisir deux fois la
      // même date.
      const creee = await openingHoursApi.createClosure({
        startDate,
        endDate: endDate || startDate,
        reason: reason.trim() || undefined,
      });
      onChanged([...closures, creee].sort((a, b) => a.startDate.localeCompare(b.startDate)));
      setStartDate('');
      setEndDate('');
      setReason('');
    } catch (e: any) {
      const msg = e.response?.data?.message;
      setErreur(Array.isArray(msg) ? msg.join(', ') : msg || 'Ajout impossible.');
    } finally {
      setSaving(false);
    }
  };

  const supprimer = async () => {
    if (!aSupprimer) return;
    setSuppression(true);
    try {
      await openingHoursApi.deleteClosure(aSupprimer.id);
      onChanged(closures.filter((c) => c.id !== aSupprimer.id));
      setASupprimer(null);
    } catch (e: any) {
      setErreur(e.response?.data?.message || 'Suppression impossible.');
    } finally {
      setSuppression(false);
    }
  };

  return (
    <section style={{ marginBottom: 'var(--sp-5)' }}>
      <h2 style={{ marginBottom: 4 }}>Fermetures exceptionnelles</h2>
      <div className="muted small" style={{ marginBottom: 'var(--sp-3)' }}>
        Congés, jour férié, journée d'absence. Elles priment sur les horaires
        ci-dessus : aucun créneau n'est proposé sur ces dates.
      </div>

      {isAdmin && (
        <form
          className="card card-pad row gap-3"
          style={{ marginBottom: 'var(--sp-3)', flexWrap: 'wrap', alignItems: 'flex-end' }}
          onSubmit={ajouter}
        >
          <div>
            <label className="label" style={{ display: 'block', marginBottom: 4 }}>
              Du
            </label>
            <input
              type="date"
              required
              value={startDate}
              min={jour}
              onChange={(e) => setStartDate(e.target.value)}
              style={{ maxWidth: 170 }}
            />
          </div>
          <div>
            <label className="label" style={{ display: 'block', marginBottom: 4 }}>
              Au <span className="muted small">(vide = un seul jour)</span>
            </label>
            <input
              type="date"
              value={endDate}
              min={startDate || jour}
              onChange={(e) => setEndDate(e.target.value)}
              style={{ maxWidth: 170 }}
            />
          </div>
          <div style={{ flex: 1, minWidth: 180 }}>
            <label className="label" style={{ display: 'block', marginBottom: 4 }}>
              Motif <span className="muted small">(facultatif)</span>
            </label>
            <input
              value={reason}
              maxLength={120}
              placeholder="Congés annuels"
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
          <button className="btn btn-gold" disabled={saving || !startDate}>
            {saving ? '…' : 'Ajouter'}
          </button>
        </form>
      )}

      {erreur && (
        <div className="card card-pad" style={{ marginBottom: 'var(--sp-3)', color: 'var(--danger)' }}>
          {erreur}
        </div>
      )}

      {closures.length === 0 ? (
        <div className="card card-pad muted">Aucune fermeture enregistrée.</div>
      ) : (
        <div className="card">
          <table>
            <thead>
              <tr>
                <th>Dates</th>
                <th>Motif</th>
                <th style={{ width: 120 }}></th>
                {isAdmin && <th style={{ textAlign: 'right', width: 120 }}>Action</th>}
              </tr>
            </thead>
            <tbody>
              {closures.map((c) => {
                const passee = c.endDate < jour;
                return (
                  <tr key={c.id} style={{ opacity: passee ? 0.55 : 1 }}>
                    <td>
                      {c.startDate === c.endDate
                        ? formatJour(c.startDate)
                        : `${formatJour(c.startDate)} → ${formatJour(c.endDate)}`}
                    </td>
                    <td className="muted small">{c.reason || '—'}</td>
                    <td>
                      {passee && <span className="badge badge-muted">Passée</span>}
                    </td>
                    {isAdmin && (
                      <td style={{ textAlign: 'right' }}>
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => setASupprimer(c)}
                        >
                          Supprimer
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Confirm
        open={aSupprimer !== null}
        title="Supprimer cette fermeture ?"
        message={
          aSupprimer
            ? `Les créneaux du ${formatJour(aSupprimer.startDate)} redeviendront réservables selon les horaires habituels.`
            : undefined
        }
        confirmLabel="Supprimer"
        danger
        loading={suppression}
        onConfirm={supprimer}
        onCancel={() => setASupprimer(null)}
      />
    </section>
  );
}

// ═══════════════════════════════════════════════════════════
//  Réglages de réservation
// ═══════════════════════════════════════════════════════════

function SectionReglages({
  settings,
  isAdmin,
  onSaved,
}: {
  settings: CenterSettings;
  isAdmin: boolean;
  onSaved: (s: CenterSettings) => void;
}) {
  const [capacity, setCapacity] = useState(settings.capacity);
  const [slotIntervalMin, setSlotIntervalMin] = useState(settings.slotIntervalMin);
  const [saving, setSaving] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [enregistre, setEnregistre] = useState(false);

  const modifie =
    capacity !== settings.capacity || slotIntervalMin !== settings.slotIntervalMin;

  const enregistrer = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErreur(null);
    try {
      const maj = await settingsApi.update({ capacity, slotIntervalMin });
      onSaved(maj);
      setEnregistre(true);
    } catch (e: any) {
      const msg = e.response?.data?.message;
      setErreur(Array.isArray(msg) ? msg.join(', ') : msg || 'Enregistrement impossible.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section>
      <h2 style={{ marginBottom: 4 }}>Réglages</h2>
      <div className="muted small" style={{ marginBottom: 'var(--sp-3)' }}>
        Ils s'appliquent immédiatement aux créneaux proposés, sans redéploiement.
      </div>

      <form className="card card-pad" onSubmit={enregistrer}>
        <div className="row gap-3" style={{ flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div>
            <label className="label" style={{ display: 'block', marginBottom: 4 }}>
              Cabines réservables
            </label>
            <input
              type="number"
              min={CAPACITE_MIN}
              max={CAPACITE_MAX}
              value={capacity}
              disabled={!isAdmin}
              onChange={(e) => {
                setCapacity(Number(e.target.value));
                setEnregistre(false);
              }}
              style={{ maxWidth: 110 }}
            />
            <div className="muted small" style={{ marginTop: 4, maxWidth: 240 }}>
              Nombre de clientes pouvant être servies en même temps.
            </div>
          </div>

          <div>
            <label className="label" style={{ display: 'block', marginBottom: 4 }}>
              Écart entre créneaux
            </label>
            <select
              value={slotIntervalMin}
              disabled={!isAdmin}
              onChange={(e) => {
                setSlotIntervalMin(Number(e.target.value));
                setEnregistre(false);
              }}
              style={{ maxWidth: 140 }}
            >
              {ECARTS_AUTORISES.map((v) => (
                <option key={v} value={v}>{v} minutes</option>
              ))}
            </select>
            <div className="muted small" style={{ marginTop: 4, maxWidth: 240 }}>
              Rythme des heures proposées : 9h00, 9h30, 10h00…
            </div>
          </div>

          {isAdmin && (
            <div>
              {enregistre && !modifie ? (
                <span className="small" style={{ color: 'var(--success)' }}>Enregistré ✓</span>
              ) : (
                <button className="btn btn-gold" disabled={saving || !modifie}>
                  {saving ? '…' : 'Enregistrer'}
                </button>
              )}
            </div>
          )}
        </div>

        {erreur && (
          <div style={{ marginTop: 'var(--sp-3)', color: 'var(--danger)', fontSize: 13 }}>
            {erreur}
          </div>
        )}
      </form>
    </section>
  );
}
