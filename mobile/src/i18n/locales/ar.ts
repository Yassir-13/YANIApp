import type { Translations } from './fr';

// Arabe standard, à RELIRE par une personne arabophone du métier avant
// publication (voir l'étape 11 de la récap).
//
// Deux partis pris assumés, signalés ici pour qu'ils soient discutés et non
// subis :
//
//  1. Les verbes s'adressent à la cliente au FÉMININ (سجّلي، تستلمين، أكّدي).
//     L'arabe accorde le verbe au genre : le masculin par défaut aurait sonné
//     faux dans un institut de beauté.
//  2. « institut » est rendu par المعهد, en écho au nom de la marque.
//     الصالون serait plus courant à l'oral au Maroc.
//
// Les formes de pluriel suivent la norme CLDR arabe : one (1), two (2),
// few (3–10), many (11–99), other (le reste). Voir `../plural.ts`.
export const ar: Translations = {
  common: {
    ok: 'حسنًا',
    cancel: 'إلغاء',
    confirm: 'تأكيد',
    delete: 'حذف',
    signIn: 'تسجيل الدخول',
    save: 'حفظ',
    genericError: 'حدث خطأ.',
    error: 'خطأ',
    retry: 'إعادة المحاولة',
    later: 'لاحقًا',
    points: 'نقطة',
    pts: 'نقطة',
    currency: 'درهم',
    minutes: 'دقيقة',
  },

  nav: {
    home: 'الرئيسية',
    services: 'الخدمات',
    products: 'المنتجات',
    loyalty: 'الولاء',
  },

  errors: {
    network: 'تعذّر الاتصال. تحقّقي من شبكتك ثم أعيدي المحاولة.',
    tooManyAttempts: 'محاولات كثيرة. انتظري دقيقة قبل إعادة المحاولة.',
    // « majuscule / minuscule » n'existent pas en écriture arabe : les
    // messages parlent de la casse des lettres LATINES du mot de passe.
    passwordTooShort: 'يجب أن تتكوّن كلمة المرور من {{min}} خانات على الأقل.',
    passwordNoUppercase: 'يجب أن تتضمّن كلمة المرور حرفًا لاتينيًا كبيرًا على الأقل.',
    passwordNoLowercase: 'يجب أن تتضمّن كلمة المرور حرفًا لاتينيًا صغيرًا على الأقل.',
    phoneInvalid: 'أدخلي رقمًا مغربيًا صحيحًا (مثال: 0612345678).',
  },

  auth: {
    firstName: 'الاسم الشخصي',
    lastName: 'الاسم العائلي',
    email: 'البريد الإلكتروني',
    password: 'كلمة المرور',
    phone: 'الهاتف (مثال: 0612345678)',
    phoneOptional: 'الهاتف (اختياري)',

    fieldRequired: 'حقل مطلوب',
    fieldsRequired: 'حقول مطلوبة',
    firstNameRequired: 'الاسم الشخصي إلزامي.',
    lastNameRequired: 'الاسم العائلي إلزامي.',
    emailRequired: 'أدخلي بريدك الإلكتروني.',
    emailPasswordRequired: 'البريد الإلكتروني وكلمة المرور إلزاميان.',
    allFieldsRequired: 'جميع الحقول إلزامية.',
    invalidPhone: 'رقم غير صالح',
    passwordRejected: 'كلمة المرور مرفوضة',
    mismatchTitle: 'غير متطابقتين',
    mismatchMessage: 'التأكيد لا يطابق كلمة المرور الجديدة.',

    registerTitle: 'إنشاء حساب',
    registerSubtitle: 'انضمّي إلى Yani Concept',
    passwordMinPlaceholder: 'كلمة المرور ({{min}} خانات على الأقل)',
    registering: 'جارٍ الإنشاء…',
    register: 'تسجيل',
    alreadyAccount: 'لديك حساب؟ سجّلي الدخول',
    registerFailed: 'تعذّر إنشاء الحساب. أعيدي المحاولة.',
    checkPhoneTitle: 'تحقّقي من رقمك',
    checkPhoneMessage:
      '{{phone}}\n\nعلى هذا الرقم سيتواصل معك المعهد بخصوص طلباتك ومواعيدك.',
    editPhone: 'تعديل',
    phoneCorrect: 'الرقم صحيح',

    loginBrand: 'Yani Concept',
    loginSubtitle: 'سجّلي الدخول إلى حسابك',
    loginFieldsMessage: 'أدخلي بريدك الإلكتروني وكلمة المرور.',
    loggingIn: 'جارٍ الدخول...',
    loginFailed: 'تعذّر تسجيل الدخول. أعيدي المحاولة.',
    forgotPassword: 'نسيت كلمة المرور؟',
    noAccount: 'ليس لديك حساب؟ أنشئي واحدًا',

    forgotTitle: 'نسيت كلمة المرور',
    forgotIntro:
      'أدخلي البريد الإلكتروني لحسابك. سنرسل لك رمزًا من 6 أرقام لاختيار كلمة مرور جديدة.',
    sending: 'جارٍ الإرسال…',
    receiveCode: 'أرسلي لي رمزًا',

    resetTitle: 'كلمة مرور جديدة',
    codeFromEmail: 'الرمز المستلم بالبريد',
    ifAccountExists: 'إذا كان هناك حساب مرتبط بـ',
    // Suite de `ifAccountExists`, coupée par l'adresse email affichée entre
    // les deux.
    resetCodeSent:
      'فقد أُرسل إليه رمز من {{length}} أرقام. تنتهي صلاحيته بعد 15 دقيقة.',
    codeIncomplete: 'رمز ناقص',
    codeLength: 'يتكوّن الرمز من {{length}} أرقام.',
    newPasswordPlaceholder: 'كلمة المرور الجديدة ({{min}} خانات على الأقل)',
    confirmNewPassword: 'تأكيد كلمة المرور الجديدة',
    saving: 'جارٍ الحفظ…',
    resetAction: 'إعادة تعيين كلمة المرور',
    resetDoneTitle: 'تمّت إعادة تعيين كلمة المرور',
    resetDoneMessage: 'يمكنك الآن تسجيل الدخول بكلمة المرور الجديدة.',
    resetFailed: 'تعذّرت إعادة التعيين.',

    nothingReceived: 'لم يصلني شيء — أعيدي إرسال الرمز',
    resendIn: 'إعادة إرسال الرمز بعد {{seconds}} ثانية',
    codeResentTitle: 'تمّت إعادة إرسال الرمز',
    codeResentMessage: 'أُرسل رمز جديد إلى {{email}}.',
    codeSentTitle: 'تمّ إرسال الرمز',
    resendFailedSoon: 'تعذّر الإرسال. أعيدي المحاولة بعد لحظات.',
    resendFailed: 'تعذّر الإرسال. أعيدي المحاولة.',

    verifyTitle: 'تأكيد بريدك الإلكتروني',
    // Suivi de l'adresse email, sur sa propre ligne.
    codeSentTo: 'أرسلنا رمزًا من {{length}} أرقام إلى',
    verifying: 'جارٍ التحقّق…',
    codeExpiry:
      'تنتهي صلاحية الرمز بعد 15 دقيقة. تحقّقي أيضًا من مجلّد الرسائل غير المرغوب فيها.',
    verifiedTitle: 'تمّ تأكيد العنوان',
    verifiedMessage: 'شكرًا، تمّ تأكيد بريدك الإلكتروني.',
    codeRejected: 'رمز مرفوض',
    codeInvalid: 'رمز غير صالح أو منتهي الصلاحية.',

    changeTitle: 'تغيير كلمة المرور',
    currentPassword: 'كلمة المرور الحالية',
    newPasswordRulesPlaceholder:
      'كلمة المرور الجديدة ({{min}} خانات على الأقل، حرف لاتيني كبير وآخر صغير)',
    changing: 'جارٍ التعديل…',
    changedTitle: 'تمّ تغيير كلمة المرور',
    changedMessage: 'تمّ تغيير كلمة مرورك. سجّلي الدخول من جديد بالكلمة الجديدة.',
    changeFailed: 'تعذّر التعديل. تحقّقي من كلمة مرورك الحالية.',

    editProfileTitle: 'تعديل الملف الشخصي',
    savedTitle: 'تمّ الحفظ',
    savedMessage: 'تمّ تحديث ملفك الشخصي.',
    updateFailed: 'تعذّر التحديث.',
  },

  home: {
    greeting: 'مرحبًا',
    greetingNamed: 'مرحبًا {{name}}',
    tagline: 'مركز التجميل',
    dropA11y: 'قطرة Yani',
    // La marque reste en écriture latine, comme sur l'enseigne.
    welcome: 'أهلًا بك في Yani',
    profileA11y: 'الملف الشخصي',
    loadFailed: 'تعذّر تحميل المحتوى.',
    staleBanner: 'لم يُحدَّث المحتوى (الاتصال).',
    guestMode: 'وضع الزائرة · تابعي نقاطك',
    // Flèche inversée : en arabe, « la suite » est à gauche.
    seeMore: 'المزيد ←',
  },

  products: {
    empty: 'لا توجد منتجات متاحة حاليًا.',
    emptyCategory: 'لا توجد منتجات في هذه الفئة.',
    loadFailed: 'تعذّر تحميل المنتجات.',
    staleBanner: 'لم يُحدَّث الكتالوج (الاتصال).',
    allCategories: 'الكل',
    otherCategory: 'أخرى',
    cartA11y: 'السلة',
    notFound: 'المنتج غير موجود.',
    addedTitle: 'أُضيف إلى السلة',
    addedMessage: 'أُضيف «{{name}}» إلى سلتك.',
    addToCart: 'أضيفي إلى السلة',
    maxReached: 'بلغت الحدّ الأقصى',
    allStockInCart: 'كلّ الكمية المتوفّرة موجودة في سلتك.',
    allStockInCartQty: 'كلّ الكمية المتوفّرة موجودة في سلتك ({{qty}}).',
    price: 'الثمن',
    fallbackName: 'منتج',
    inStock: 'متوفر',
    outOfStock: 'نفد',
  },

  services: {
    empty: 'لا توجد خدمات متاحة حاليًا.',
    emptyCategory: 'لا توجد خدمات في هذه الفئة.',
    loadFailed: 'تعذّر تحميل الخدمات.',
    staleBanner: 'لم تُحدَّث الخدمات (الاتصال).',
    notFound: 'الخدمة غير موجودة.',
    priceFrom: 'ابتداءً من',
    book: 'احجزي',
    duration: 'المدّة',
    fallbackName: 'خدمة',
  },

  cart: {
    title: 'سلتي',
    empty: 'سلتك فارغة.',
    subtotal: 'المجموع الفرعي',
    delivery: 'التوصيل',
    deliveryFree: 'مجاني',
    total: 'المجموع',
    checkout: 'تأكيد الطلب',
    login: 'تسجيل الدخول',
    maxStock: 'الكمية القصوى: {{qty}}',
    // Deux clés : les points sont rendus en doré dans un `<Text>` imbriqué.
    // L'arabe place la valeur à la fin comme le français, la coupure tient.
    loginToEarn: 'سجّلي الدخول لتربحي',
    pointsToEarn: '+{{points}} نقطة',
    unavailableTitle: {
      one: 'منتج غير متوفّر',
      two: 'منتجان غير متوفّرين',
      few: 'منتجات غير متوفّرة',
      many: 'منتجات غير متوفّرة',
      other: 'منتجات غير متوفّرة',
    },
    unavailableMessage: {
      one: 'لم يعد {{names}} متوفّرًا وقد أُزيل من سلتك.',
      two: 'لم يعد {{names}} متوفّرين وقد أُزيلا من سلتك.',
      few: 'لم تعد {{names}} متوفّرة وقد أُزيلت من سلتك.',
      many: 'لم تعد {{names}} متوفّرة وقد أُزيلت من سلتك.',
      other: 'لم تعد {{names}} متوفّرة وقد أُزيلت من سلتك.',
    },
    stockUpdatedTitle: 'تحديث الكمية',
    stockSoldOut: '{{name}}: نفد، وأُزيل من سلتك',
    stockReduced: '{{name}}: لم يبق سوى {{after}} (كان لديك {{before}})',
    priceUpdatedTitle: 'تحديث الثمن',
    priceChanged: '{{name}}: {{before}} ← {{after}}',
  },

  checkout: {
    title: 'إتمام الطلب',
    sectionMethod: 'طريقة الاستلام',
    sectionAddress: 'عنوان التوصيل',
    sectionNote: 'ملاحظة (اختياري)',
    pickup: 'الاستلام من المعهد',
    pickupDesc: 'استلمي طلبك في عين المكان',
    delivery: 'التوصيل إلى المنزل',
    deliveryDesc: 'نوصّل طلبك إلى العنوان المذكور',
    addressPlaceholder: '14 زنقة الزيتون، الدار البيضاء',
    addressRequiredTitle: 'العنوان مطلوب',
    addressRequiredMessage: 'يُرجى إدخال عنوان التوصيل.',
    notePlaceholder: 'توضيح للمعهد…',
    paymentPickup: 'الأداء عند الاستلام في المعهد.',
    paymentDelivery: 'الأداء عند التوصيل.',
    totalDue: 'المبلغ الإجمالي',
    sending: 'جارٍ الإرسال…',
    confirm: 'تأكيد الطلب',
    loginToOrder: 'سجّلي الدخول للطلب',
    failed: 'تعذّر إتمام الطلب. أعيدي المحاولة.',
  },

  orders: {
    title: 'طلباتي',
    empty: 'ليس لديك أيّ طلب.',
    loadFailed: 'تعذّر تحميل طلباتك.',
    cancelTitle: 'إلغاء الطلب',
    cancelMessage: 'هل تؤكّدين إلغاء هذا الطلب؟',
    cancelConfirm: 'نعم، ألغِ',
    cancelFailed: 'تعذّر الإلغاء.',
    cancel: 'إلغاء',
    no: 'لا',
    pickup: 'استلام',
    delivery: 'توصيل',
    itemCount: {
      one: 'منتج واحد',
      two: 'منتجان',
      few: '{{count}} منتجات',
      many: '{{count}} منتجًا',
      other: '{{count}} منتج',
    },
    // Même grammaire qu'`itemCount`, avec l'accord de « آخر / أخرى ».
    moreItems: {
      one: '+{{count}} منتج آخر',
      two: '+{{count}} منتجان آخران',
      few: '+{{count}} منتجات أخرى',
      many: '+{{count}} منتجًا آخر',
      other: '+{{count}} منتج آخر',
    },
    statusPending: 'في الانتظار',
    statusConfirmed: 'مؤكَّد',
    statusReady: 'جاهز',
    statusCompleted: 'منتهٍ',
    statusCancelled: 'ملغى',
    confirmedTitle: 'تمّ تأكيد الطلب',
    confirmedPickup: 'سُجّل طلبك. سيتّصل بك المعهد لتأكيد الاستلام.',
    confirmedDelivery: 'سُجّل طلبك. سيتّصل بك المعهد لتأكيد التوصيل.',
    seeMyOrders: 'عرض طلباتي',
    backHome: 'العودة إلى الرئيسية',
  },

  appointments: {
    title: 'مواعيدي',
    empty: 'ليس لديك أيّ موعد.',
    loadFailed: 'تعذّر تحميل مواعيدك.',
    cancelTitle: 'إلغاء الموعد',
    cancelMessage: 'هل تؤكّدين الإلغاء؟',
    statusPending: 'في الانتظار',
    statusConfirmed: 'مؤكَّد',
    statusCompleted: 'منتهٍ',
    statusCancelled: 'ملغى',
    seeMyAppointments: 'عرض مواعيدي',
  },

  booking: {
    title: 'اختيار موعد',
    slotsOf: 'مواعيد {{day}} {{month}}',
    closed: 'المعهد مغلق في هذا اليوم.',
    noSlots: 'لا توجد مواعيد متاحة.',
    continueWith: 'متابعة · {{day}} {{month}}، {{time}}',
    summaryTitle: 'الملخّص',
    brandSubtitle: 'Institut Yani Concept',
    date: 'التاريخ',
    time: 'الساعة',
    totalOnSite: 'المبلغ المستحقّ في عين المكان',
    confirming: 'جارٍ التأكيد…',
    confirmBooking: 'تأكيد الحجز',
    bookingFailed: 'تعذّر الحجز.',
    confirmedTitle: 'تمّ تأكيد الحجز',
    weExpectYou: 'ننتظرك يوم {{date}} على الساعة {{time}}',
    confirmedFor: ' لأجل {{service}}.',
  },

  rewards: {
    loadFailed: 'تعذّر تحميل مكافآتك.',
    empty: 'ليس لديك أيّ مكافأة حاليًا.',
    fromVisits: 'هدية على زياراتك',
    redeemedFor: 'مستبدلة مقابل {{points}} نقطة',
    toPresent: 'للتقديم',
    usedOn: 'استُعملت في {{date}}',
    presentCode: 'قدّمي الرمز في المعهد عند زيارتك المقبلة.',
    codeA11y: 'الرمز {{code}}',
  },

  profile: {
    title: 'الملف الشخصي',
    defaultName: 'عميلة',
    guestGreeting: 'مرحبًا بك، زائرة',
    guestSubtitle: 'سجّلي الدخول لمتابعة نقاطك وحجوزاتك',
    signInOrRegister: 'تسجيل الدخول / إنشاء حساب',

    verifyEmailTitle: 'أكّدي بريدك الإلكتروني',
    verifyEmailSubtitle:
      'ضروري لاستعادة حسابك في حال نسيت كلمة المرور.',

    sectionAccount: 'الحساب',
    sectionSecurity: 'الأمان',
    sectionAppearance: 'المظهر',
    sectionLanguage: 'اللغة',

    editProfile: 'تعديل الملف الشخصي',
    myOrders: 'طلباتي',
    myAppointments: 'مواعيدي',
    myLoyalty: 'نقاط الولاء',
    changePassword: 'تغيير كلمة المرور',

    themeSystem: 'النظام',
    themeLight: 'فاتح',
    themeDark: 'داكن',

    logout: 'تسجيل الخروج',
    logoutConfirmMessage: 'هل تريدين فعلًا تسجيل الخروج؟',

    deleteAccount: 'حذف حسابي',
    deleteTitle: 'حذف الحساب',
    deleteMessage:
      'هذا الإجراء نهائي. ستُحذف جميع بياناتك (المواعيد، نقاط الولاء). هل تريدين المتابعة؟',
    deleteConfirmTitle: 'تأكيد',
    deleteConfirmMessage: 'هل تؤكّدين حذف حسابك نهائيًا؟',
    deleteConfirmAction: 'نعم، احذف',
    deleteFailed: 'تعذّر حذف الحساب.',
  },

  language: {
    restartTitle: 'يلزم إعادة التشغيل',
    restartMessage:
      'يتغيّر اتجاه الكتابة مع هذه اللغة. أغلقي التطبيق تمامًا ثم افتحيه من جديد لإتمام التغيير.',
    restartUnderstood: 'فهمت',
  },

  loyalty: {
    title: 'الولاء',
    signedOutSubtitle: 'سجّلي الدخول لمتابعة نقاطك والاستفادة من مكافآتك.',
    loadFailed: 'تعذّر تحميل بيانات الولاء.',

    yourBalance: 'رصيدك',
    yourVisits: 'زياراتك',
    remainingForReward: 'بقيت {{points}} نقطة للحصول على «{{reward}}»',

    visitsRemaining: {
      one: 'زيارة واحدة إضافية و«{{reward}}» هدية لك',
      two: 'زيارتان إضافيتان و«{{reward}}» هدية لك',
      few: '{{count}} زيارات إضافية للحصول على «{{reward}}» هدية',
      many: '{{count}} زيارة إضافية للحصول على «{{reward}}» هدية',
      other: '{{count}} زيارة إضافية للحصول على «{{reward}}» هدية',
    },

    myRewards: 'مكافآتي',
    myRewardsEmpty: 'مكافآتك المحصّلة والمستعملة',
    myRewardsPending: {
      one: 'مكافأة واحدة لتقديمها في المعهد',
      two: 'مكافأتان لتقديمهما في المعهد',
      few: '{{count}} مكافآت لتقديمها في المعهد',
      many: '{{count}} مكافأة لتقديمها في المعهد',
      other: '{{count}} مكافأة لتقديمها في المعهد',
    },
    myRewardsA11y: {
      one: 'مكافآتي، واحدة لتقديمها',
      two: 'مكافآتي، اثنتان لتقديمهما',
      few: 'مكافآتي، {{count}} لتقديمها',
      many: 'مكافآتي، {{count}} لتقديمها',
      other: 'مكافآتي، {{count}} لتقديمها',
    },

    grantsTitle: 'هدية لك',
    grantUnlockedAt: {
      one: 'مُنحت بعد زيارة واحدة',
      two: 'مُنحت بعد زيارتين',
      few: 'مُنحت بعد {{count}} زيارات',
      many: 'مُنحت بعد {{count}} زيارة',
      other: 'مُنحت بعد {{count}} زيارة',
    },
    claim: 'استلام',
    claimA11y: 'استلام {{reward}}',
    claimTitle: 'مكافأة مهداة',
    claimMessage: 'هل تستلمين «{{reward}}»؟ ثم قدّميها في المعهد.',
    claimedTitle: 'تم استلام المكافأة',
    claimFailed: 'تعذّر الاستلام.',

    rewardsTitle: 'المكافآت',
    rewardsEmpty: 'لا توجد مكافآت متاحة.',
    rewardA11y: '{{reward}}، {{points}} نقطة',
    rewardA11yMissing: '{{reward}}، {{cost}} نقطة، تنقصك {{missing}} نقطة',
    missingPoints: 'تنقصك {{points}} نقطة',

    redeemTitle: 'استبدال',
    redeemMessage: 'هل تستبدلين «{{reward}}» مقابل {{points}} نقطة؟',
    redeemedTitle: 'تم استبدال المكافأة',
    redeemFailed: 'تعذّر الاستبدال.',

    voucherCode: 'رمزك: {{code}}. قدّميه في المعهد.',
    seeMyVoucher: 'عرض قسيمتي',

    historyTitle: 'السجل',
    historyEmpty: 'لا توجد عمليات.',
    offered: 'هدية',

    typeEarn: 'نقاط مكتسبة',
    typeRedeem: 'مكافأة مستبدلة',
    typeManual: 'إضافة يدوية',
    typeMilestone: 'مكافأة مهداة',
  },
};
