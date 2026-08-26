interface PaginationProps {
  page: number; // page courante (1 = première)
  totalPages: number;
  total: number; // nombre total d'éléments, pour le libellé
  onChange: (page: number) => void;
  /** Nom de ce qu'on liste, pour le libellé : « 42 commandes ». */
  label?: string;
}

// Contrôles de pagination, communs aux tables du backoffice.
// Les quatre tables (Utilisateurs, Commandes, Rendez-vous, Audit) paginent
// côté SERVEUR depuis le correctif I4 : le composant ne connaît que la page
// courante et le nombre de pages, et se moque de savoir qui les calcule.
export default function Pagination({
  page,
  totalPages,
  total,
  onChange,
  label = 'éléments',
}: PaginationProps) {
  // Une seule page : les contrôles n'apporteraient rien, on garde juste le total.
  if (totalPages <= 1) {
    return (
      <div className="row between card-pad" style={styles.bar}>
        <span className="small muted">
          {total} {label}
        </span>
      </div>
    );
  }

  // Fenêtre de 5 numéros autour de la page courante : au-delà, une liste
  // complète deviendrait illisible (imaginer 40 boutons de page).
  const windowSize = 5;
  let start = Math.max(1, page - Math.floor(windowSize / 2));
  const end = Math.min(totalPages, start + windowSize - 1);
  start = Math.max(1, end - windowSize + 1);
  const pages = Array.from({ length: end - start + 1 }, (_, i) => start + i);

  return (
    <div className="row between card-pad" style={styles.bar}>
      <span className="small muted">
        {total} {label} · page {page} sur {totalPages}
      </span>

      <div className="row gap-2" style={{ width: 'auto' }}>
        <button
          className="btn btn-outline btn-sm"
          onClick={() => onChange(page - 1)}
          disabled={page <= 1}
          aria-label="Page précédente"
        >
          ‹
        </button>

        {start > 1 && <span className="small muted">…</span>}

        {pages.map((p) => (
          <button
            key={p}
            className={p === page ? 'btn btn-gold btn-sm' : 'btn btn-outline btn-sm'}
            onClick={() => onChange(p)}
            aria-current={p === page ? 'page' : undefined}
          >
            {p}
          </button>
        ))}

        {end < totalPages && <span className="small muted">…</span>}

        <button
          className="btn btn-outline btn-sm"
          onClick={() => onChange(page + 1)}
          disabled={page >= totalPages}
          aria-label="Page suivante"
        >
          ›
        </button>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  bar: {
    borderTop: '1px solid var(--border)',
    flexWrap: 'wrap',
    gap: 'var(--sp-2)',
  },
};
