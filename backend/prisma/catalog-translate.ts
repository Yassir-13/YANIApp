import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Charge les traductions arabe et anglaise du catalogue.
 *
 * ── Pourquoi un fichier, et pas un SQL dans `backups/` ──
 *
 * `backups/` est ignoré par Git, parce qu'il contient des données clientes.
 * Une traduction n'en est pas une : c'est du contenu public, celui que
 * l'application affiche. La garder hors du dépôt aurait voulu dire qu'un clone
 * propre repart d'un catalogue entièrement français, sans que rien ne le
 * signale.
 *
 * ── Pourquoi le nom français sert de clé ──
 *
 * Les identifiants sont tirés au sort à la création : ceux de cette base ne
 * sont pas ceux d'une installation neuve. Le nom français, lui, est le même
 * partout et il est unique dans chaque table — c'est ce qui permet de rejouer
 * ce script sur une autre installation.
 *
 * La contrepartie est réelle et assumée : renommer une prestation dans le
 * back-office détache sa traduction. `--check` le dit, ligne par ligne.
 *
 * ── Ce que le script ne fait jamais ──
 *
 * Il n'écrit pas une seule colonne française, et il ne remplace pas une
 * traduction déjà saisie. Une correction faite par la gérante dans le
 * back-office survit donc à un rejeu. `--force` lève cette protection, pour le
 * cas où c'est le fichier qui fait autorité.
 *
 * Usage :
 *   npm run catalog:translate            (contrôle seul, n'écrit rien)
 *   npm run catalog:translate -- --apply
 *   npm run catalog:translate -- --apply --force
 */

const prisma = new PrismaClient();

interface Traduction {
  nameAr?: string;
  nameEn?: string;
  descriptionAr?: string;
  descriptionEn?: string;
}

type Section = Record<string, Traduction>;

interface Fichier {
  serviceCategories: Section;
  productCategories: Section;
  services: Section;
  products: Section;
  rewards: Section;
}

const CHEMIN = path.join(__dirname, 'catalog-translations.json');

const appliquer = process.argv.includes('--apply');
const forcer = process.argv.includes('--force');

// Une ligne du catalogue, vue par ce script : son nom français et l'état
// actuel de ses colonnes traduites.
interface Ligne {
  id: string;
  name: string;
  nameAr: string | null;
  nameEn: string | null;
  descriptionAr?: string | null;
  descriptionEn?: string | null;
}

interface Table {
  titre: string;
  section: keyof Fichier;
  avecDescription: boolean;
  lire: () => Promise<Ligne[]>;
  ecrire: (id: string, data: Traduction) => Promise<unknown>;
}

const TABLES: Table[] = [
  {
    titre: 'Catégories de prestations',
    section: 'serviceCategories',
    avecDescription: false,
    lire: () =>
      prisma.serviceCategory.findMany({
        select: { id: true, name: true, nameAr: true, nameEn: true },
      }),
    ecrire: (id, data) =>
      prisma.serviceCategory.update({ where: { id }, data }),
  },
  {
    titre: 'Catégories de produits',
    section: 'productCategories',
    avecDescription: false,
    lire: () =>
      prisma.productCategory.findMany({
        select: { id: true, name: true, nameAr: true, nameEn: true },
      }),
    ecrire: (id, data) =>
      prisma.productCategory.update({ where: { id }, data }),
  },
  {
    titre: 'Prestations',
    section: 'services',
    avecDescription: true,
    lire: () =>
      prisma.service.findMany({
        select: {
          id: true,
          name: true,
          nameAr: true,
          nameEn: true,
          descriptionAr: true,
          descriptionEn: true,
        },
      }),
    ecrire: (id, data) => prisma.service.update({ where: { id }, data }),
  },
  {
    titre: 'Produits',
    section: 'products',
    avecDescription: true,
    lire: () =>
      prisma.product.findMany({
        select: {
          id: true,
          name: true,
          nameAr: true,
          nameEn: true,
          descriptionAr: true,
          descriptionEn: true,
        },
      }),
    ecrire: (id, data) => prisma.product.update({ where: { id }, data }),
  },
  {
    titre: 'Récompenses',
    section: 'rewards',
    avecDescription: true,
    lire: () =>
      prisma.reward.findMany({
        select: {
          id: true,
          name: true,
          nameAr: true,
          nameEn: true,
          descriptionAr: true,
          descriptionEn: true,
        },
      }),
    ecrire: (id, data) => prisma.reward.update({ where: { id }, data }),
  },
];

const rempli = (v: string | null | undefined) => !!v && v.trim() !== '';

async function main() {
  if (!fs.existsSync(CHEMIN)) {
    throw new Error(`Fichier de traductions introuvable : ${CHEMIN}`);
  }
  const fichier = JSON.parse(fs.readFileSync(CHEMIN, 'utf8')) as Fichier;

  let ecrites = 0;
  let deja = 0;
  const manquantes: string[] = [];
  const orphelines: string[] = [];

  for (const table of TABLES) {
    const entrees = fichier[table.section] ?? {};
    const lignes = await table.lire();
    const noms = new Set(lignes.map((l) => l.name));

    // Une entrée du fichier qui ne correspond à aucune ligne : nom modifié
    // depuis, ou faute de frappe dans le fichier. Silencieuse autrement, elle
    // ne traduirait jamais rien.
    for (const nom of Object.keys(entrees)) {
      if (!noms.has(nom)) orphelines.push(`${table.titre} → « ${nom} »`);
    }

    for (const ligne of lignes) {
      const t = entrees[ligne.name];
      if (!t) {
        manquantes.push(`${table.titre} → « ${ligne.name} »`);
        continue;
      }

      // Seules les cases VIDES sont remplies : une traduction corrigée dans le
      // back-office ne doit pas être écrasée par un rejeu du script.
      const data: Traduction = {};
      if (rempli(t.nameAr) && (forcer || !rempli(ligne.nameAr)))
        data.nameAr = t.nameAr;
      if (rempli(t.nameEn) && (forcer || !rempli(ligne.nameEn)))
        data.nameEn = t.nameEn;
      if (table.avecDescription) {
        if (
          rempli(t.descriptionAr) &&
          (forcer || !rempli(ligne.descriptionAr))
        ) {
          data.descriptionAr = t.descriptionAr;
        }
        if (
          rempli(t.descriptionEn) &&
          (forcer || !rempli(ligne.descriptionEn))
        ) {
          data.descriptionEn = t.descriptionEn;
        }
      }

      if (Object.keys(data).length === 0) {
        deja++;
        continue;
      }

      if (appliquer) await table.ecrire(ligne.id, data);
      ecrites++;
    }

    console.log(
      `${table.titre} : ${lignes.length} ligne(s) en base, ${Object.keys(entrees).length} traduction(s) au fichier.`,
    );
  }

  console.log('');
  for (const m of manquantes) console.log(`  ⚠ sans traduction : ${m}`);
  for (const o of orphelines) console.log(`  ⚠ sans fiche en base : ${o}`);

  console.log('');
  console.log(
    appliquer
      ? `${ecrites} fiche(s) mise(s) à jour.`
      : `${ecrites} fiche(s) à mettre à jour.`,
  );
  console.log(
    `${deja} fiche(s) déjà traduite(s), laissée(s) telle(s) quelle(s).`,
  );
  if (!appliquer) console.log('Aucune écriture : ajoutez --apply.');

  // Code 1 sur écart, pour que l'intégration continue puisse s'en servir de
  // garde : une prestation ajoutée sans sa traduction doit se voir.
  if (manquantes.length > 0 || orphelines.length > 0) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
