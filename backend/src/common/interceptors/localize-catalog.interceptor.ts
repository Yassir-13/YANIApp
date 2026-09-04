import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Request } from 'express';
import { Observable, map } from 'rxjs';
import { requestLanguage, type ServerLanguage } from '../../i18n';

/**
 * Sert le CONTENU du catalogue dans la langue de la requête.
 *
 * L'interface de l'application était traduite depuis longtemps, mais pas ce
 * qu'elle affiche : une cliente en arabe lisait « Lifting Colombien Boost -
 * Pack du 6 seances » au milieu d'un écran arabe.
 *
 * ── Pourquoi un intercepteur, et pas une traduction dans chaque service ──
 *
 * Un nom de prestation ne sort pas que de `GET /services`. Il ressort dans un
 * rendez-vous, une récompense de palier, un bon, une ligne d'historique de
 * points, une commande — une quinzaine de routes, dont certaines imbriquent
 * l'objet à deux niveaux. Traduire dans chaque service aurait voulu dire
 * retrouver ces quinze endroits, puis y penser à chaque nouvelle route.
 *
 * Ici, la règle est posée une fois : tout objet de la réponse qui porte une
 * traduction est servi traduit, où qu'il se trouve. C'est déjà le
 * fonctionnement de `TranslateResponseInterceptor` pour les messages.
 *
 * ── Ce qui sort, et ce qui ne sort pas ──
 *
 * En français, la réponse n'est pas touchée du tout : le back-office reçoit
 * ses colonnes `nameAr`/`nameEn` et peut donc les éditer.
 *
 * Dans les deux autres langues, `name` et `description` portent la traduction
 * et les colonnes de traduction disparaissent de la réponse. L'application
 * mobile n'a pas une ligne à changer : elle lit `name` comme avant. Et une
 * fiche pas encore traduite garde son français — un texte lisible vaut mieux
 * qu'un trou.
 */
@Injectable()
export class LocalizeCatalogInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const langue = requestLanguage(request.headers);

    if (langue === 'fr') return next.handle();

    return next.handle().pipe(map((body) => localiser(body, langue)));
  }
}

// Champ affiché, et les deux colonnes qui le traduisent.
const CHAMPS = [
  { base: 'name', ar: 'nameAr', en: 'nameEn' },
  { base: 'description', ar: 'descriptionAr', en: 'descriptionEn' },
] as const;

const COLONNES_DE_TRADUCTION = new Set<string>(
  CHAMPS.flatMap((c) => [c.ar, c.en]),
);

/**
 * Un objet de données, par opposition à une Date, un Decimal ou un Buffer.
 *
 * Le test porte sur le prototype, et pas sur `typeof` : Prisma renvoie ses
 * entités en objets littéraux, mais ses prix en `Decimal` et ses horodatages
 * en `Date`. Recopier ces deux-là champ par champ les détruirait — un prix
 * deviendrait `{ s: 1, e: 2, d: [150] }` dans le JSON.
 */
function estObjetDeDonnees(v: unknown): v is Record<string, unknown> {
  if (v === null || typeof v !== 'object') return false;
  const proto = Object.getPrototypeOf(v) as unknown;
  return proto === Object.prototype || proto === null;
}

function localiser(
  valeur: unknown,
  langue: Exclude<ServerLanguage, 'fr'>,
): unknown {
  if (Array.isArray(valeur)) {
    return valeur.map((v) => localiser(v, langue));
  }
  if (!estObjetDeDonnees(valeur)) {
    return valeur;
  }

  const sortie: Record<string, unknown> = {};

  for (const [cle, v] of Object.entries(valeur)) {
    if (COLONNES_DE_TRADUCTION.has(cle)) continue;
    sortie[cle] = localiser(v, langue);
  }

  for (const champ of CHAMPS) {
    // Uniquement si l'objet porte VRAIMENT ce champ : sans cette garde, une
    // réponse quelconque se verrait ajouter un `name` venu de nulle part.
    if (!(champ.base in valeur)) continue;

    const traduit = valeur[champ[langue]];
    // Une traduction vide n'en est pas une : la fiche n'est pas encore
    // traduite, ou la case a été effacée dans le back-office. Le français
    // saisi par la gérante reste alors la meilleure réponse possible.
    if (typeof traduit === 'string' && traduit.trim() !== '') {
      sortie[champ.base] = traduit;
    }
  }

  return sortie;
}
