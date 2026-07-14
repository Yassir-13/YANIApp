// Typographie Yani Concept
// ─────────────────────────────────────────────────────────────────────────
// Trois familles, fidèles au logo et aux maquettes :
//   • Serif display (Cormorant Garamond) → titres d'écran, noms de produits,
//     chiffres de prix, gros solde fidélité. C'est la voix « institut de beauté ».
//   • Script (Great Vibes)               → uniquement la signature « by Fati ».
//   • Sans-serif (Inter)                 → tout le reste : UI, libellés, corps,
//     boutons, méta. Lisible et neutre.
//
// Les familles sont chargées dans src/theme/fonts.ts (useYaniFonts).
// Tant que les polices ne sont pas prêtes, on retombe sur la police système
// via les fallbacks définis ici (aucun texte invisible).

export const fonts = {
  // clés = valeurs fontFamily renvoyées par @expo-google-fonts
  serif: 'CormorantGaramond_500Medium',
  serifSemiBold: 'CormorantGaramond_600SemiBold',
  serifBold: 'CormorantGaramond_700Bold',
  script: 'GreatVibes_400Regular',
  sans: 'Inter_400Regular',
  sansMedium: 'Inter_500Medium',
  sansSemiBold: 'Inter_600SemiBold',
  sansBold: 'Inter_700Bold',
} as const;

export const typography = {
  // ── Serif : titres & display ──────────────────────────────────────────
  // Gros titre d'écran (« Produits », « Fidélité », « Récapitulatif »)
  display: {
    fontFamily: fonts.serifSemiBold,
    fontSize: 32,
    letterSpacing: 0.2,
    lineHeight: 38,
  },
  // Titre serif (nom de produit/service en fiche détail)
  heading: {
    fontFamily: fonts.serifSemiBold,
    fontSize: 28,
    letterSpacing: 0.3,
    lineHeight: 34,
  },
  // Sous-titre serif (accueil « Bienvenue chez Yani »)
  headingSm: {
    fontFamily: fonts.serifSemiBold,
    fontSize: 22,
    lineHeight: 28,
  },
  // Signature script « by Fati »
  script: {
    fontFamily: fonts.script,
    fontSize: 30,
    lineHeight: 36,
  },

  // ── Sans-serif : UI & corps ───────────────────────────────────────────
  // Titre de section sans-serif (« COMPTE », « HUILES & SÉRUMS »)
  sectionLabel: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: 'uppercase' as const,
  },
  title: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 18,
    lineHeight: 24,
  },
  subtitle: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 16,
    lineHeight: 22,
  },
  body: {
    fontFamily: fonts.sans,
    fontSize: 15,
    lineHeight: 22,
  },
  bodyMedium: {
    fontFamily: fonts.sansMedium,
    fontSize: 15,
    lineHeight: 22,
  },
  button: {
    fontFamily: fonts.sansSemiBold,
    fontSize: 16,
    letterSpacing: 0.2,
  },
  caption: {
    fontFamily: fonts.sans,
    fontSize: 13,
    lineHeight: 18,
  },
  small: {
    fontFamily: fonts.sans,
    fontSize: 11,
    lineHeight: 15,
  },

  // ── Prix (serif, comme sur les maquettes) ─────────────────────────────
  price: {
    fontFamily: fonts.serifSemiBold,
    fontSize: 22,
    letterSpacing: 0.2,
  },
  priceLg: {
    fontFamily: fonts.serifBold,
    fontSize: 30,
    letterSpacing: 0.2,
  },
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 20,
  xl: 28,
  full: 999,
};

// Échelle d'ombres dorées / neutres cohérente (guide UI : elevation-consistent)
export const shadow = {
  // Ombre dorée sous les CTA (halo chaud des boutons de la maquette)
  gold: {
    shadowColor: '#D8A848',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
  // Ombre douce des cartes
  card: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 3,
  },
};