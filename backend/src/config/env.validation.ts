import { plainToInstance } from 'class-transformer';
import {
  IsIn,
  IsNumberString,
  IsOptional,
  IsString,
  MinLength,
  validateSync,
} from 'class-validator';

// Longueur minimale du secret JWT. Un secret court est brute-forçable hors ligne :
// il permettrait de forger un access token admin sans jamais toucher à l'API.
export const JWT_SECRET_MIN_LENGTH = 32;

class EnvironmentVariables {
  @IsOptional()
  @IsIn(['development', 'production', 'test'], {
    message:
      "NODE_ENV doit valoir 'development', 'production' ou 'test'. " +
      'Une faute de frappe exposerait Swagger en production.',
  })
  NODE_ENV?: string;

  @IsString({ message: 'DATABASE_URL est obligatoire.' })
  @MinLength(1, { message: 'DATABASE_URL ne doit pas être vide.' })
  DATABASE_URL!: string;

  // Signé dans auth.module, vérifié dans jwt.strategy : les deux lisent
  // cette même variable, qui doit donc exister avant tout démarrage.
  @IsString({ message: 'JWT_SECRET est obligatoire (aucune valeur de repli).' })
  @MinLength(JWT_SECRET_MIN_LENGTH, {
    message: `JWT_SECRET doit faire au moins ${JWT_SECRET_MIN_LENGTH} caractères.`,
  })
  JWT_SECRET!: string;

  // Durée de vie de l'access token, au format accepté par @nestjs/jwt (ex. '15m').
  @IsOptional()
  @IsString({ message: "JWT_EXPIRES_IN doit être une durée, ex. '15m'." })
  @MinLength(1, { message: 'JWT_EXPIRES_IN ne doit pas être vide.' })
  JWT_EXPIRES_IN?: string;

  // Lu via Number() dans auth.service : une valeur non numérique
  // donnerait une date d'expiration NaN, silencieusement invalide.
  @IsOptional()
  @IsNumberString(
    {},
    { message: 'JWT_REFRESH_EXPIRES_IN_DAYS doit être un nombre de jours.' },
  )
  JWT_REFRESH_EXPIRES_IN_DAYS?: string;

  // '1' uniquement si un reverse proxy de confiance est devant l'API.
  // Détermine si X-Forwarded-For est cru pour identifier l'IP cliente
  // (rate limiting). Voir le commentaire dans main.ts.
  @IsOptional()
  @IsIn(['0', '1'], { message: "TRUST_PROXY doit valoir '0' ou '1'." })
  TRUST_PROXY?: string;
}

// Appelée par ConfigModule au démarrage : toute erreur ici empêche l'application
// de se lancer, plutôt que de la laisser tourner dans un état non sécurisé.
export function validateEnv(config: Record<string, unknown>) {
  const parsed = plainToInstance(EnvironmentVariables, config);
  const errors = validateSync(parsed, { skipMissingProperties: false });

  if (errors.length > 0) {
    const details = errors
      .flatMap((error) => Object.values(error.constraints ?? {}))
      .map((message) => `  - ${message}`)
      .join('\n');

    throw new Error(
      `Configuration d'environnement invalide :\n${details}\n` +
        'Corrigez le fichier .env avant de démarrer le serveur.',
    );
  }

  return parsed;
}
