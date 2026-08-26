import i18n, { intlLocale } from '../i18n';

// Ces fonctions vivent hors d'un composant : elles utilisent l'instance i18n
// directement, sans le hook. Les écrans qui les appellent sont abonnés aux
// changements de langue par leur propre `useTranslation`, donc ils se
// redessinent — et rappellent ces fonctions — quand la langue change.

// Formatage cohérent des prix affichés (maquette : « 32,00 € »).
// price arrive en string (Decimal Prisma) ou number.
export function formatPrice(price: string | number): string {
  const n = typeof price === 'string' ? parseFloat(price) : price;
  if (Number.isNaN(n)) return '—';
  return (
    n.toLocaleString(intlLocale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 }) +
    ' ' +
    i18n.t('common.currency')
  );
}

// Date courte pour l'historique : « 2 mars 2026 »
export function formatShortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(intlLocale(), { day: 'numeric', month: 'short', year: 'numeric' });
}
