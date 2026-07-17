import { ReactNode } from 'react';

interface ConfirmProps {
  open: boolean;
  title: string;
  message?: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

// Modal de confirmation générique — utilisé avant toute action irréversible
// (annuler une commande, changer un rôle, supprimer une récompense…).
export default function Confirm({
  open,
  title,
  message,
  confirmLabel = 'Confirmer',
  danger = false,
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmProps) {
  if (!open) return null;

  return (
    <div style={styles.backdrop} onClick={onCancel}>
      <div className="card" style={styles.card} onClick={(e) => e.stopPropagation()}>
        <div style={styles.accent} />
        <h2 style={{ marginBottom: message ? 8 : 16 }}>{title}</h2>
        {message && <div className="muted" style={{ marginBottom: 20, fontSize: 13 }}>{message}</div>}

        <div className="row gap-2" style={{ justifyContent: 'flex-end' }}>
          <button className="btn btn-outline" onClick={onCancel} disabled={loading}>
            Annuler
          </button>
          <button
            className={danger ? 'btn btn-danger' : 'btn btn-gold'}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? 'Traitement…' : confirmLabel}
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
    maxWidth: 380,
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