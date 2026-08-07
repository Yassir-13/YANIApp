import { applyDecorators } from '@nestjs/common';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export const PASSWORD_MIN_LENGTH = 8;
// Plafond volontaire : argon2 n'a pas de limite propre, mais accepter une
// chaîne de plusieurs Mo laisserait saturer le CPU du serveur à chaque essai.
export const PASSWORD_MAX_LENGTH = 72;

/**
 * Règle de mot de passe, définie **une seule fois** et appliquée partout.
 *
 * Auparavant, la règle vivait uniquement dans RegisterDto : on pouvait donc
 * s'inscrire avec un mot de passe conforme, puis le remplacer par « 12345678 »
 * via le changement de mot de passe, qui n'imposait qu'une longueur minimale.
 *
 * Niveau volontairement modéré (une majuscule, une minuscule) : la clientèle
 * du centre n'est pas à l'aise avec les contraintes complexes, et un mot de
 * passe noté sur un papier vaut moins qu'un mot de passe simple mémorisé.
 */
export function IsAppPassword() {
  return applyDecorators(
    IsString({ message: 'Le mot de passe est obligatoire.' }),
    MinLength(PASSWORD_MIN_LENGTH, {
      message: `Le mot de passe doit faire au moins ${PASSWORD_MIN_LENGTH} caractères.`,
    }),
    MaxLength(PASSWORD_MAX_LENGTH, {
      message: `Le mot de passe ne doit pas dépasser ${PASSWORD_MAX_LENGTH} caractères.`,
    }),
    Matches(/[A-Z]/, {
      message: 'Le mot de passe doit contenir au moins une majuscule.',
    }),
    Matches(/[a-z]/, {
      message: 'Le mot de passe doit contenir au moins une minuscule.',
    }),
  );
}
