import { join, resolve } from 'node:path';

/**
 * Réglages partagés du stockage d'images.
 *
 * Ce fichier existe parce que deux endroits très éloignés ont besoin des mêmes
 * valeurs : le module qui ÉCRIT les fichiers, et `main.ts` qui les SERT en
 * statique. Les dupliquer donnerait le bug le plus discret qui soit — des
 * téléversements qui réussissent, dans un dossier que personne ne sert.
 */

/** Préfixe d'URL sous lequel les images sont servies. */
export const UPLOADS_ROUTE = '/uploads';

/**
 * Plafond par image. Volontairement bas : ce sont des photos de prestations
 * affichées dans une vignette de quelques centaines de pixels, et l'application
 * mobile les télécharge souvent en 4G. Un JPEG de 5 Mo est déjà bien au-delà de
 * ce qu'un appareil photo de téléphone produit pour cet usage.
 */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/**
 * Forme exacte d'un chemin renvoyé par `POST /uploads/image` : le préfixe, un
 * UUID v4, l'une des trois extensions acceptées.
 *
 * C'est la seule valeur que `imageUrl` accepte, côté prestations comme côté
 * produits. Le champ part directement dans un `<img src>` de l'application et
 * du backoffice : y laisser passer une adresse quelconque, c'était laisser une
 * saisie choisir ce que les clientes téléchargent, et depuis quel serveur.
 *
 * Le chemin reste RELATIF, et c'est délibéré : le backoffice et l'application
 * mobile ne joignent pas l'API par la même adresse (localhost pour l'un, l'IP
 * du réseau local ou le nom de domaine pour l'autre). Chacun préfixe donc ce
 * chemin par SA propre base d'API. Une URL absolue enregistrée en base gèlerait
 * l'adresse du jour où la photo a été ajoutée — et les images deviendraient
 * introuvables le jour où l'institut prendra son nom de domaine.
 */
export const UPLOADED_IMAGE_PATH =
  /^\/uploads\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/;

/**
 * Dossier de stockage sur le disque.
 *
 * `UPLOADS_DIR` permet de le placer ailleurs (un disque monté, un volume). À
 * défaut, `./uploads` à la racine du processus : `backend/uploads` en
 * développement, `/app/uploads` dans le conteneur — où un volume Docker doit
 * être monté, faute de quoi les images partent à chaque reconstruction.
 */
export function resolveUploadsDir(value?: string): string {
  const raw = value?.trim();
  return raw ? resolve(raw) : join(process.cwd(), 'uploads');
}
