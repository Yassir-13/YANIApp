import { I18nManager } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import { flattenPlurals, type PluralForms } from './plural';
import { fr, type Translations } from './locales/fr';
import { ar } from './locales/ar';
import { en } from './locales/en';

export const LANGUAGES = ['fr', 'ar', 'en'] as const;
export type Language = (typeof LANGUAGES)[number];

// Chaque langue s'affiche dans sa propre écriture : une cliente qui ne lit pas
// le français ne trouverait pas « Arabe » dans une liste écrite en français.
export const LANGUAGE_NAMES: Record<Language, string> = {
  fr: 'Français',
  ar: 'العربية',
  en: 'English',
};

// Étiquettes régionales pour `Intl` — utilisées par les prix et les dates.
//
// `ar-MA` et non `ar` : la locale arabe générique affiche les chiffres
// indo-arabes (٠١٢٣), alors que le Maroc écrit ses nombres en chiffres
// latins. Un prix affiché « ٣٢٠ درهم » serait illisible pour la cliente.
const INTL_LOCALES: Record<Language, string> = {
  fr: 'fr-FR',
  ar: 'ar-MA',
  en: 'en-GB',
};

const RTL_LANGUAGES: readonly Language[] = ['ar'];

const STORAGE_KEY = 'yani_language';

function isSupported(value: unknown): value is Language {
  return typeof value === 'string' && (LANGUAGES as readonly string[]).includes(value);
}

export function isRTLLanguage(lang: Language): boolean {
  return RTL_LANGUAGES.includes(lang);
}

export function currentLanguage(): Language {
  return isSupported(i18n.language) ? i18n.language : 'fr';
}

// Étiquette à passer à `toLocaleDateString` / `toLocaleString`.
export function intlLocale(): string {
  return INTL_LOCALES[currentLanguage()];
}

// Langue de l'appareil, si nous la parlons. Sinon français : c'est la langue
// de l'institut, pas un repli technique.
function deviceLanguage(): Language {
  const code = getLocales()[0]?.languageCode;
  return isSupported(code) ? code : 'fr';
}

// i18next attend les pluriels à plat (`clé_one`, `clé_other`). Nos fichiers de
// langue les portent imbriqués pour rester typables — d'où la conversion.
const resources = {
  fr: { translation: flattenPlurals(fr) },
  ar: { translation: flattenPlurals(ar) },
  en: { translation: flattenPlurals(en) },
};

// Fixe le sens de lecture pour le PROCHAIN démarrage — React Native ne
// retourne jamais la mise en page à chaud.
//
// Les DEUX réglages, et pas seulement `forceRTL` : côté natif, la direction
// vaut `forcée ? RTL : (autorisée && langue de l'appareil)`. Sur un téléphone
// configuré en arabe, `forceRTL(false)` seul rendait donc la main à l'appareil
// — et l'application restait en arabe de droite à gauche pour toujours, même
// repassée en français.
function applyDirection(rtl: boolean): void {
  I18nManager.allowRTL(rtl);
  I18nManager.forceRTL(rtl);
}

export async function initI18n(): Promise<void> {
  const saved = await AsyncStorage.getItem(STORAGE_KEY).catch(() => null);
  const lang = isSupported(saved) ? saved : deviceLanguage();

  await i18n.use(initReactI18next).init({
    resources,
    lng: lang,
    fallbackLng: 'fr',
    // React échappe déjà ce qu'il affiche ; le refaire ici transformerait
    // les apostrophes des noms de prestations en `&#39;`.
    interpolation: { escapeValue: false },
  });

  // APRÈS l'initialisation, jamais avant : ces deux appels touchent le natif,
  // et un incident de leur côté ne doit pas priver l'application de ses
  // traductions. Sans condition — cela rattrape aussi, silencieusement, une
  // première ouverture sur un téléphone configuré en arabe.
  applyDirection(isRTLLanguage(lang));
}

// Change la langue et retourne s'il faut redémarrer. Le module ne montre
// aucun dialogue lui-même : c'est l'écran qui appelle qui décide comment le
// dire, avec l'`AlertProvider` de l'application.
export async function setLanguage(lang: Language): Promise<{ needsRestart: boolean }> {
  const rtl = isRTLLanguage(lang);

  await AsyncStorage.setItem(STORAGE_KEY, lang).catch(() => {});
  await i18n.changeLanguage(lang);

  // TOUJOURS réappliquer, jamais « seulement si la direction change ».
  // `I18nManager.isRTL` décrit la mise en page actuellement à l'écran, figée
  // au démarrage — pas la direction déjà demandée pour le prochain. Passer de
  // l'arabe au français puis revenir à l'arabe sans redémarrer entre les deux
  // faisait sauter ce second appel : on redémarrait alors de gauche à droite
  // avec du texte arabe.
  applyDirection(rtl);

  // Ici, en revanche, `isRTL` est la bonne référence : c'est bien l'écart
  // avec ce qui est AFFICHÉ qui impose un redémarrage.
  return { needsRestart: I18nManager.isRTL !== rtl };
}

// Retourne l'icône miroir quand la lecture va de droite à gauche.
//
// React Native retourne les rangées et les marges tout seul, mais PAS le
// dessin des icônes : en arabe, la flèche « retour » d'un en-tête continuait
// de pointer vers la gauche alors que le retour est à droite. Les icônes non
// directionnelles (panier, coeur, cadenas…) passent inchangées.
const ICONES_MIROIR: Record<string, string> = {
  'chevron-back': 'chevron-forward',
  'chevron-forward': 'chevron-back',
  'arrow-back': 'arrow-forward',
  'arrow-forward': 'arrow-back',
};

export function mirroredIcon<T extends string>(name: T): T {
  return (I18nManager.isRTL ? (ICONES_MIROIR[name] ?? name) : name) as T;
}

export default i18n;

// ── Typage des clés ─────────────────────────────────────────────────────
//
// Rend `t('loyalty.rewardsTitle')` vérifié à la compilation : une clé mal
// orthographiée devient une erreur, pas un libellé vide à l'écran.
//
// `FlattenPlurals` reproduit au niveau des TYPES ce que `flattenPlurals` fait
// aux valeurs : chaque entrée à formes multiples devient les six clés
// suffixées qu'i18next sait résoudre.

type PluralCategory = 'zero' | 'one' | 'two' | 'few' | 'many' | 'other';

type FlattenPlurals<T> = {
  [K in keyof T as T[K] extends PluralForms
    ? `${K & string}_${PluralCategory}`
    : K]: T[K] extends PluralForms
    ? string
    : T[K] extends object
      ? FlattenPlurals<T[K]>
      : T[K];
};

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation';
    resources: { translation: FlattenPlurals<Translations> };
  }
}
