import type { Translations } from './fr';

// Typé `Translations` : une clé manquante ou en trop ne compile pas.
export const en: Translations = {
  common: {
    ok: 'OK',
    cancel: 'Cancel',
    confirm: 'Confirm',
    delete: 'Delete',
    signIn: 'Sign in',
    save: 'Save',
    genericError: 'Something went wrong.',
    error: 'Error',
    retry: 'Try again',
    later: 'Later',
    points: 'points',
    pts: 'pts',
    currency: 'MAD',
    minutes: 'min',
  },

  nav: {
    home: 'Home',
    services: 'Services',
    products: 'Products',
    loyalty: 'Loyalty',
  },

  errors: {
    network: 'Connection failed. Check your network and try again.',
    tooManyAttempts: 'Too many attempts. Please wait a minute before trying again.',
    passwordTooShort: 'Password must be at least {{min}} characters long.',
    passwordNoUppercase: 'Password must contain at least one uppercase letter.',
    passwordNoLowercase: 'Password must contain at least one lowercase letter.',
    phoneInvalid: 'Enter a valid Moroccan phone number (e.g. 0612345678).',
  },

  auth: {
    firstName: 'First name',
    lastName: 'Last name',
    email: 'Email',
    password: 'Password',
    phone: 'Phone (e.g. 0612345678)',
    phoneOptional: 'Phone (optional)',

    fieldRequired: 'Required field',
    fieldsRequired: 'Required fields',
    firstNameRequired: 'First name is required.',
    lastNameRequired: 'Last name is required.',
    emailRequired: 'Enter your email address.',
    emailPasswordRequired: 'Email and password are required.',
    allFieldsRequired: 'All fields are required.',
    invalidPhone: 'Invalid number',
    passwordRejected: 'Password rejected',
    mismatchTitle: 'Mismatch',
    mismatchMessage: 'The confirmation does not match the new password.',

    registerTitle: 'Create an account',
    registerSubtitle: 'Join Yani Concept',
    passwordMinPlaceholder: 'Password (min. {{min}} characters)',
    registering: 'Creating…',
    register: 'Sign up',
    alreadyAccount: 'Already have an account? Sign in',
    registerFailed: 'Could not sign you up. Please try again.',
    checkPhoneTitle: 'Check your number',
    checkPhoneMessage:
      '{{phone}}\n\nThis is the number the salon will use to reach you about your orders and appointments.',
    editPhone: 'Edit',
    phoneCorrect: 'That’s correct',

    loginBrand: 'Yani Concept',
    loginSubtitle: 'Sign in to your account',
    loginFieldsMessage: 'Please enter your email and password.',
    loggingIn: 'Signing in...',
    loginFailed: 'Could not sign you in. Please try again.',
    forgotPassword: 'Forgot your password?',
    noAccount: 'No account yet? Create one',

    forgotTitle: 'Forgot password',
    forgotIntro:
      'Enter the email address of your account. We will send you a 6-digit code to choose a new password.',
    sending: 'Sending…',
    receiveCode: 'Send me a code',

    resetTitle: 'New password',
    codeFromEmail: 'Code received by email',
    ifAccountExists: 'If an account exists for',
    codeIncomplete: 'Incomplete code',
    codeLength: 'The code is {{length}} digits long.',
    newPasswordPlaceholder: 'New password (min. {{min}} characters)',
    confirmNewPassword: 'Confirm the new password',
    saving: 'Saving…',
    resetAction: 'Reset password',
    resetDoneTitle: 'Password reset',
    resetDoneMessage: 'You can now sign in with your new password.',
    resetFailed: 'Could not reset the password.',

    nothingReceived: 'I didn’t get anything — resend the code',
    resendIn: 'Resend the code in {{seconds}}s',
    codeResentTitle: 'Code resent',
    codeResentMessage: 'A new code has been sent to {{email}}.',
    codeSentTitle: 'Code sent',
    resendFailedSoon: 'Could not send. Try again in a moment.',
    resendFailed: 'Could not send. Please try again.',

    verifyTitle: 'Confirm your email',
    verifying: 'Verifying…',
    codeExpiry:
      'The code expires after 15 minutes. Remember to check your spam folder.',
    verifiedTitle: 'Address confirmed',
    verifiedMessage: 'Thank you, your email address is confirmed.',
    codeRejected: 'Code rejected',
    codeInvalid: 'Invalid or expired code.',

    changeTitle: 'Change password',
    currentPassword: 'Current password',
    newPasswordRulesPlaceholder:
      'New password (min. {{min}} characters, one uppercase and one lowercase)',
    changing: 'Changing…',
    changedTitle: 'Password changed',
    changedMessage:
      'Your password has been changed. Please sign in again with the new one.',
    changeFailed: 'Could not change the password. Check your current password.',

    editProfileTitle: 'Edit profile',
    savedTitle: 'Saved',
    savedMessage: 'Your profile has been updated.',
    updateFailed: 'Could not update your profile.',
  },

  home: {
    greeting: 'Hello',
    greetingNamed: 'Hello {{name}}',
    tagline: 'Beauty salon',
    dropA11y: 'Yani droplet',
    welcome: 'Welcome to Yani',
    profileA11y: 'Profile',
    loadFailed: 'Could not load the content.',
    staleBanner: 'Content not refreshed (connection).',
    guestMode: 'Guest mode · track your points',
    seeMore: 'See more →',
  },

  products: {
    empty: 'No products available at the moment.',
    emptyCategory: 'No products in this category.',
    loadFailed: 'Could not load the products.',
    staleBanner: 'Catalogue not refreshed (connection).',
    allCategories: 'All',
    otherCategory: 'Other',
    cartA11y: 'Cart',
    notFound: 'Product not found.',
    addedTitle: 'Added to cart',
    addedMessage: '“{{name}}” has been added to your cart.',
    addToCart: 'Add to cart',
    maxReached: 'Maximum reached',
    allStockInCart: 'All available stock is already in your cart.',
    allStockInCartQty: 'All available stock is already in your cart ({{qty}}).',
    price: 'Price',
    fallbackName: 'Product',
    inStock: 'In stock',
    outOfStock: 'Out of stock',
  },

  services: {
    empty: 'No services available at the moment.',
    emptyCategory: 'No services in this category.',
    loadFailed: 'Could not load the services.',
    staleBanner: 'Services not refreshed (connection).',
    notFound: 'Service not found.',
    priceFrom: 'From',
    book: 'Book',
    duration: 'Duration',
    fallbackName: 'Service',
  },

  cart: {
    title: 'My cart',
    empty: 'Your cart is empty.',
    subtotal: 'Subtotal',
    delivery: 'Delivery',
    deliveryFree: 'Free',
    total: 'Total',
    checkout: 'Place the order',
    login: 'Sign in',
    unavailableTitle: {
      one: 'Product unavailable',
      other: 'Products unavailable',
    },
    unavailableMessage: {
      one: '{{names}} is no longer available and has been removed from your cart.',
      other: '{{names}} are no longer available and have been removed from your cart.',
    },
    stockUpdatedTitle: 'Stock updated',
    stockSoldOut: '{{name}}: sold out, removed from your cart',
    stockReduced: '{{name}}: only {{after}} left (you had {{before}})',
    priceUpdatedTitle: 'Price updated',
    priceChanged: '{{name}}: {{before}} → {{after}}',
  },

  checkout: {
    title: 'Checkout',
    sectionMethod: 'Collection method',
    sectionAddress: 'Delivery address',
    sectionNote: 'Note (optional)',
    pickup: 'Pick up at the salon',
    pickupDesc: 'Collect your order in person',
    delivery: 'Home delivery',
    deliveryDesc: 'We deliver to the address you give',
    addressPlaceholder: '14 rue des Oliviers, Casablanca',
    addressRequiredTitle: 'Address required',
    addressRequiredMessage: 'Please provide a delivery address.',
    notePlaceholder: 'Anything the salon should know…',
    paymentPickup: 'Payment on collection.',
    paymentDelivery: 'Payment on delivery.',
    totalDue: 'Total due',
    sending: 'Sending…',
    confirm: 'Confirm the order',
    loginToOrder: 'Sign in to order',
    failed: 'Could not place the order. Please try again.',
  },

  orders: {
    title: 'My orders',
    empty: 'You have no orders yet.',
    loadFailed: 'Could not load your orders.',
    cancelTitle: 'Cancel the order',
    cancelMessage: 'Do you confirm the cancellation of this order?',
    cancelConfirm: 'Yes, cancel',
    cancelFailed: 'Could not cancel the order.',
    cancel: 'Cancel',
    no: 'No',
    pickup: 'Pickup',
    delivery: 'Delivery',
    itemCount: { one: '{{count}} item', other: '{{count}} items' },
    statusPending: 'Pending',
    statusConfirmed: 'Confirmed',
    statusReady: 'Ready',
    statusCompleted: 'Completed',
    statusCancelled: 'Cancelled',
    confirmedTitle: 'Order confirmed',
    confirmedPickup:
      'Your order is registered. The salon will call you to confirm the pickup.',
    confirmedDelivery:
      'Your order is registered. The salon will call you to confirm the delivery.',
    seeMyOrders: 'See my orders',
    backHome: 'Back to home',
  },

  appointments: {
    title: 'My appointments',
    empty: 'You have no appointments yet.',
    loadFailed: 'Could not load your appointments.',
    cancelTitle: 'Cancel the appointment',
    cancelMessage: 'Do you confirm the cancellation?',
    statusPending: 'Pending',
    statusConfirmed: 'Confirmed',
    statusCompleted: 'Completed',
    statusCancelled: 'Cancelled',
    seeMyAppointments: 'See my appointments',
  },

  booking: {
    title: 'Choose a slot',
    slotsOf: 'Slots for {{day}} {{month}}',
    closed: 'The salon is closed that day.',
    noSlots: 'No slots available.',
    continueWith: 'Continue · {{day}} {{month}}, {{time}}',
    summaryTitle: 'Summary',
    brandSubtitle: 'Institut Yani Concept',
    date: 'Date',
    time: 'Time',
    totalOnSite: 'Total payable on site',
    confirming: 'Confirming…',
    confirmBooking: 'Confirm the booking',
    bookingFailed: 'Could not confirm the booking.',
    confirmedTitle: 'Booking confirmed',
    confirmedFor: ' for your {{service}}.',
  },

  rewards: {
    loadFailed: 'Could not load your rewards.',
    empty: 'You have no rewards at the moment.',
    fromVisits: 'A gift for your visits',
    redeemedFor: 'Redeemed for {{points}} points',
    toPresent: 'To show',
    presentCode: 'Show the code at the salon on your next visit.',
    codeA11y: 'Code {{code}}',
  },

  profile: {
    title: 'Profile',
    defaultName: 'Client',
    guestGreeting: 'Hello, guest',
    guestSubtitle: 'Sign in for your points & bookings',
    signInOrRegister: 'Sign in / Create an account',

    verifyEmailTitle: 'Confirm your email address',
    verifyEmailSubtitle:
      'Required to recover your account if you forget your password.',

    sectionAccount: 'Account',
    sectionSecurity: 'Security',
    sectionAppearance: 'Appearance',
    sectionLanguage: 'Language',

    editProfile: 'Edit profile',
    myOrders: 'My orders',
    myAppointments: 'My appointments',
    myLoyalty: 'My loyalty',
    changePassword: 'Change password',

    themeSystem: 'System',
    themeLight: 'Light',
    themeDark: 'Dark',

    logout: 'Sign out',
    logoutConfirmMessage: 'Are you sure you want to sign out?',

    deleteAccount: 'Delete my account',
    deleteTitle: 'Delete account',
    deleteMessage:
      'This action is permanent. All your data (appointments, loyalty points) will be deleted. Do you want to continue?',
    deleteConfirmTitle: 'Confirm',
    deleteConfirmMessage:
      'Do you confirm the permanent deletion of your account?',
    deleteConfirmAction: 'Yes, delete',
    deleteFailed: 'Could not delete the account.',
  },

  language: {
    restartTitle: 'Restart required',
    restartMessage:
      'This language changes the reading direction. Please close the app completely and reopen it to finish switching.',
    restartUnderstood: 'Got it',
  },

  loyalty: {
    title: 'Loyalty',
    signedOutSubtitle:
      'Sign in to track your points and enjoy your rewards.',
    loadFailed: 'Could not load your loyalty account.',

    yourBalance: 'Your balance',
    yourVisits: 'Your visits',
    remainingForReward: '{{points}} pts to go for “{{reward}}”',

    visitsRemaining: {
      one: '1 more visit and “{{reward}}” is yours',
      other: '{{count}} more visits for “{{reward}}” free',
    },

    myRewards: 'My rewards',
    myRewardsEmpty: 'Rewards you have earned and used',
    myRewardsPending: {
      one: '1 reward to show at the salon',
      other: '{{count}} rewards to show at the salon',
    },
    myRewardsA11y: {
      one: 'My rewards, 1 to show',
      other: 'My rewards, {{count}} to show',
    },

    grantsTitle: 'A gift for you',
    // Tournure cardinale (« after N visits ») plutôt qu'ordinale : elle évite
    // les « 21st / 22nd / 23rd » que le français rend, lui, par un simple « e ».
    grantUnlockedAt: {
      one: 'Unlocked after 1 visit',
      other: 'Unlocked after {{count}} visits',
    },
    claim: 'Claim',
    claimA11y: 'Claim {{reward}}',
    claimTitle: 'Reward gifted',
    claimMessage: 'Claim “{{reward}}”? Show it at the salon afterwards.',
    claimedTitle: 'Reward claimed',
    claimFailed: 'Could not claim the reward.',

    rewardsTitle: 'Rewards',
    rewardsEmpty: 'No rewards available.',
    rewardA11y: '{{reward}}, {{points}} points',
    rewardA11yMissing:
      '{{reward}}, {{cost}} points, you need {{missing}} more points',
    missingPoints: 'You need {{points}} more pts',

    redeemTitle: 'Redeem',
    redeemMessage: 'Redeem “{{reward}}” for {{points}} points?',
    redeemedTitle: 'Reward redeemed',
    redeemFailed: 'Could not redeem the reward.',

    voucherCode: 'Your code: {{code}}. Show it at the salon.',
    seeMyVoucher: 'See my voucher',

    historyTitle: 'History',
    historyEmpty: 'No transactions yet.',
    offered: 'Gift',

    typeEarn: 'Points earned',
    typeRedeem: 'Reward redeemed',
    typeManual: 'Manual adjustment',
    typeMilestone: 'Reward gifted',
  },
};
