// Recense le texte encore écrit en dur dans le mobile.
// Objectif : ne plus dépendre de ma vigilance. Tant que ce compteur n'est pas
// à zéro, la traduction n'est pas finie — et le critère est atteignable, voir
// ACCEPTES plus bas. Sort en code 1 s'il reste quelque chose.
//
// Usage : node scripts/i18n-restants.js [--liste]
//
// ── CE QU'IL NE VOIT PAS, ET POURQUOI C'EST ÉCRIT ICI ────────────────────
//
// Un texte qui COMMENCE par une interpolation — « {n} autre(s) » — lui échappe
// encore. La règle 3 exige une majuscule en tête, et c'est cette exigence qui
// la rend utilisable : la version qui l'abandonnait ramassait les génériques
// TypeScript (`Promise<T>`) et les corps de fonction, soit 234 résultats dont
// presque tous étaient du code. Essayé, mesuré, écarté.
//
// La leçon du projet vaut aussi pour ses outils : un outil de couverture ne
// vaut que par ce qu'il sait regarder. Celui-ci sait maintenant regarder le
// texte à variable — ce qui lui manquait — et il dit ce qu'il ne voit pas.
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

// Textes FRANÇAIS qu'aucune cliente ne verra jamais, acceptés un par un.
//
// Cette liste existe pour que le compteur puisse atteindre zéro. Sans elle, il
// resterait bloqué sur une poignée de chaînes légitimes, et un critère qu'on ne
// peut pas satisfaire cesse d'être un critère : on arrête de le regarder, et
// c'est exactement ce qui est arrivé.
//
// ⚠️ N'ajouter ici QUE ce qui ne peut pas atteindre l'écran d'une cliente, et
// toujours avec sa raison. Une phrase affichée n'a rien à y faire : elle se
// traduit.
const ACCEPTES = new Map([
  ['Yani Concept', "nom de l'institut — une marque ne se traduit pas"],
  ['Pas de refresh token', 'throw destiné au développeur, jamais affiché'],
  ['session inconnue', 'throw destiné au développeur, jamais affiché'],
  ['useAlert doit être utilisé dans un <AlertProvider>.', 'erreur de programmation'],
  ['useTheme doit être utilisé dans un ThemeProvider.', 'erreur de programmation'],
  [
    '[config] EXPO_PUBLIC_API_URL doit être en HTTPS pour un build de production (reçu : « ${url} »).',
    'garde-fou de build, lu dans un terminal',
  ],
]);

