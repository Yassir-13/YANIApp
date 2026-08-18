import type { PluralForms } from '../plural';

// Le français est la LANGUE DE RÉFÉRENCE : c'est ce fichier qui définit la
// forme de tous les autres. `ar.ts` et `en.ts` sont typés `Translations`, donc
// une clé ajoutée ici et oubliée ailleurs ne compile pas. C'est volontaire —
// le mobile n'a aucun test, la compilation est son seul filet.

// Marque une entrée comme « à formes multiples ». Sans cette annotation,
// TypeScript figerait la liste des formes sur celles du français et l'arabe
// ne pourrait pas ajouter les siennes. Voir `../plural.ts`.
const plural = (forms: PluralForms): PluralForms => forms;

export const fr = {
  common: {
    ok: 'OK',
    cancel: 'Annuler',
    confirm: 'Confirmer',
    delete: 'Supprimer',
    signIn: 'Se connecter',
    save: 'Enregistrer',
    genericError: 'Une erreur est survenue.',
    error: 'Erreur',
    retry: 'Réessayer',
    later: 'Plus tard',
    points: 'points',
    pts: 'pts',
    currency: 'DH',
    minutes: 'min',
  },

  // Libellés des onglets. Les NOMS de routes restent « Accueil », « Services »,
  // « Produits », « Fidélité » : ce sont des identifiants passés à
  // `navigation.navigate()`, pas du texte affiché. Les traduire casserait la
  // navigation sans que la compilation s'en aperçoive.
  nav: {
    home: 'Accueil',
    services: 'Services',
    products: 'Produits',
    loyalty: 'Fidélité',
  },

  // Messages d'erreur partagés. Les validateurs (`passwordRules`,
  // `phoneRules`) renvoient la CLÉ et non le texte : ce sont des fonctions
  // pures, elles n'ont pas accès à `t`.
  errors: {
    network: 'Connexion impossible. Vérifiez votre réseau et réessayez.',
    tooManyAttempts: 'Trop de tentatives. Patientez une minute avant de réessayer.',
    passwordTooShort: 'Le mot de passe doit faire au moins {{min}} caractères.',
    passwordNoUppercase: 'Le mot de passe doit contenir au moins une majuscule.',
    passwordNoLowercase: 'Le mot de passe doit contenir au moins une minuscule.',
    phoneInvalid: 'Saisissez un numéro marocain valide (ex. 0612345678).',
  },

  // Inscription, connexion, mot de passe, profil : sept écrans partagent ces
  // libellés (les champs et le renvoi de code surtout).
  auth: {
    firstName: 'Prénom',
    lastName: 'Nom',
    email: 'Email',
    password: 'Mot de passe',
    phone: 'Téléphone (ex. 0612345678)',
    phoneOptional: 'Téléphone (optionnel)',

    fieldRequired: 'Champ requis',
    fieldsRequired: 'Champs requis',
    firstNameRequired: 'Le prénom est obligatoire.',
    lastNameRequired: 'Le nom est obligatoire.',
    emailRequired: 'Saisissez votre adresse email.',
    emailPasswordRequired: 'Email et mot de passe sont obligatoires.',
    allFieldsRequired: 'Tous les champs sont obligatoires.',
    invalidPhone: 'Numéro invalide',
    passwordRejected: 'Mot de passe refusé',
    mismatchTitle: 'Non concordant',
    mismatchMessage: 'La confirmation ne correspond pas au nouveau mot de passe.',

    registerTitle: 'Créer un compte',
    registerSubtitle: 'Rejoignez Yani Concept',
    passwordMinPlaceholder: 'Mot de passe (min. {{min}} caractères)',
    registering: 'Création…',
    register: 'S’inscrire',
    alreadyAccount: 'Déjà un compte ? Se connecter',
    registerFailed: 'Inscription impossible. Réessayez.',
    checkPhoneTitle: 'Vérifiez votre numéro',
    checkPhoneMessage:
      '{{phone}}\n\nC’est avec ce numéro que l’institut vous contactera pour vos commandes et vos rendez-vous.',
    editPhone: 'Modifier',
    phoneCorrect: 'C’est correct',

    loginBrand: 'Yani Concept',
    loginSubtitle: 'Connectez-vous à votre compte',
    loginFieldsMessage: 'Merci de saisir votre email et mot de passe.',
    loggingIn: 'Connexion...',
    loginFailed: 'Connexion impossible. Réessayez.',
    forgotPassword: 'Mot de passe oublié ?',
    noAccount: 'Pas encore de compte ? Créer un compte',

    forgotTitle: 'Mot de passe oublié',
    forgotIntro:
      'Saisissez l’adresse email de votre compte. Nous vous enverrons un code à 6 chiffres pour choisir un nouveau mot de passe.',
    sending: 'Envoi…',
    receiveCode: 'Recevoir un code',

    resetTitle: 'Nouveau mot de passe',
    codeFromEmail: 'Code reçu par email',
    ifAccountExists: 'Si un compte existe pour',
    codeIncomplete: 'Code incomplet',
    codeLength: 'Le code contient {{length}} chiffres.',
    newPasswordPlaceholder: 'Nouveau mot de passe (min. {{min}} caractères)',
    confirmNewPassword: 'Confirmer le nouveau mot de passe',
    saving: 'Enregistrement…',
    resetAction: 'Réinitialiser le mot de passe',
    resetDoneTitle: 'Mot de passe réinitialisé',
    resetDoneMessage:
      'Vous pouvez maintenant vous connecter avec votre nouveau mot de passe.',
    resetFailed: 'Réinitialisation impossible.',

    nothingReceived: 'Je n’ai rien reçu — renvoyer le code',
    resendIn: 'Renvoyer le code dans {{seconds}} s',
    codeResentTitle: 'Code renvoyé',
    codeResentMessage: 'Un nouveau code a été envoyé à {{email}}.',
    codeSentTitle: 'Code envoyé',
    resendFailedSoon: 'Envoi impossible. Réessayez dans un instant.',
    resendFailed: 'Envoi impossible. Réessayez.',

    verifyTitle: 'Confirmer votre email',
    verifying: 'Vérification…',
    codeExpiry:
      'Le code expire au bout de 15 minutes. Pensez à regarder dans vos courriers indésirables.',
    verifiedTitle: 'Adresse confirmée',
    verifiedMessage: 'Merci, votre adresse email est confirmée.',
    codeRejected: 'Code refusé',
    codeInvalid: 'Code invalide ou expiré.',

    changeTitle: 'Modifier le mot de passe',
    currentPassword: 'Mot de passe actuel',
    newPasswordRulesPlaceholder:
      'Nouveau mot de passe (min. {{min}} caractères, une majuscule et une minuscule)',
    changing: 'Modification…',
    changedTitle: 'Mot de passe modifié',
    changedMessage:
      'Votre mot de passe a bien été changé. Reconnectez-vous avec le nouveau.',
    changeFailed: 'Modification impossible. Vérifiez votre mot de passe actuel.',

    editProfileTitle: 'Modifier le profil',
    savedTitle: 'Enregistré',
    savedMessage: 'Votre profil a été mis à jour.',
    updateFailed: 'Mise à jour impossible.',
  },

  home: {
    greeting: 'Bonjour',
    greetingNamed: 'Bonjour {{name}}',
    tagline: 'Centre de beauté',
    dropA11y: 'Goutte Yani',
    welcome: 'Bienvenue chez Yani',
    profileA11y: 'Profil',
    loadFailed: 'Impossible de charger le contenu.',
    staleBanner: 'Contenu non actualisé (connexion).',
    guestMode: 'Mode invité · suivez vos points',
    // La flèche est dans le texte, pas dans le code : en arabe elle pointe
    // vers la gauche, et c'est la traduction qui le porte.
    seeMore: 'Voir plus →',
  },

  products: {
    empty: 'Aucun produit disponible pour le moment.',
    emptyCategory: 'Aucun produit dans cette catégorie.',
    loadFailed: 'Impossible de charger les produits.',
    staleBanner: 'Catalogue non actualisé (connexion).',
    allCategories: 'Tous',
    otherCategory: 'Autres',
    cartA11y: 'Panier',
    notFound: 'Produit introuvable.',
    addedTitle: 'Ajouté au panier',
    addedMessage: '« {{name}} » a été ajouté à votre panier.',
    addToCart: 'Ajouter au panier',
    maxReached: 'Maximum atteint',
    allStockInCart: 'Tout le stock disponible est déjà dans votre panier.',
    allStockInCartQty: 'Tout le stock disponible est déjà dans votre panier ({{qty}}).',
    price: 'Prix',
    fallbackName: 'Produit',
    inStock: 'En stock',
    outOfStock: 'Épuisé',
  },

  services: {
    empty: 'Aucun service disponible pour le moment.',
    emptyCategory: 'Aucun service dans cette catégorie.',
    loadFailed: 'Impossible de charger les services.',
    staleBanner: 'Prestations non actualisées (connexion).',
    notFound: 'Service introuvable.',
    priceFrom: 'À partir de',
    book: 'Réserver',
    duration: 'Durée',
    fallbackName: 'Service',
  },

  cart: {
    title: 'Mon panier',
    empty: 'Votre panier est vide.',
    subtotal: 'Sous-total',
    delivery: 'Livraison',
    deliveryFree: 'Offerte',
    total: 'Total',
    checkout: 'Valider la commande',
    login: 'Connexion',
    unavailableTitle: plural({
      one: 'Produit indisponible',
      other: 'Produits indisponibles',
    }),
    unavailableMessage: plural({
      one: '{{names}} n’est plus disponible et a été retiré de votre panier.',
      other: '{{names}} ne sont plus disponibles et ont été retirés de votre panier.',
    }),
    stockUpdatedTitle: 'Stock mis à jour',
    stockSoldOut: '{{name}} : épuisé, retiré de votre panier',
    stockReduced: '{{name}} : il n’en reste que {{after}} (vous en aviez {{before}})',
    priceUpdatedTitle: 'Prix mis à jour',
    priceChanged: '{{name}} : {{before}} → {{after}}',
  },

  checkout: {
    title: 'Finaliser',
    sectionMethod: 'Mode de récupération',
    sectionAddress: 'Adresse de livraison',
    sectionNote: 'Note (optionnel)',
    pickup: 'Retrait à l’institut',
    pickupDesc: 'Récupérez votre commande sur place',
    delivery: 'Livraison à domicile',
    deliveryDesc: 'Nous vous livrons à l’adresse indiquée',
    addressPlaceholder: '14 rue des Oliviers, Casablanca',
    addressRequiredTitle: 'Adresse requise',
    addressRequiredMessage: 'Merci d’indiquer une adresse de livraison.',
    notePlaceholder: 'Une précision pour l’institut…',
    paymentPickup: 'Paiement sur place au retrait.',
    paymentDelivery: 'Paiement à la livraison.',
    totalDue: 'Total à régler',
    sending: 'Envoi…',
    confirm: 'Confirmer la commande',
    loginToOrder: 'Se connecter pour commander',
    failed: 'Commande impossible. Réessayez.',
  },

  orders: {
    title: 'Mes commandes',
    empty: 'Vous n’avez aucune commande.',
    loadFailed: 'Impossible de charger vos commandes.',
    cancelTitle: 'Annuler la commande',
    cancelMessage: 'Confirmez-vous l’annulation de cette commande ?',
    cancelConfirm: 'Oui, annuler',
    cancelFailed: 'Annulation impossible.',
    cancel: 'Annuler',
    no: 'Non',
    pickup: 'Retrait',
    delivery: 'Livraison',
    itemCount: plural({ one: '{{count}} article', other: '{{count}} articles' }),
    statusPending: 'En attente',
    statusConfirmed: 'Confirmée',
    statusReady: 'Prête',
    statusCompleted: 'Terminée',
    statusCancelled: 'Annulée',
    confirmedTitle: 'Commande confirmée',
    confirmedPickup:
      'Votre commande est enregistrée. L’institut vous appellera pour confirmer le retrait.',
    confirmedDelivery:
      'Votre commande est enregistrée. L’institut vous appellera pour confirmer la livraison.',
    seeMyOrders: 'Voir mes commandes',
    backHome: 'Retour à l’accueil',
  },

  appointments: {
    title: 'Mes rendez-vous',
    empty: 'Vous n’avez aucun rendez-vous.',
    loadFailed: 'Impossible de charger vos rendez-vous.',
    cancelTitle: 'Annuler le rendez-vous',
    cancelMessage: 'Confirmez-vous l’annulation ?',
    statusPending: 'En attente',
    statusConfirmed: 'Confirmé',
    statusCompleted: 'Terminé',
    statusCancelled: 'Annulé',
    seeMyAppointments: 'Voir mes rendez-vous',
  },

  booking: {
    title: 'Choisir un créneau',
    slotsOf: 'Créneaux du {{day}} {{month}}',
    closed: 'Le centre est fermé ce jour-là.',
    noSlots: 'Aucun créneau disponible.',
    continueWith: 'Continuer · {{day}} {{month}}, {{time}}',
    summaryTitle: 'Récapitulatif',
    brandSubtitle: 'Institut Yani Concept',
    date: 'Date',
    time: 'Heure',
    totalOnSite: 'Total à régler sur place',
    confirming: 'Confirmation…',
    confirmBooking: 'Confirmer la réservation',
    bookingFailed: 'Réservation impossible.',
    confirmedTitle: 'Réservation confirmée',
    confirmedFor: ' pour votre {{service}}.',
  },

  rewards: {
    loadFailed: 'Impossible de charger vos récompenses.',
    empty: 'Vous n’avez aucune récompense pour le moment.',
    fromVisits: 'Offerte pour vos visites',
    redeemedFor: 'Échangée contre {{points}} points',
    toPresent: 'À présenter',
    presentCode: 'Présentez le code à l’institut lors de votre prochaine visite.',
    codeA11y: 'Code {{code}}',
  },

  profile: {
    title: 'Profil',
    defaultName: 'Client',
    guestGreeting: 'Bonjour, invité',
    guestSubtitle: 'Connectez-vous pour vos points & réservations',
    signInOrRegister: 'Se connecter / Créer un compte',

    verifyEmailTitle: 'Confirmez votre adresse email',
    verifyEmailSubtitle:
      'Nécessaire pour récupérer votre compte en cas d’oubli de mot de passe.',

    sectionAccount: 'Compte',
    sectionSecurity: 'Sécurité',
    sectionAppearance: 'Apparence',
    sectionLanguage: 'Langue',

    editProfile: 'Modifier le profil',
    myOrders: 'Mes commandes',
    myAppointments: 'Mes rendez-vous',
    myLoyalty: 'Ma fidélité',
    changePassword: 'Changer le mot de passe',

    themeSystem: 'Système',
    themeLight: 'Clair',
    themeDark: 'Sombre',

    logout: 'Se déconnecter',
    logoutConfirmMessage: 'Voulez-vous vraiment vous déconnecter ?',

    deleteAccount: 'Supprimer mon compte',
    deleteTitle: 'Supprimer le compte',
    deleteMessage:
      'Cette action est définitive. Toutes vos données (rendez-vous, points de fidélité) seront supprimées. Voulez-vous continuer ?',
    deleteConfirmTitle: 'Confirmer',
    deleteConfirmMessage:
      'Confirmez-vous la suppression définitive de votre compte ?',
    deleteConfirmAction: 'Oui, supprimer',
    deleteFailed: 'Suppression impossible.',
  },

  // Le sens de lecture ne peut pas changer à chaud : React Native ne retourne
  // la mise en page qu'au démarrage suivant.
  language: {
    // Formulé sans nommer l'arabe : ce message s'affiche aussi bien en
    // ENTRANT dans l'arabe qu'en en sortant.
    restartTitle: 'Redémarrage nécessaire',
    restartMessage:
      'Le sens de lecture change avec cette langue. Fermez complètement l’application puis rouvrez-la pour terminer le changement.',
    restartUnderstood: 'J’ai compris',
  },

  loyalty: {
    title: 'Fidélité',
    signedOutSubtitle:
      'Connectez-vous pour suivre vos points et profiter de vos récompenses.',
    loadFailed: 'Impossible de charger votre fidélité.',

    yourBalance: 'Votre solde',
    yourVisits: 'Vos visites',
    // `count` est réservé aux entrées à formes multiples : i18next y déclenche
    // la résolution des pluriels. Ailleurs, on nomme la variable autrement.
    remainingForReward: 'Plus que {{points}} pts pour « {{reward}} »',

    visitsRemaining: plural({
      one: 'Encore 1 visite et « {{reward}} » vous est offert',
      other: 'Encore {{count}} visites pour « {{reward}} » offert',
    }),

    myRewards: 'Mes récompenses',
    myRewardsEmpty: 'Vos récompenses obtenues et utilisées',
    myRewardsPending: plural({
      one: '1 récompense à présenter à l’institut',
      other: '{{count}} récompenses à présenter à l’institut',
    }),
    myRewardsA11y: plural({
      one: 'Mes récompenses, 1 à présenter',
      other: 'Mes récompenses, {{count}} à présenter',
    }),

    grantsTitle: 'Offert pour vous',
    // En formes multiples pour l'ordinal : « 1re » et non « 1e ».
    grantUnlockedAt: plural({
      one: 'Débloqué à votre 1re visite',
      other: 'Débloqué à votre {{count}}e visite',
    }),
    claim: 'Réclamer',
    claimA11y: 'Réclamer {{reward}}',
    claimTitle: 'Récompense offerte',
    claimMessage:
      'Réclamer « {{reward}} » ? Présentez-la ensuite à l’institut.',
    claimedTitle: 'Récompense réclamée',
    claimFailed: 'Réclamation impossible.',

    rewardsTitle: 'Récompenses',
    rewardsEmpty: 'Aucune récompense disponible.',
    rewardA11y: '{{reward}}, {{points}} points',
    rewardA11yMissing:
      '{{reward}}, {{cost}} points, il vous manque {{missing}} points',
    missingPoints: 'Il vous manque {{points}} pts',

    redeemTitle: 'Échanger',
    redeemMessage: 'Échanger « {{reward}} » contre {{points}} points ?',
    redeemedTitle: 'Récompense échangée',
    redeemFailed: 'Échange impossible.',

    voucherCode: 'Votre code : {{code}}. Présentez-le à l’institut.',
    seeMyVoucher: 'Voir mon bon',

    historyTitle: 'Historique',
    historyEmpty: 'Aucune transaction.',
    offered: 'Offert',

    typeEarn: 'Points gagnés',
    typeRedeem: 'Récompense échangée',
    typeManual: 'Ajout manuel',
    typeMilestone: 'Récompense offerte',
  },
};

// La forme de référence. `ar.ts` et `en.ts` s'y conforment ou ne compilent pas.
export type Translations = typeof fr;
