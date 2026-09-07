import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import {
  UPLOADED_IMAGE_PATH,
  resolveUploadsDir,
} from '../src/uploads/uploads.config';

/**
 * Installe le catalogue initial : les fiches ET leurs photos.
 *
 * ── Pourquoi ce script existe ──
 *
 * Le catalogue ne vivait que dans une base locale et dans les dumps de
 * `backups/`, ignoré par Git parce qu'il contient les données des clientes. Un
 * clone propre obtenait donc une application vide : les horaires et le compte
 * administrateur du seed, et pas une seule prestation. Ce script est la moitié
 * manquante — celle que le dépôt a le droit de porter, puisque prix, textes et
 * photos sont déjà publics dans l'application.
 *
 * ── Pourquoi les photos aussi ──
 *
 * Les images ne sont PAS dans la base : `pg_dump` ne les voit pas, et le
 * back-office les range sous un nom tiré au sort. Une installation neuve avec
 * les bonnes fiches et aucun fichier affiche un catalogue entièrement troué,
 * sans que rien ne le signale. Le fichier associe donc chaque fiche à son
 * visuel versionné dans `brand/`, et à l'adresse sous laquelle l'API le sert.
 *
 * ── Ce que le script ne fait jamais ──
 *
 * Il ne touche pas à un catalogue déjà rempli. Ni les prix, ni les stocks, ni
 * les textes, ni les photos que la gérante a changés depuis. La règle est celle
 * du seed : table non vide = installation en service, on ne touche à rien. Il
 * n'écrase pas non plus un fichier déjà présent dans le dossier d'images — une
 * adresse déjà servie est définitive, elle est en cache dans les téléphones.
 *
 * Usage :
 *   npm run catalog:sync            (contrôle seul, n'écrit rien)
 *   npm run catalog:sync -- --apply
 */

const prisma = new PrismaClient();

export interface Fiche {
  category: string;
  name: string;
  description?: string;
  price: string;
  stockQty?: number;
  image: string;
  imageUrl: string;
}

interface Recompense {
  name: string;
  description?: string;
  pointsCost: number;
}

export interface Fichier {
  serviceCategories: string[];
  productCategories: string[];
  services: Fiche[];
  products: Fiche[];
  rewards: Recompense[];
}

const CHEMIN = path.join(__dirname, 'catalog-initial.json');

// Les visuels sont à la racine du dépôt, hors de `backend/` : ils servent aussi
// à la marque et aux fiches produit. Ce script tourne donc depuis un clone, et
// jamais depuis l'image Docker, qui n'embarque que `backend/`.
const VISUELS = path.join(__dirname, '..', '..', 'brand');

const UPLOADS = resolveUploadsDir(process.env.UPLOADS_DIR);

const appliquer = process.argv.includes('--apply');

interface Section {
  titre: string;
  fiches: Fiche[];
  categories: string[];
  dossier: string;
}

const sections = (f: Fichier): Section[] => [
  {
    titre: 'Prestations',
    fiches: f.services,
    categories: f.serviceCategories,
    dossier: 'service-images',
  },
  {
    titre: 'Produits',
    fiches: f.products,
    categories: f.productCategories,
    dossier: 'product-images',
  },
];

/**
 * Contrôle le fichier seul, sans la base.
 *
 * Chacun de ces cinq points s'est déjà produit : une adresse hors contrat que
 * la validation refuse ensuite en modification, un même visuel recopié sous
 * deux noms — vingt-trois fichiers orphelins dans le dossier d'images.
 */
export function controler(f: Fichier): string[] {
  const erreurs: string[] = [];
  const urlParImage = new Map<string, string>();
  const imageParUrl = new Map<string, string>();

  for (const s of sections(f)) {
    const vus = new Set<string>();

    for (const fiche of s.fiches) {
      const ou = `${s.titre} → « ${fiche.name} »`;

      // Le nom français est la clé du catalogue, ici comme dans les
      // traductions : deux fiches homonymes en rendraient une intraduisible.
      if (vus.has(fiche.name)) erreurs.push(`${ou} : nom en double`);
      vus.add(fiche.name);

      if (!s.categories.includes(fiche.category)) {
        erreurs.push(`${ou} : catégorie inconnue « ${fiche.category} »`);
      }

      if (!UPLOADED_IMAGE_PATH.test(fiche.imageUrl)) {
        erreurs.push(`${ou} : adresse hors contrat « ${fiche.imageUrl} »`);
      }

      if (path.extname(fiche.image) !== path.extname(fiche.imageUrl)) {
        erreurs.push(`${ou} : ${fiche.image} servi en ${fiche.imageUrl}`);
      }

      if (!fs.existsSync(path.join(VISUELS, s.dossier, fiche.image))) {
        erreurs.push(`${ou} : visuel absent (${s.dossier}/${fiche.image})`);
      }

      const urlConnue = urlParImage.get(fiche.image);
      if (urlConnue && urlConnue !== fiche.imageUrl) {
        erreurs.push(`${ou} : ${fiche.image} déjà servi en ${urlConnue}`);
      }
      urlParImage.set(fiche.image, fiche.imageUrl);

      const imageConnue = imageParUrl.get(fiche.imageUrl);
      if (imageConnue && imageConnue !== fiche.image) {
        erreurs.push(`${ou} : ${fiche.imageUrl} sert déjà ${imageConnue}`);
      }
      imageParUrl.set(fiche.imageUrl, fiche.image);
    }
  }

  return erreurs;
}

