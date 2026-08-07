import { applyDecorators } from '@nestjs/common';
import { IsString, Matches } from 'class-validator';

// Numéro marocain : 06/07 (mobile) ou 05 (fixe), en national ou avec +212.
export const MOROCCAN_PHONE_REGEX = /^(?:\+212|0)([5-7]\d{8})$/;

/**
 * Validation du téléphone, définie **une seule fois**.
 *
 * Auparavant, seul RegisterDto imposait ce format ; UpdateProfileDto acceptait
 * n'importe quelle chaîne de 20 caractères. Une cliente pouvait donc contourner
 * la règle en modifiant son profil — et l'institut se retrouvait avec un numéro
 * injoignable, alors que c'est le seul moyen de confirmer commandes et RDV.
 */
export function IsMoroccanPhone() {
  return applyDecorators(
    IsString({ message: 'Le numéro de téléphone est obligatoire.' }),
    Matches(MOROCCAN_PHONE_REGEX, {
      message:
        'Le numéro doit être un numéro marocain valide (ex. 0612345678 ou +212612345678).',
    }),
  );
}
