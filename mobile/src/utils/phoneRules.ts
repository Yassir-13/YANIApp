// Règles de numéro de téléphone, alignées sur IsMoroccanPhone côté backend.
//
// Comme passwordRules, elles sont volontairement redites ici : le serveur
// reste seul juge, mais attendre son refus pour signaler une faute de frappe
// fait perdre un aller-retour et affiche une erreur brute là où un message
// clair suffit.
//
// Le numéro est le SEUL moyen de contact de l'institut : une faute de frappe
// et la cliente ne peut être rappelée ni pour sa commande, ni pour son
// rendez-vous. D'où un contrôle sur les deux écrans qui le saisissent —
// l'inscription et la modification du profil.

// 0XXXXXXXXX ou +212XXXXXXXXX, mobile ou fixe (préfixes 5 à 7).
export const PHONE_RE = /^(?:\+212|0)([5-7]\d{8})$/;

/**
 * Renvoie une clé de message d'erreur, ou null si le numéro convient.
 * Même raison que `validatePassword` : fonction pure, donc pas de `t` ici.
 */
export function validatePhone(phone: string): 'errors.phoneInvalid' | null {
  if (!PHONE_RE.test(phone)) {
    return 'errors.phoneInvalid';
  }
  return null;
}

// « 0612345678 » → « 06 12 34 56 78 », plus lisible pour une relecture.
export function formatPhoneForDisplay(raw: string): string {
  const national = raw.startsWith('+212') ? '0' + raw.slice(4) : raw;
  return national.replace(/(\d{2})(?=\d)/g, '$1 ').trim();
}
