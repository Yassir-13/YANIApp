// Règles de mot de passe, alignées sur IsAppPassword côté backend.
//
// Elles sont volontairement redites ici : le serveur reste seul juge, mais
// attendre son refus pour signaler « il manque une majuscule » fait perdre un
// aller-retour et affiche une erreur brute là où un message clair suffit.

export const PASSWORD_MIN_LENGTH = 8;

/**
 * Renvoie un message d'erreur, ou null si le mot de passe convient.
 */
export function validatePassword(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `Le mot de passe doit faire au moins ${PASSWORD_MIN_LENGTH} caractères.`;
  }
  if (!/[A-Z]/.test(password)) {
    return 'Le mot de passe doit contenir au moins une majuscule.';
  }
  if (!/[a-z]/.test(password)) {
    return 'Le mot de passe doit contenir au moins une minuscule.';
  }
  return null;
}
