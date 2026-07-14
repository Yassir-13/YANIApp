// Palette Yani Concept — extraite au pixel des maquettes finales
// (Mode sombre : noir profond & or lumineux · Mode clair : crème & or)
//
// Rétro-compatible : toutes les clés déjà utilisées dans le code sont conservées.
// Les nouvelles clés (goldGradient, loyaltyGlow, badge*, overlay, chip*) servent
// à la passe de design (dégradés dorés, halo fidélité, badges, chips de filtres).

// ── Teintes dorées communes aux deux modes (dégradé du logo) ──────────────
const gold = {
  primary: '#D8A848', // or principal — boutons pleins, accents, prix
  light: '#E4C15E',   // or clair — haut du dégradé, halos
  deep: '#886028',    // or profond — bas du dégradé, ombres dorées
};

// Dégradé doré des CTA (« Ajouter au panier », « Réserver », « Valider »)
// À utiliser avec expo-linear-gradient : colors={theme.goldGradient}
const goldGradient = ['#E4C15E', '#D8A848', '#C69433'] as const;

export const lightTheme = {
  mode: 'light' as const,

  // Fonds
  background: '#F9F6F0',   // crème principal (fond app)
  surface: '#F2ECE0',      // cartes, surfaces surélevées
  surfaceAlt: '#EBE3D4',   // surfaces secondaires (chips inactives, champs)

  // Textes
  text: '#1A1712',         // texte principal (presque noir chaud)
  textSecondary: '#6B6252',// texte secondaire
  textMuted: '#9C927E',    // texte discret (méta, légendes)

  // Or
  gold: gold.primary,
  goldLight: gold.light,
  goldDeep: gold.deep,
  goldGradient,
  goldSoft: 'rgba(216, 168, 72, 0.14)', // fond doré translucide (chip actif clair)

  // Bandeau fidélité (reste sombre même en mode clair, fidèle à la maquette)
  loyaltyBg: '#14100C',
  loyaltyText: '#F5EFE1',
  loyaltyGlow: 'rgba(228, 193, 94, 0.35)', // halo doré radial derrière la goutte

  // Badges (statuts produit)
  badgeInStockBg: 'rgba(91, 140, 90, 0.16)',
  badgeInStock: '#4E7C4D',
  badgeSoonBg: 'rgba(216, 168, 72, 0.16)',
  badgeSoon: '#B07E1E',
  badgeNewBg: 'rgba(216, 168, 72, 0.16)',
  badgeNew: '#B07E1E',

  // Chips de filtres
  chipActiveBg: gold.primary,
  chipActiveText: '#1A1712',
  chipInactiveBg: 'transparent',
  chipInactiveText: '#6B6252',
  chipBorder: '#DED3BC',

  // Overlay / scrim (modales, sheets)
  overlay: 'rgba(20, 16, 12, 0.55)',

  // Utilitaires
  border: '#DED3BC',
  success: '#5B8C5A',
  danger: '#B4544A',
  star: gold.primary,

  // Tab bar
  tabBar: '#FBF8F1',
  tabActive: gold.primary,
  tabInactive: '#B0A688',
};

export const darkTheme = {
  mode: 'dark' as const,

  // Fonds
  background: '#080808',   // noir profond (fond app)
  surface: '#14100C',      // cartes
  surfaceAlt: '#201810',   // surfaces secondaires (chips inactives, champs)

  // Textes
  text: '#F8F8F8',         // texte principal (crème clair)
  textSecondary: '#B0B0B0',// texte secondaire
  textMuted: '#7A7161',    // texte discret

  // Or
  gold: gold.primary,
  goldLight: gold.light,
  goldDeep: gold.deep,
  goldGradient,
  goldSoft: 'rgba(216, 168, 72, 0.18)',

  // Bandeau fidélité
  loyaltyBg: '#0B0906',
  loyaltyText: '#F5EFE1',
  loyaltyGlow: 'rgba(228, 193, 94, 0.30)',

  // Badges
  badgeInStockBg: 'rgba(107, 163, 104, 0.18)',
  badgeInStock: '#7FB57C',
  badgeSoonBg: 'rgba(216, 168, 72, 0.18)',
  badgeSoon: '#E4C15E',
  badgeNewBg: 'rgba(216, 168, 72, 0.18)',
  badgeNew: '#E4C15E',

  // Chips de filtres
  chipActiveBg: gold.primary,
  chipActiveText: '#1A1712',
  chipInactiveBg: 'transparent',
  chipInactiveText: '#B0B0B0',
  chipBorder: '#2E2820',

  // Overlay / scrim
  overlay: 'rgba(0, 0, 0, 0.60)',

  // Utilitaires
  border: '#2E2820',
  success: '#6BA368',
  danger: '#C86A60',
  star: gold.primary,

  // Tab bar
  tabBar: '#0F0C08',
  tabActive: gold.primary,
  tabInactive: '#6B6252',
};

export type ThemeMode = 'light' | 'dark';
export type Theme = Omit<typeof lightTheme, 'mode'> & { mode: ThemeMode };