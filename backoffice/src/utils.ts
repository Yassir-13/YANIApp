import { CENTER_TIMEZONE } from './api/config';

// Prix en dirhams, format français : « 32,00 dh »
export function formatPrice(price: string | number): string {
  const n = typeof price === 'string' ? parseFloat(price) : price;
  if (Number.isNaN(n)) return '—';
  return n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' dh';
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

export function fullName(u?: { firstName: string | null; lastName: string | null } | null): string {
  if (!u) return '—';
  const n = `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim();
  return n || '—';
}

// Le jour du CENTRE pour un instant donné, au format « AAAA-MM-JJ ».
//
// `sv-SE` est un raccourci volontaire : c'est la locale dont le format de date
// court est déjà ISO. Ce qui compte est le `timeZone` explicite — sans lui,
// JavaScript répond dans le fuseau du poste, et un ordinateur mal réglé (ou
// consulté depuis l'étranger) décalait le résultat d'un jour.
function jourDuCentre(d: Date): string {
  return d.toLocaleDateString('sv-SE', { timeZone: CENTER_TIMEZONE });
}

// Un RDV/commande est-il aujourd'hui ? « Aujourd'hui » au sens de l'institut.
export function isToday(iso: string): boolean {
  return jourDuCentre(new Date(iso)) === jourDuCentre(new Date());
}

// La date du jour à l'institut, au format attendu par un <input type="date">.
//
// Vivait en double dans AppointmentBookingModal, où elle passait par un décalage
// manuel de `getTimezoneOffset()` — donc là encore le fuseau du poste.
export function todayLocal(): string {
  return jourDuCentre(new Date());
}
