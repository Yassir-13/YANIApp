import { applyDecorators } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { IsString, Matches } from 'class-validator';

export const VERIFICATION_CODE_LENGTH = 6;

/**
 * Code à usage unique reçu par email (confirmation d'adresse, mot de passe
 * oublié).
 *
 * Le code est affiché espacé dans l'email (« 482 913 ») pour être recopié sans
 * erreur : on retire donc tout espace avant de valider, sinon une cliente qui
 * colle le code tel quel se verrait reprocher un format invalide alors qu'elle
 * a saisi le bon code. Même chose pour les espaces insécables que certains
 * clients mail insèrent à la copie.
 */
export function IsVerificationCode() {
  return applyDecorators(
    Transform(({ value }) =>
      typeof value === 'string' ? value.replace(/\s/g, '') : value,
    ),
    IsString({ message: 'Le code est obligatoire.' }),
    Matches(new RegExp(`^\\d{${VERIFICATION_CODE_LENGTH}}$`), {
      message: `Le code doit contenir ${VERIFICATION_CODE_LENGTH} chiffres.`,
    }),
  );
}
