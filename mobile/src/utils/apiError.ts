import axios from 'axios';
import i18n from '../i18n';

// Traduction d'une erreur d'API en une phrase affichable.
//
// Trois pièges, qu'un `catch` naïf tombe tous les trois :
//
//  1. Le serveur renvoie parfois un TABLEAU de messages — une ligne par règle
//     violée, c'est le format de son filtre d'exceptions. Affiché tel quel, il
//     s'imprime collé : « Le prénom ne peut pas être videLe nom est requis ».
//  2. Un message de repli écrit pour UNE cause ment sur toutes les autres.
//     L'écran « changer mon mot de passe » disait « vérifiez votre mot de passe
//     actuel » y compris sur une coupure réseau ou un 429 — donc il accusait la
//     cliente d'une faute qu'elle n'avait pas commise.
//  3. Le 429 est invisible autrement : les routes sensibles sont limitées
//     (10/min sur le mot de passe), et rien ne l'explique à l'écran.
export function apiErrorMessage(e: unknown, repli: string): string {
  const message = axios.isAxiosError(e)
    ? (e.response?.data as { message?: string | string[] } | undefined)?.message
    : undefined;

  // Le message du serveur d'abord : il est plus précis que tout repli.
  if (Array.isArray(message)) return message.join('\n');
  if (typeof message === 'string' && message.trim()) return message;

  if (axios.isAxiosError(e)) {
    if (!e.response) {
      return i18n.t('errors.network');
    }
    if (e.response.status === 429) {
      return i18n.t('errors.tooManyAttempts');
    }
  }

  return repli;
}
