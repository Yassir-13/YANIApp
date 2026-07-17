// Page temporaire pour les modules pas encore construits.
export default function Placeholder({ title }: { title: string }) {
  return (
    <div>
      <h1>{title}</h1>
      <div className="card card-pad muted" style={{ marginTop: 'var(--sp-4)' }}>
        Ce module n'est pas encore disponible.
      </div>
    </div>
  );
}
