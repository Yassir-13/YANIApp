// Recense TOUT texte encore écrit en dur dans le mobile.
// Objectif : ne plus dépendre de ma vigilance. Tant que ce compteur n'est pas
// à zéro, la traduction n'est pas finie.
//
// Usage : node inventaire.js [--liste]
const fs = require('fs');
const path = require('path');

const RACINE = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'src';
const LISTER = process.argv.includes('--liste');

// Valeurs techniques : jamais affichées à la cliente.
const TECHNIQUE = new Set([
  'center', 'row', 'column', 'flex-end', 'flex-start', 'space-between', 'space-around',
  'absolute', 'relative', 'none', 'auto', 'hidden', 'visible', 'contain', 'cover',
  'left', 'right', 'top', 'bottom', 'middle', 'baseline', 'stretch', 'wrap', 'nowrap',
  'small', 'large', 'default', 'cancel', 'destructive', 'button', 'text', 'header',
  'light', 'dark', 'system', 'transparent', 'bold', 'normal', 'italic',
  'padding', 'height', 'position', 'fade', 'slide', 'always', 'never', 'while-editing',
  'done', 'next', 'go', 'send', 'search', 'email-address', 'numeric', 'phone-pad',
  'default-email', 'password', 'new-password', 'one-time-code', 'username', 'tel',
  'given-name', 'family-name', 'name', 'off', 'on', 'yes', 'no', 'true', 'false',
]);

const estTechnique = (s) => {
  if (TECHNIQUE.has(s)) return true;
  if (s.length < 3) return true;
  if (/^[a-z][a-zA-Z0-9]*(\.[a-zA-Z0-9]+)+$/.test(s)) return true; // clés i18n : loyalty.rewardsTitle
  if (/^[A-Za-z][A-Za-z0-9]*_[A-Za-z0-9_]+$/.test(s)) return true; // Inter_400Regular, yani_theme
  if (/^[a-z0-9]+(-[a-z0-9]+)+$/.test(s)) return true;   // chevron-forward, person-outline
  if (/^[a-z][a-zA-Z0-9]*$/.test(s) && !/ /.test(s)) return true; // identifiants camelCase
  if (/^#[0-9a-fA-F]{3,8}$/.test(s)) return true;         // couleurs
  if (/^rgba?\(/.test(s)) return true;
  if (/^\.{0,2}\//.test(s)) return true;                  // chemins d'import
  if (/^[A-Z][a-zA-Z]*$/.test(s) && !/ /.test(s)) return true; // Noms de routes / composants
  if (/^\d+(\.\d+)?(px|%|s|ms)?$/.test(s)) return true;
  if (/^[A-Z_]+$/.test(s)) return true;                   // CONSTANTES, types serveur
  return false;
};

// Retire commentaires et imports avant analyse : leurs textes ne sont pas affichés.
function nettoie(code) {
  return code
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((l) => !/^\s*(import|export)\s.*from\s/.test(l))
    .map((l) => l.replace(/(^|[^:])\/\/.*$/, '$1'))
    .join('\n');
}

const fichiers = [];
(function parcours(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) { if (e.name !== 'i18n') parcours(p); }
    else if (/\.tsx?$/.test(e.name) && !/\.d\.ts$/.test(e.name)) fichiers.push(p);
  }
})(RACINE);
if (fs.existsSync('App.tsx')) fichiers.push('App.tsx');

const resultats = new Map();
let total = 0;

for (const f of fichiers) {
  const code = nettoie(fs.readFileSync(f, 'utf8'));
  const trouves = [];

  // 1. Littéraux entre quotes
  for (const m of code.matchAll(/'([^'\\\n]{3,})'|"([^"\\\n]{3,})"/g)) {
    const s = m[1] ?? m[2];
    if (!estTechnique(s)) trouves.push(s);
  }
  // 2. Gabarits contenant des lettres accentuées ou plusieurs mots
  for (const m of code.matchAll(/`([^`]{3,})`/g)) {
    const s = m[1];
    if (/[A-Za-zÀ-ÿ]{2,}\s+[A-Za-zÀ-ÿ]/.test(s) && !estTechnique(s)) trouves.push(s);
  }
  // 3. Texte nu entre balises JSX. Le saut de ligne est AUTORISÉ dans la
  //    classe de caractères : sans cela, un libellé écrit sur sa propre ligne
  //    (<Text> puis retour à la ligne puis le texte) passait entre les mailles.
  //    Cinq textes affichés avaient échappé au compteur pour cette raison.
  for (const m of code.matchAll(/>\s*([A-ZÀ-Ý][^<>{}]{2,120}?)\s*</g)) {
    const s = m[1].trim();
    if (!estTechnique(s)) trouves.push(s);
  }

  if (trouves.length) {
    resultats.set(f, [...new Set(trouves)]);
    total += new Set(trouves).size;
  }
}

const tries = [...resultats.entries()].sort((a, b) => b[1].length - a[1].length);
for (const [f, ss] of tries) {
  console.log(`${String(ss.length).padStart(3)}  ${f.replace(/\\/g, '/')}`);
  if (LISTER) for (const s of ss) console.log(`       · ${s}`);
}
console.log(`\n${total} textes en dur dans ${resultats.size} fichiers.`);
