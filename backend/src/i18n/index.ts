import {
  MESSAGES,
  PATTERNS,
  FRAGMENTS,
  type ServerLanguage,
} from './messages';

export type { ServerLanguage };
export { MESSAGES, PATTERNS, FRAGMENTS };

const LANGUES: readonly ServerLanguage[] = ['fr', 'ar', 'en'];

/**
 * Langue à utiliser pour une requête, d'après une étiquette de langue.
 *
 * On ne lit que la PREMIÈRE étiquette et on ignore les facteurs de qualité
 * (`;q=0.9`). Un navigateur en envoie une liste ordonnée ; nous n'avons que
 * trois langues et un repli sûr, le raffinement n'apporterait rien.
 */
export function pickLanguage(header?: string | string[]): ServerLanguage {
  const brut = Array.isArray(header) ? header[0] : header;
  if (!brut) return 'fr';

  const code = brut.split(',')[0].trim().split('-')[0].toLowerCase();
  return (LANGUES as readonly string[]).includes(code)
    ? (code as ServerLanguage)
    : 'fr';
}

/**
 * Langue d'UNE requête, d'après ses en-têtes.
 *
 * `X-Locale` l'emporte sur `Accept-Language`, et c'est volontaire : le
 * back-office envoie `X-Locale: fr` pour recevoir le catalogue tel qu'il est
 * saisi, quelle que soit la langue du navigateur de la gérante.
 *
 * Ce détour n'est pas de la ceinture et des bretelles. `Accept-Language` fait
 * partie des en-têtes qu'une page web ne PEUT PAS écrire : le navigateur le
 * pose lui-même, avec sa propre langue. Un back-office ouvert dans un Chrome
 * en anglais recevait donc déjà les messages d'erreur en anglais, malgré le
 * commentaire qui affirmait le contraire. Sur le catalogue, la conséquence
 * aurait été plus grave qu'un affichage : le formulaire aurait chargé la
 * traduction anglaise dans le champ français, et l'aurait réenregistrée par
 * dessus l'original au premier « Enregistrer ».
 */
export function requestLanguage(headers: {
  'x-locale'?: string | string[];
  'accept-language'?: string | string[];
}): ServerLanguage {
  return pickLanguage(headers['x-locale'] ?? headers['accept-language']);
}

/**
 * Traduit UN message. Rendu inchangé si la langue est le français, ou si le
 * message n'a pas d'entrée — mieux vaut du français lisible qu'une clé brute.
 */
function traduireTexte(texte: string, langue: ServerLanguage): string {
  if (langue === 'fr') return texte;

  const direct = MESSAGES[texte];
  if (direct) return direct[langue];

  for (const motif of PATTERNS) {
    const m = texte.match(motif.re);
    if (m) {
      let rendu = motif[langue](m);
      for (const f of FRAGMENTS) {
        rendu = rendu.replace(f.re, f[langue]);
      }
      return rendu;
    }
  }

  return texte;
}

/**
 * Traduit ce que le filtre d'exceptions s'apprête à renvoyer.
 *
 * Le corps peut être une chaîne OU un tableau : le `ValidationPipe` renvoie
 * une ligne par règle violée, et l'application les affiche toutes. Chaque
 * élément se traduit séparément.
 */
export function translateMessage(
  message: unknown,
  langue: ServerLanguage,
): unknown {
  if (langue === 'fr') return message;
  if (typeof message === 'string') return traduireTexte(message, langue);
  if (Array.isArray(message)) {
    return message.map((m) =>
      typeof m === 'string' ? traduireTexte(m, langue) : m,
    );
  }
  return message;
}