/**
 * Copie les visuels manquants dans le dossier servi par l'API.
 *
 * AVANT l'écriture en base, et à dessein : le système de fichiers ne participe
 * pas à la transaction Prisma. Une copie faite pour rien laisse un fichier que
 * `uploads:prune` ramassera ; une fiche écrite dont la photo manque laisse un
 * trou visible par les clientes.
 */
function copierVisuels(f: Fichier): number {
  fs.mkdirSync(UPLOADS, { recursive: true });
  let copies = 0;

  for (const s of sections(f)) {
    for (const fiche of s.fiches) {
      const cible = path.join(UPLOADS, path.basename(fiche.imageUrl));
      if (fs.existsSync(cible)) continue;
      fs.copyFileSync(path.join(VISUELS, s.dossier, fiche.image), cible);
      copies++;
    }
  }

  return copies;
}

async function importer(f: Fichier): Promise<string[]> {
  return prisma.$transaction(async (tx) => {
    const resume: string[] = [];

    // Les catégories comptent autant que les fiches : une base qui en porte
    // déjà ferait échouer la création sur leur contrainte d'unicité.
    const prestations =
      (await tx.service.count()) + (await tx.serviceCategory.count());
    if (prestations > 0) {
      resume.push(`Prestations : ${prestations} ligne(s) en base, intactes.`);
    } else {
      const ids: Record<string, string> = {};
      for (const nom of f.serviceCategories) {
        const c = await tx.serviceCategory.create({
          data: { name: nom },
          select: { id: true },
        });
        ids[nom] = c.id;
      }
      await tx.service.createMany({
        data: f.services.map((s) => ({
          categoryId: ids[s.category],
          name: s.name,
          description: s.description,
          price: s.price,
          imageUrl: s.imageUrl,
        })),
      });
      resume.push(
        `Prestations : ${f.serviceCategories.length} catégorie(s) et ${f.services.length} fiche(s) créées.`,
      );
    }

    const produits =
      (await tx.product.count()) + (await tx.productCategory.count());
    if (produits > 0) {
      resume.push(`Produits : ${produits} ligne(s) en base, intactes.`);
    } else {
      const ids: Record<string, string> = {};
      for (const nom of f.productCategories) {
        const c = await tx.productCategory.create({
          data: { name: nom },
          select: { id: true },
        });
        ids[nom] = c.id;
      }
      await tx.product.createMany({
        data: f.products.map((p) => ({
          categoryId: ids[p.category],
          name: p.name,
          description: p.description,
          price: p.price,
          stockQty: p.stockQty,
          imageUrl: p.imageUrl,
        })),
      });
      resume.push(
        `Produits : ${f.productCategories.length} catégorie(s) et ${f.products.length} fiche(s) créés.`,
      );
    }

    // Les récompenses sont du même voyage : sans elles, le programme de
    // fidélité d'une installation neuve n'a rien à offrir, et
    // `catalog:translate` signale deux fiches sans traduction pour toujours.
    const recompenses = await tx.reward.count();
    if (recompenses > 0) {
      resume.push(`Récompenses : ${recompenses} ligne(s) en base, intactes.`);
    } else {
      await tx.reward.createMany({ data: f.rewards });
      resume.push(`Récompenses : ${f.rewards.length} fiche(s) créées.`);
    }

    return resume;
  });
}

async function main() {
  if (!fs.existsSync(CHEMIN)) {
    throw new Error(`Catalogue initial introuvable : ${CHEMIN}`);
  }
  if (!fs.existsSync(VISUELS)) {
    throw new Error(
      `Dossier des visuels introuvable : ${VISUELS}\n` +
        "Ce script se lance depuis un clone du dépôt, pas depuis l'image Docker.",
    );
  }
  const fichier = JSON.parse(fs.readFileSync(CHEMIN, 'utf8')) as Fichier;

  const erreurs = controler(fichier);
  for (const e of erreurs) console.log(`  ⚠ ${e}`);
  if (erreurs.length > 0) {
    console.log('');
    console.log(`${erreurs.length} anomalie(s) : rien n'a été écrit.`);
    process.exitCode = 1;
    return;
  }

  for (const s of sections(fichier)) {
    console.log(`${s.titre} : ${s.fiches.length} fiche(s) au fichier.`);
  }
  console.log(`Récompenses : ${fichier.rewards.length} fiche(s) au fichier.`);
  console.log('');

  // Une base et un dossier d'images vides sont l'état NORMAL d'une
  // installation neuve, pas une anomalie : le contrôle les décrit, et sort en
  // 0. Seul un fichier fautif fait échouer l'intégration continue.
  const adresses = new Set(
    sections(fichier).flatMap((s) => s.fiches.map((f) => f.imageUrl)),
  );
  const manquants = [...adresses].filter(
    (url) => !fs.existsSync(path.join(UPLOADS, path.basename(url))),
  );
  console.log(
    `${manquants.length} visuel(s) à copier vers ${UPLOADS}, sur ${adresses.size}.`,
  );

  if (!appliquer) {
    const [services, products, rewards] = await Promise.all([
      prisma.service.count(),
      prisma.product.count(),
      prisma.reward.count(),
    ]);
    console.log(
      `Base : ${services} prestation(s), ${products} produit(s), ${rewards} récompense(s).`,
    );
    console.log('');
    console.log('Aucune écriture : ajoutez --apply.');
    return;
  }

  const copies = copierVisuels(fichier);
  console.log(`${copies} visuel(s) copié(s).`);
  for (const ligne of await importer(fichier)) console.log(ligne);
}

// Lancé en commande, pas quand les tests importent `controler`.
if (require.main === module) {
  main()
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
