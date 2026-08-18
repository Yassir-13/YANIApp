// Règles de mot de passe, alignées sur IsAppPassword côté backend.
//
// Elles sont volontairement redites ici : le serveur reste seul juge, mais
// attendre son refus pour signaler « il manque une majuscule » fait perdre un
// aller-retour et affiche une erreur brute là où un message clair suffit.

export const PASSWORD_MIN_LENGTH = 8;

// La fonction est pure : elle n'a pas accès à `t`. Elle renvoie donc la CLÉ
// de traduction, que l'écran affiche via `t(cle, { min: PASSWORD_MIN_LENGTH })`.
// Le type est une union de clés littérales : une clé inventée ne compile pas.
export type PasswordViolation =
  | 'errors.passwordTooShort'
  | 'errors.passwordNoUppercase'
  | 'errors.passwordNoLowercase';

/**
 * Renvoie une clé de message d'erreur, ou null si le mot de passe convient.
 */
export function validatePassword(password: string): PasswordViolation | null {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return 'errors.passwordTooShort';
  }
  if (!/[A-Z]/.test(password)) {
    return 'errors.passwordNoUppercase';
  }
  if (!/[a-z]/.test(password)) {
    return 'errors.passwordNoLowercase';
  }
  return null;
}
