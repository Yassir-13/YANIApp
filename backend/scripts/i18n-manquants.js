// Recense les messages que l'API peut renvoyer à une cliente SANS avoir de
// traduction dans `src/i18n/messages.ts`.
//
// Il existe parce que le dictionnaire est indexé par la phrase française
// elle-même : reformuler un message sans toucher au dictionnaire lui ferait
// perdre sa traduction, en silence. Ce script transforme ce silence en une
// ligne à l'écran.
//
// Il relève DEUX formes :
//
//  1. les chaînes littérales — traduites par une entrée de `MESSAGES` ;
//  2. les gabarits `` `… ${variable} …` `` — traduits par un MOTIF de `PATTERNS`.
//
// La seconde a été ajoutée après un oubli : « Le mot de passe doit faire au
// moins 8 caractères. » est écrit en gabarit, pas en chaîne. Le script ne le
// voyait donc pas, et le message restait en français au milieu d'une réponse
// arabe — jusqu'à ce qu'un appel réel à l'API le révèle.
//
// Usage : node scripts/i18n-manquants.js
// Sortie : code 1 s'il manque quelque chose — utilisable en intégration continue.
const fs = require('fs');
const path = require('path');

const RACINE = path.join(__dirname, '..', 'src');
const BASE = path.join(__dirname, '..');

const dico = fs.readFileSync(path.join(RACINE, 'i18n', 'messages.ts'), 'utf8');

// Les clés littérales du dictionnaire.
const CONNUS = new Set(
  [...dico.matchAll(/^ {2}'((?:[^'\\]|\\.)+)':/gm)].map((m) => m[1]),
);

// Le début littéral de chaque MOTIF, c'est-à-dire le texte qui précède son
// premier groupe de capture. C'est lui qui permet de dire si un gabarit du
// code est couvert.
const PREFIXES = [...dico.matchAll(/re:\s*\/\^?((?:[^/\\(]|\\.)+)/g)]
  .map((m) => m[1].replace(/\\/g, '').trim())
  .filter(Boolean);

const couvertParMotif = (texte) =>
  PREFIXES.some((p) => texte.startsWith(p) || p.startsWith(texte));

const fichiers = [];
(function parcours(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name !== 'i18n') parcours(p);
    } else if (
      /\.ts$/.test(e.name) &&
      !/\.spec\.ts$/.test(e.name) &&
      // Contrôles des variables d'environnement : ils s'affichent dans la
      // console au démarrage du serveur et ne partent jamais vers un client.
      e.name !== 'env.validation.ts'
    ) {
      fichiers.push(p);
    }
  }
})(RACINE);

const manquants = new Map();
const noter = (texte, ou) => {
  if (!manquants.has(texte)) manquants.set(texte, []);
  manquants.get(texte).push(ou);
};

for (const f of fichiers) {
  const code = fs.readFileSync(f, 'utf8');
  const rel = path.relative(BASE, f).replace(/\\/g, '/');

  // ── 1. Chaînes littérales ──────────────────────────────────────────────
  const litteral = (regex, quoi) => {
    for (const m of code.matchAll(regex)) {
      const texte = m[1];
      if (CONNUS.has(texte) || couvertParMotif(texte)) continue;
      noter(texte, `${rel} (${quoi})`);
    }
  };
  litteral(/throw new [A-Za-z]+Exception\(\s*'((?:[^'\\]|\\.)+)'/g, 'exception');
  litteral(/message:\s*'((?:[^'\\]|\\.)+)'/g, 'validation');

  // ── 2. Gabarits construits à l'exécution ───────────────────────────────
  // Seul leur début littéral compte : c'est ce qu'un MOTIF doit reconnaître.
  const gabarit = (regex, quoi) => {
    for (const m of code.matchAll(regex)) {
      const debut = m[1].split('${')[0].trim();
      if (!debut || debut.length < 3) continue;
      if (couvertParMotif(debut)) continue;
      noter(m[1], `${rel} (${quoi} — il faut un MOTIF)`);
    }
  };
  gabarit(/throw new [A-Za-z]+Exception\(\s*`([^`]+)`/g, 'exception');
  gabarit(/message:\s*`([^`]+)`/g, 'validation');
  gabarit(/\bmessage:\s*`([^`]+)`/g, 'réponse');
}

if (manquants.size === 0) {
  console.log(
    `${CONNUS.size} messages traduits et ${PREFIXES.length} motif(s) — aucun manquant.`,
  );
  process.exit(0);
}

console.log(`${manquants.size} message(s) SANS traduction :\n`);
for (const [texte, lieux] of manquants) {
  console.log(`  « ${texte} »`);
  for (const l of [...new Set(lieux)]) console.log(`      ${l}`);
}
console.log('\nAjoutez-les dans src/i18n/messages.ts (MESSAGES ou PATTERNS).');
process.exit(1);
