// Formatage cohérent des prix affichés (maquette : « 32,00 € »).
// price arrive en string (Decimal Prisma) ou number.
export function formatPrice(price: string | number): string {
  const n = typeof price === 'string' ? parseFloat(price) : price;
  if (Number.isNaN(n)) return '—';
  return (
    n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' DH'
  );
}

// Durée service : « 60 min »
export function formatDuration(min: number): string {
  return `${min} min`;
}

// Date courte pour l'historique : « 2 mars 2026 »
export function formatShortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}