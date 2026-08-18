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
 * Langue à utiliser pour une requête, d'après son en-tête `Accept-Language`.
 *
 * Le back-office n'envoie rien : il retombe donc sur le français, exactement
 * comme avant. L'application mobile envoie la langue choisie par la cliente.
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
