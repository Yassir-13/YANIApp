// ── Pluriels ────────────────────────────────────────────────────────────
//
// Les langues ne comptent pas pareil. Le français distingue deux formes
// (« 1 visite » / « 3 visites »), l'anglais aussi ; l'arabe en distingue SIX
// selon la norme CLDR :
//
//   zero  → 0            one → 1              two → 2
//   few   → 3 à 10       many → 11 à 99       other → le reste
//
// Un fichier de langue où toutes les clés seraient identiques d'une langue à
// l'autre rendrait donc l'arabe impossible à écrire correctement. D'où ce
// type : `other` est la seule forme obligatoire (c'est le repli d'i18next),
// les autres sont fournies par les langues qui en ont besoin. Le français ne
// porte ainsi aucune clé morte.
//
// i18next attend les formes à plat (`clé_one`, `clé_other`) et non imbriquées :
// `flattenPlurals` fait la conversion au démarrage.

export interface PluralForms {
  other: string;
  zero?: string;
  one?: string;
  two?: string;
  few?: string;
  many?: string;
}

function isPluralForms(value: unknown): value is PluralForms {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    typeof (value as PluralForms).other === 'string'
  );
}

// Remplace récursivement chaque `PluralForms` par les clés suffixées
// qu'attend i18next. `{ visites: { one, other } }` devient
// `{ visites_one, visites_other }`.
export function flattenPlurals(input: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(input)) {
    if (isPluralForms(value)) {
      for (const [form, text] of Object.entries(value)) {
        if (typeof text === 'string') out[`${key}_${form}`] = text;
      }
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      out[key] = flattenPlurals(value as Record<string, unknown>);
    } else {
      out[key] = value;
    }
  }

  return out;
}
