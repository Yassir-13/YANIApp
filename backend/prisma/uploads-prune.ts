import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { resolveUploadsDir } from '../src/uploads/uploads.config';

/**
 * Supprime les images qu'aucune fiche ne référence.
 *
 * ── Pourquoi une commande séparée, et pas une suppression à la volée ──
 *
 * Le dossier d'images ne participe pas à la transaction Prisma. Supprimer
 * l'ancien fichier dans la requête qui change `image_url`, c'est effacer une
 * photo encore servie dès que la transaction est annulée — un trou définitif
 * dans le catalogue, causé par une écriture qui n'a jamais eu lieu. Les
 * fichiers restent donc, et ce sont eux que cette commande ramasse, plus tard,
 * en connaissant l'état réel de la base.
 *
 * ── Pourquoi un âge minimum ──
 *
 * Le back-office téléverse la photo AVANT d'enregistrer la fiche. Entre les
 * deux, le fichier n'est référencé par rien et ressemble en tout point à un
 * orphelin. Le seuil laisse à la gérante le temps de finir sa saisie.
 *
 * Usage :
 *   npm run uploads:prune                                (liste seule)
 *   npm run uploads:prune -- --apply
 *   npm run uploads:prune -- --apply --older-than=72h
 */

const prisma = new PrismaClient();

const UPLOADS = resolveUploadsDir(process.env.UPLOADS_DIR);

const appliquer = process.argv.includes('--apply');

const AGE_DEFAUT = 24;

function heuresMinimum(): number {
  const arg = process.argv.find((a) => a.startsWith('--older-than='));
  if (!arg) return AGE_DEFAUT;

  const valeur = /^(\d+)h$/.exec(arg.split('=')[1]);
  if (!valeur) {
    throw new Error('Âge attendu en heures, par exemple --older-than=24h');
  }
  return Number(valeur[1]);
}

export interface Tri {
  /** Fichiers qu'une fiche affiche : intouchables. */
  references: number;
  /** Trop récents pour être jugés — une saisie peut être en cours. */
  recents: number;
  /** Sous-dossiers et liens : laissés tels quels. */
  ignores: number;
  orphelins: { nom: string; octets: number }[];
}

export function trier(
  dossier: string,
  references: Set<string>,
  limite: number,
): Tri {
  const tri: Tri = { references: 0, recents: 0, ignores: 0, orphelins: [] };

  for (const entree of fs.readdirSync(dossier, { withFileTypes: true })) {
    if (!entree.isFile()) {
      tri.ignores++;
      continue;
    }

    if (references.has(entree.name)) {
      tri.references++;
      continue;
    }

    // Le chemin est construit depuis un nom lu dans le dossier : il ne peut
    // pas en sortir. Sauf par un lien, dont la CIBLE est ailleurs — et que
    // `unlink` suivrait.
    const chemin = path.join(dossier, entree.name);
    if (path.dirname(fs.realpathSync(chemin)) !== fs.realpathSync(dossier)) {
      tri.ignores++;
      continue;
    }

    const stat = fs.statSync(chemin);
    if (stat.mtimeMs > limite) {
      tri.recents++;
      continue;
    }

    tri.orphelins.push({ nom: entree.name, octets: stat.size });
  }

  return tri;
}

const taille = (octets: number) => `${Math.round(octets / 1024)} Ko`;

async function main() {
  if (!fs.existsSync(UPLOADS)) {
    console.log(`Dossier d'images absent : ${UPLOADS}`);
    return;
  }

  const heures = heuresMinimum();

  const [services, produits] = await Promise.all([
    prisma.service.findMany({ select: { imageUrl: true } }),
    prisma.product.findMany({ select: { imageUrl: true } }),
  ]);
  const references = new Set(
    [...services, ...produits]
      .map((l) => l.imageUrl)
      .filter((url): url is string => !!url)
      .map((url) => path.basename(url)),
  );

  const tri = trier(UPLOADS, references, Date.now() - heures * 3600 * 1000);

  console.log(`Dossier : ${UPLOADS}`);
  console.log(
    `${tri.references} fichier(s) référencé(s), ${tri.recents} de moins de ${heures}h, ${tri.orphelins.length} orphelin(s).`,
  );
  if (tri.ignores > 0) {
    console.log(`${tri.ignores} entrée(s) laissée(s) de côté.`);
  }
  console.log('');

  let liberes = 0;
  for (const fichier of tri.orphelins) {
    if (appliquer) fs.unlinkSync(path.join(UPLOADS, fichier.nom));
    liberes += fichier.octets;
    console.log(`  ${fichier.nom} — ${taille(fichier.octets)}`);
  }

  if (tri.orphelins.length === 0) return;

  console.log('');
  console.log(
    appliquer
      ? `${tri.orphelins.length} fichier(s) supprimé(s), ${taille(liberes)} libéré(s).`
      : `${tri.orphelins.length} fichier(s) à supprimer, ${taille(liberes)}. Aucune suppression : ajoutez --apply.`,
  );
}

// Lancé en commande, pas quand les tests importent `trier`.
if (require.main === module) {
  main()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
