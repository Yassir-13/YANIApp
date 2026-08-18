import { useEffect, useState } from 'react';
import { todayLocal } from '../utils';

// Raccourcis de période. Ils partent du jour du CENTRE (todayLocal) et non de
// celui du poste : un ordinateur mal réglé décalerait le mois entier.
function moisEnCours() {
  const jour = todayLocal();
  return { from: `${jour.slice(0, 7)}-01`, to: jour };
}

function moisDernier() {
  const [annee, mois] = todayLocal().split('-').map(Number);
  const a = mois === 1 ? annee - 1 : annee;
  const m = mois === 1 ? 12 : mois - 1;
  // Le jour 0 du mois suivant, c'est le dernier jour du mois visé — inutile de
  // savoir lesquels ont 30, 31 ou 28 jours.
  const dernier = new Date(Date.UTC(a, m, 0)).getUTCDate();
  const mm = String(m).padStart(2, '0');
  return { from: `${a}-${mm}-01`, to: `${a}-${mm}-${dernier}` };
}

function anneeEnCours() {
  const jour = todayLocal();
  return { from: `${jour.slice(0, 4)}-01-01`, to: jour };
}

const RACCOURCIS = [
  { label: 'Ce mois-ci', periode: moisEnCours },
  { label: 'Mois dernier', periode: moisDernier },
  { label: 'Cette année', periode: anneeEnCours },
  { label: 'Tout', periode: () => ({ from: '', to: '' }) },
];

interface Props {
  open: boolean;
  titre: string;
  // Ce que la période découpe : date d'inscription, de commande, ou jour de la
  // prestation. Sans cette précision, les mêmes dates ne donnent pas le même
  // fichier selon le tableau.
  periodeLabel: string;
  // Un bilan se lit au mois ; un fichier clientes se veut complet.
  periodeParDefaut?: 'mois' | 'tout';
  // Les feuilles du classeur, annoncées avant de cliquer.
  contenu: string;
  // Filtre facultatif, pré-rempli depuis l'onglet ouvert dans la page.
  filtre?: {
    label: string;
    options: { value: string; label: string }[];
    defaut: string;
  };
  onExport: (params: { from?: string; to?: string; filtre?: string }) => Promise<void>;
  onClose: () => void;
}

// Choix de la période avant un export Excel. Partagé par les trois tableaux :
// seuls le titre, le libellé de période et le filtre changent.
export default function ExportModal({
  open,
  titre,
  periodeLabel,
  periodeParDefaut = 'mois',
  contenu,
  filtre,
  onExport,
  onClose,
}: Props) {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [valeurFiltre, setValeurFiltre] = useState('');
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  // À chaque ouverture on repart du mois en cours et de l'onglet affiché :
  // rouvrir la fenêtre ne doit pas ressortir la période du fichier précédent.
  useEffect(() => {
    if (!open) return;
    const { from: debut, to: fin } =
      periodeParDefaut === 'tout' ? { from: '', to: '' } : moisEnCours();
    setFrom(debut);
    setTo(fin);
    setValeurFiltre(filtre?.defaut ?? '');
    setErreur(null);
  }, [open, periodeParDefaut, filtre?.defaut]);

  if (!open) return null;

  const lancer = async () => {
    setEnCours(true);
    setErreur(null);
    try {
      await onExport({
        from: from || undefined,
        to: to || undefined,
        filtre: valeurFiltre || undefined,
      });
      onClose();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "L'export a échoué.");
    } finally {
      setEnCours(false);
    }
  };

  return (
    <div style={styles.backdrop} onClick={enCours ? undefined : onClose}>
      <div className="card" style={styles.card} onClick={(e) => e.stopPropagation()}>
        <div style={styles.accent} />
        <h2 style={{ marginBottom: 4 }}>{titre}</h2>
        <div className="muted small" style={{ marginBottom: 'var(--sp-4)' }}>{contenu}</div>

        <div className="label" style={{ marginBottom: 6 }}>{periodeLabel}</div>

        <div className="row gap-2" style={{ flexWrap: 'wrap', marginBottom: 'var(--sp-3)' }}>
          {RACCOURCIS.map((r) => {
            const p = r.periode();
            const actif = p.from === from && p.to === to;
            return (
              <button
                key={r.label}
                type="button"
                className={actif ? 'btn btn-gold btn-sm' : 'btn btn-outline btn-sm'}
                onClick={() => {
                  setFrom(p.from);
                  setTo(p.to);
                }}
              >
                {r.label}
              </button>
            );
          })}
        </div>

        <div className="row gap-2" style={{ marginBottom: 'var(--sp-4)' }}>
          <input
            type="date"
            value={from}
            max={to || undefined}
            onChange={(e) => setFrom(e.target.value)}
            aria-label="Date de début"
          />
          <span className="muted small">au</span>
          <input
            type="date"
            value={to}
            min={from || undefined}
            onChange={(e) => setTo(e.target.value)}
            aria-label="Date de fin"
          />
        </div>

        {filtre && (
          <div style={{ marginBottom: 'var(--sp-4)' }}>
            <div className="label" style={{ marginBottom: 6 }}>{filtre.label}</div>
            <select value={valeurFiltre} onChange={(e) => setValeurFiltre(e.target.value)}>
              {filtre.options.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        )}

        {erreur && (
          <div className="small" style={{ color: 'var(--danger)', marginBottom: 'var(--sp-3)' }}>
            {erreur}
          </div>
        )}

        <div className="row gap-2" style={{ justifyContent: 'flex-end' }}>
          <button className="btn btn-outline" onClick={onClose} disabled={enCours}>
            Annuler
          </button>
          <button className="btn btn-gold" onClick={lancer} disabled={enCours}>
            {enCours ? 'Préparation…' : 'Exporter'}
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
  },
  card: {
    width: '100%',
    maxWidth: 420,
    padding: 'var(--sp-5)',
    position: 'relative',
    overflow: 'hidden',
  },
  accent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    background: 'linear-gradient(90deg, var(--gold-light), var(--gold))',
  },
};