const estTechnique = (s) => {
  if (TECHNIQUE.has(s) || ACCEPTES.has(s)) return true;
  if (s.length < 3) return true;
  if (/^[a-z][a-zA-Z0-9]*(\.[a-zA-Z0-9]+)+$/.test(s)) return true; // clés i18n : loyalty.rewardsTitle
  if (/^[A-Za-z][A-Za-z0-9]*_[A-Za-z0-9_]+$/.test(s)) return true; // Inter_400Regular, yani_theme
  if (/^__[a-z]+__$/.test(s)) return true;                // sentinelles : __all__
  if (/^[a-z0-9]+(-[a-z0-9]+)+$/.test(s)) return true;   // chevron-forward, person-outline
  if (/^[a-z][a-zA-Z0-9]*$/.test(s) && !/ /.test(s)) return true; // identifiants camelCase
  if (/^#[0-9a-fA-F]{3,8}$/.test(s)) return true;         // couleurs
  if (/^rgba?\(/.test(s)) return true;
  if (/^\.{0,2}\//.test(s)) return true;                  // chemins d'import
  // Noms de routes et de composants, ACCENTS COMPRIS : « Fidélité » est le nom
  // d'un écran, dont le libellé visible passe par t('nav.loyalty'). Sans les
  // accents dans la classe, ce nom était signalé comme un texte à traduire.
  if (/^[A-ZÀ-Ý][a-zA-ZÀ-ÿ]*$/.test(s) && !/ /.test(s)) return true;
  if (/^\d+(\.\d+)?(px|%|s|ms|deg|rad)?$/.test(s)) return true;
  if (/^[A-Z_]+$/.test(s)) return true;                   // CONSTANTES, types serveur

  // ── Adresses et protocole ──
  if (/^https?:\/\//.test(s) || s === 'https://') return true;

  // ── En-têtes HTTP et types MIME ──
  if (/^[A-Z][a-z]+(-[A-Z][a-z]+)+$/.test(s)) return true;   // Content-Type, Accept-Language
  if (/^[a-z]+\/[a-z0-9.+-]+$/.test(s)) return true;         // application/json

  // ── Données SVG (le logo est vectoriel, tout son dessin vit dans le code) ──
  if (/^[Mm][\d.\s-]/.test(s) && /[CcLlZzHhVv]/.test(s)) return true; // tracé « M12 0 C… Z »
  if (/^[\d.\s-]+$/.test(s)) return true;                    // viewBox « 0 0 24 33 »
  if (/^url\(#/.test(s)) return true;                        // url(#dropGold)
  if (/^\s*[a-z]\d?=\s*$/.test(s)) return true;              // x2=, y1= (espace en tête comprise)

  // ── Masques de saisie et gabarits ──
  if (/^[•·*]+$/.test(s)) return true;                       // ••••••••
  if (/^\+\d+$/.test(s)) return true;                        // +212
  if (/^\$\d/.test(s)) return true;                          // $1 — remplacement d'expression

  // Rien qui ressemble à un mot : de la ponctuation seule n'est pas un texte.
  if (!/[A-Za-zÀ-ÿ]/.test(s)) return true;

  // ── Fragments ramassés à cheval sur deux chaînes d'un même gabarit ──
  // Le détecteur de littéraux apparie les apostrophes de proche en proche : sur
  // `cond ? t('a') : t('b')`, il « voit » la chaîne « ) : t( ». Ce n'est pas une
  // phrase, c'est du code entre deux apostrophes. La ponctuation le trahit.
  //
  // ⚠️ Ne PAS ajouter « se termine par : » à cette liste. Une phrase française
  // finit très bien par un deux-points — « Stock maximum : {qty} » en est une,
  // et c'est précisément l'un des textes que ce script devait attraper. Essai
  // fait : la règle trop large le rendait de nouveau invisible.
  if (/\$\{|\|\||\?\?|=>|^\s*[).]|\($/.test(s)) return true;

  return false;
};

// Retire commentaires et imports avant analyse : leurs textes ne sont pas affichés.
function nettoie(code) {
  return (
    code
      // ⚠️ NORMALISER LES FINS DE LIGNE D'ABORD. Ce dépôt est en CRLF, et en
      // expression régulière JavaScript le `.` ne franchit pas un `\r` : sans
      // cette ligne, le motif de commentaire ci-dessous cherche `$` juste après
      // le texte, tombe sur le `\r` qui reste, et ne correspond à RIEN.
      //
      // Conséquence mesurée : AUCUN commentaire n'était retiré, et leur texte
      // était ensuite ramassé par le détecteur de littéraux — l'apostrophe de
      // « l'API » ouvrant une fausse chaîne. 79 des 86 « textes en dur »
      // signalés étaient des morceaux de commentaires. Le compteur ne pouvait
      // donc pas atteindre zéro, alors que c'est son critère annoncé.
      .replace(/\r\n?/g, '\n')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .split('\n')
      .filter((l) => !/^\s*(import|export)\s.*from\s/.test(l))
      .map((l) => l.replace(/(^|[^:])\/\/.*$/, '$1'))
      .join('\n')
  );
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
  // 3. Texte affiché entre balises JSX, EXPRESSIONS COMPRISES.
  //
  //    Le saut de ligne est autorisé : sans cela, un libellé écrit sur sa
  //    propre ligne (<Text> puis retour à la ligne puis le texte) passait
  //    entre les mailles. Cinq textes avaient échappé pour cette raison.
  //
  //    ⚠️ Et les ACCOLADES aussi, désormais. L'ancienne classe `[^<>{}]` les
  //    excluait : « Mode de récupération » était vu, « Stock maximum : {qty} »
  //    ne l'était pas. Or un texte à variable est précisément celui qu'on
  //    n'extrait pas machinalement — les sept phrases françaises trouvées en
  //    août en contenaient TOUTES une, et le compteur affichait le même
  //    nombre avant et après leur correction.
  //
  //    La majuscule initiale reste exigée, et ce n'est pas de la paresse :
  //    sans elle, le motif ramasse tout le code qui sépare une flèche `=>`
  //    d'une balise JSX — mesuré à 234 résultats dont l'immense majorité
  //    étaient des fragments de TypeScript.
  //
  //    La méthode : on prend ce qui sépare deux balises, on retire les
  //    expressions `{…}` (du code, pas du texte), et on juge ce qui reste.
  for (const m of code.matchAll(/>\s*([A-ZÀ-Ý][^<>]{2,160}?)\s*</g)) {
    const brut = m[1].replace(/\s+/g, ' ').trim();
    // Une imbrication est tolérée : `{t('x', { count: n })}` est une seule
    // expression, pas du texte suivi d'un objet.
    const reste = brut
      .replace(/\{(?:[^{}]|\{[^{}]*\})*\}/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    // Rien hors des expressions : la balise ne contenait que du code.
    if (!reste || estTechnique(reste)) continue;
    // Au moins un mot de quatre lettres. « + », « px » ou « OK » ne sont pas
    // des phrases ; « autre(s) » et « Utilisée le » en sont.
    if (!/[A-Za-zÀ-ÿ]{4,}/.test(reste)) continue;
    trouves.push(brut);
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

// Code 1 quand il reste quelque chose : c'est ce qui rend ce script utilisable
// en intégration continue, comme son jumeau `backend/scripts/i18n-manquants.js`.
// Sans lui, un workflow l'appellerait et passerait au vert quoi qu'il trouve.
//
// Le critère est atteignable — voir ACCEPTES en tête de fichier. S'il ne l'est
// pas, ce n'est plus un garde-fou mais un chiffre qu'on regarde de moins en
// moins, et c'est exactement ce qui s'est produit ici.
if (total > 0) process.exit(1);
