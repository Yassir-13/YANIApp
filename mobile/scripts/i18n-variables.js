// Vérifie que chaque clé de traduction porte LES MÊMES variables
// d'interpolation dans les trois langues.
//
// ── Pourquoi ce script existe ────────────────────────────────────────────
//
// C'est le seul défaut de traduction que le typage ne peut PAS attraper. Le
// français est la langue de référence et `ar.ts` / `en.ts` sont typés d'après
// lui : une clé oubliée ou en trop ne compile pas. Mais le CONTENU des chaînes
// n'est pas typé. Un « {{count}} » devenu « {{nombre}} » en arabe compile
// parfaitement — et s'affiche tel quel à la cliente, accolades comprises,
// parce qu'i18next ne trouve pas de valeur à y mettre.
//
// Ce contrôle avait été écrit en jetable, hors du dépôt, pour valider une
// correction de traduction. Il n'y avait aucune raison qu'il en reste dehors.
//
// ── Comment ──────────────────────────────────────────────────────────────
//
// Les trois fichiers de langue sont de vrais modules TypeScript. Plutôt que de
// les analyser au texte — fragile, plusieurs valeurs tiennent sur deux lignes —
// on les transpile et on les charge réellement. Leurs seuls imports sont des
// `import type`, effacés à la transpilation : rien n'est résolu à l'exécution.
//
// Usage : node scripts/i18n-variables.js

const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const DOSSIER = path.join('src', 'i18n', 'locales');
const REFERENCE = 'fr';
const COMPAREES = ['ar', 'en'];

function charger(langue) {
  const source = fs.readFileSync(path.join(DOSSIER, `${langue}.ts`), 'utf8');
  const js = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  }).outputText;

  const faux = { exports: {} };
  // Le `require` factice n'est jamais appelé : voir l'en-tête.
  new Function('exports', 'require', 'module', js)(faux.exports, () => ({}), faux);
  return faux.exports[langue];
}

// { auth: { codeSentTo: '…' } } → { 'auth.codeSentTo': '…' }
// Traverse aussi les entrées à formes multiples, qui sont de simples objets.
function aplatir(objet, prefixe = '', sortie = {}) {
  for (const [cle, valeur] of Object.entries(objet)) {
    const chemin = prefixe ? `${prefixe}.${cle}` : cle;
    if (typeof valeur === 'string') sortie[chemin] = valeur;
    else if (valeur && typeof valeur === 'object') aplatir(valeur, chemin, sortie);
  }
  return sortie;
}

const variables = (texte) =>
  [...String(texte).matchAll(/\{\{\s*([^}\s,]+)/g)].map((m) => m[1]).sort();

// Formes CLDR, telles que `plural.ts` les définit.
const FORMES_PLURIEL = new Set(['zero', 'one', 'two', 'few', 'many', 'other']);
const estFormePluriel = (cle) => FORMES_PLURIEL.has(cle.split('.').pop());

// Variables autorisées pour une forme de pluriel que le français NE CONNAÎT
// PAS : l'union de celles que portent ses propres formes pour la même clé.
//
// ⚠️ Sans cette fonction, ces formes n'étaient jamais contrôlées. L'arabe a six
// formes CLDR, le français deux : `few`, `many` et `two` n'existent pas dans la
// référence, donc une boucle sur les clés françaises ne les visite jamais. Un
// « {{count}} » mal recopié dans la forme `few` arabe passait sans un mot —
// vérifié en renommant une variable exprès, le script ne bronchait pas.
function autoriseesPourFrere(cle) {
  const parent = cle.slice(0, cle.lastIndexOf('.') + 1);
  const autorisees = new Set();
  for (const [k, v] of Object.entries(reference)) {
    if (k.startsWith(parent) && FORMES_PLURIEL.has(k.slice(parent.length))) {
      for (const nom of variables(v)) autorisees.add(nom);
    }
  }
  return autorisees;
}

const reference = aplatir(charger(REFERENCE));
const ecarts = [];

for (const langue of COMPAREES) {
  const traduction = aplatir(charger(langue));

  // Sur les clés de la TRADUCTION, et non sur celles du français : c'est le
  // seul balayage qui atteigne les formes de pluriel propres à la langue.
  for (const [cle, texte] of Object.entries(traduction)) {
    const trouvees = variables(texte);

    if (!(cle in reference)) {
      const autorisees = autoriseesPourFrere(cle);
      const inconnues = trouvees.filter((v) => !autorisees.has(v));
      if (inconnues.length) {
        ecarts.push({ langue, cle, attendues: [...autorisees].sort(), trouvees });
      }
      continue;
    }

    const attendues = variables(reference[cle]);

    if (estFormePluriel(cle)) {
      // Dans une forme de pluriel, une langue peut légitimement NE PAS
      // répéter le nombre : l'arabe dit « منتج واحد » (un produit) et
      // « منتجان » (deux produits) sans jamais écrire le chiffre. Exiger
      // « {{count}} » partout obligerait à écrire de l'arabe fautif pour
      // satisfaire un script.
      //
      // On tolère donc l'absence — mais pas une variable que le français ne
      // connaît pas : un nom mal recopié reste un bug, et il s'afficherait
      // en clair à la cliente.
      const inconnues = trouvees.filter((v) => !attendues.includes(v));
      if (inconnues.length) {
        ecarts.push({ langue, cle, attendues, trouvees });
      }
    } else if (attendues.join('|') !== trouvees.join('|')) {
      ecarts.push({ langue, cle, attendues, trouvees });
    }
  }
}

const total = Object.keys(reference).length;

if (ecarts.length === 0) {
  console.log(
    `${total} clés vérifiées — les variables d'interpolation concordent dans les 3 langues.`,
  );
  process.exit(0);
}

console.log(`${ecarts.length} écart(s) sur ${total} clés :\n`);
for (const e of ecarts) {
  console.log(`  ${e.cle}  [${e.langue}]`);
  console.log(`      ${REFERENCE} attend : ${e.attendues.join(', ') || '(aucune)'}`);
  console.log(`      ${e.langue} porte   : ${e.trouvees.join(', ') || '(aucune)'}`);
}
// Code 1 : utilisable en intégration continue, comme les deux autres scripts.
process.exit(1);
