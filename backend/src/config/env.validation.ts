import { plainToInstance } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsNumberString,
  IsOptional,
  IsString,
  MinLength,
  ValidateIf,
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

  // Port d'écoute, lu via Number() dans main.ts. La plupart des hébergeurs
  // l'imposent. Une valeur non numérique donnerait un port NaN : l'API
  // démarrerait sur un port choisi au hasard par le système, donc injoignable.
  @IsOptional()
  @IsNumberString({}, { message: 'PORT doit être un nombre (ex. 3000).' })
  PORT?: string;

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

  // Dossier où sont écrites les images du catalogue. À défaut, `./uploads`.
  // Ces fichiers ne sont PAS dans la base : la sauvegarde SQL ne les emporte
  // pas, il faut copier ce dossier à part.
  @IsOptional()
  @IsString({ message: 'UPLOADS_DIR doit être un chemin de dossier.' })
  @MinLength(1, { message: 'UPLOADS_DIR ne doit pas être vide.' })
  UPLOADS_DIR?: string;

  // ── Envoi des emails (codes de confirmation, mot de passe oublié) ──
  // 'console' : rien ne part, les codes s'affichent dans les logs (développement).
  // 'smtp'    : envoi réel. Défaut 'console', pour ne rien envoyer par accident.
  @IsOptional()
  @IsIn(['console', 'smtp'], {
    message: "MAIL_DRIVER doit valoir 'console' ou 'smtp'.",
  })
  MAIL_DRIVER?: string;

  // Les trois variables suivantes ne sont exigées qu'en mode 'smtp' : en
  // développement, personne n'a à renseigner un serveur de mail pour démarrer
  // l'API. En revanche, dès qu'on bascule en 'smtp', leur absence arrête le
  // démarrage — un envoi qui échoue ne fait pas échouer la requête (voir
  // MailService.send), donc sans ce garde-fou la panne resterait invisible.
  @ValidateIf((env: EnvironmentVariables) => env.MAIL_DRIVER === 'smtp')
  @IsString({ message: "SMTP_HOST est obligatoire quand MAIL_DRIVER vaut 'smtp'." })
  @MinLength(1, { message: 'SMTP_HOST ne doit pas être vide.' })
  SMTP_HOST?: string;

  @ValidateIf((env: EnvironmentVariables) => env.MAIL_DRIVER === 'smtp')
  @IsString({ message: "SMTP_USER est obligatoire quand MAIL_DRIVER vaut 'smtp'." })
  @MinLength(1, { message: 'SMTP_USER ne doit pas être vide.' })
  SMTP_USER?: string;

  @ValidateIf((env: EnvironmentVariables) => env.MAIL_DRIVER === 'smtp')
  @IsString({
    message: "SMTP_PASSWORD est obligatoire quand MAIL_DRIVER vaut 'smtp'.",
  })
  @MinLength(1, { message: 'SMTP_PASSWORD ne doit pas être vide.' })
  SMTP_PASSWORD?: string;

  // Lu via Number() dans MailService : détermine aussi le mode TLS (465 =
  // implicite, 587 = STARTTLS). Une valeur non numérique donnerait un port NaN.
  @IsOptional()
  @IsNumberString({}, { message: 'SMTP_PORT doit être un nombre (ex. 587).' })
  SMTP_PORT?: string;

  // Adresse affichée comme expéditeur. À défaut, SMTP_USER est utilisé.
  @IsOptional()
  @IsEmail({}, { message: 'MAIL_FROM doit être une adresse email valide.' })
  MAIL_FROM?: string;

  @IsOptional()
  @IsString({ message: "MAIL_FROM_NAME doit être un texte (ex. 'Institut Yani')." })
  MAIL_FROM_NAME?: string;
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

  // Le mode console est le défaut, ce qui est le bon choix en développement mais
  // le pire en production : les codes de confirmation s'écriraient dans les logs
  // et aucune cliente n'en recevrait jamais. Personne ne signalerait le problème
  // — on constaterait juste que plus personne ne finit son inscription.
  if (parsed.NODE_ENV === 'production' && parsed.MAIL_DRIVER !== 'smtp') {
    throw new Error(
      "En production, MAIL_DRIVER doit valoir 'smtp' : sans cela, les codes de " +
        "confirmation et de réinitialisation ne sont écrits que dans les logs et " +
        'ne parviennent à aucune cliente.',
    );
  }

  return parsed;
}
