// Palette extraite des maquettes Yani Concept

// Teintes dorées communes aux deux modes
const gold = {
  primary: '#C9A24B',    // or principal (boutons, accents)
  light: '#E4C877',      // or clair (dégradés, survols)
  deep: '#A47E2E',       // or profond (ombres, textes sur clair)
};

export const lightTheme = {
  mode: 'light' as const,
  // Fonds
  background: '#F5EFE1',      // crème principal
  surface: '#FBF7ED',        // cartes, surfaces surélevées
  surfaceAlt: '#EDE4D0',     // surfaces secondaires
  // Textes
  text: '#2E2A22',           // texte principal (brun foncé)
  textSecondary: '#6B6252',  // texte secondaire
  textMuted: '#9C927E',      // texte discret
  // Or
  gold: gold.primary,
  goldLight: gold.light,
  goldDeep: gold.deep,
  // Bandeau fidélité (sombre même en mode clair, comme sur la maquette)
  loyaltyBg: '#1E1B16',
  loyaltyText: '#F5EFE1',
  // Utilitaires
  border: '#DED3BC',
  success: '#5B8C5A',
  danger: '#B4544A',
  // Tab bar
  tabBar: '#FBF7ED',
  tabActive: gold.primary,
  tabInactive: '#B0A688',
};

export const darkTheme = {
  mode: 'dark' as const,
  // Fonds
  background: '#0F0D0A',      // noir profond
  surface: '#1A1712',        // cartes
  surfaceAlt: '#231E17',     // surfaces secondaires
  // Textes
  text: '#F5EFE1',           // texte principal (crème)
  textSecondary: '#B8AE9B',  // texte secondaire
  textMuted: '#7A7161',      // texte discret
  // Or
  gold: gold.primary,
  goldLight: gold.light,
  goldDeep: gold.deep,
  // Bandeau fidélité
  loyaltyBg: '#000000',
  loyaltyText: '#F5EFE1',
  // Utilitaires
  border: '#2E2820',
  success: '#6BA368',
  danger: '#C86A60',
  // Tab bar
  tabBar: '#1A1712',
  tabActive: gold.primary,
  tabInactive: '#6B6252',
};

export type ThemeMode = 'light' | 'dark';
export type Theme = Omit<typeof lightTheme, 'mode'> & { mode: ThemeMode };