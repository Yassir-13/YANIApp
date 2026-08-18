// Traduction des messages que l'API renvoie à l'application mobile.
//
// ── Pourquoi le message FRANÇAIS sert de clé ─────────────────────────────
//
// Les services lèvent leurs exceptions en français depuis toujours
// (`throw new NotFoundException('Utilisateur introuvable.')`). Remplacer ces
// 78 littéraux par des identifiants aurait rendu le code métier illisible et
// cassé des tests, pour un gain nul : la phrase française est déjà une clé
// unique et stable.
//
// La contrepartie est réelle : reformuler un message sans toucher à ce
// fichier lui ferait perdre sa traduction, en silence. C'est pourquoi
// `scripts/i18n-manquants.js` recense les messages levés qui n'ont pas
// d'entrée ici. Tant qu'il ne sort rien, la couverture est complète.
//
// Le back-office n'envoie aucun en-tête `Accept-Language` : il continue donc
// de recevoir le français, sans une seule modification de son côté.

export type ServerLanguage = 'fr' | 'ar' | 'en';

export const MESSAGES: Record<string, { ar: string; en: string }> = {
  // ── Authentification ───────────────────────────────────────────────────
  'Email ou mot de passe incorrect.': {
    ar: 'البريد الإلكتروني أو كلمة المرور غير صحيحة.',
    en: 'Incorrect email or password.',
  },
  'Un compte existe déjà avec cet email.': {
    ar: 'يوجد حساب مسجّل بهذا البريد الإلكتروني.',
    en: 'An account already exists with this email.',
  },
  'Mot de passe actuel incorrect.': {
    ar: 'كلمة المرور الحالية غير صحيحة.',
    en: 'Current password is incorrect.',
  },
  'Code invalide ou expiré.': {
    ar: 'رمز غير صالح أو منتهي الصلاحية.',
    en: 'Invalid or expired code.',
  },
  'Ce code a expiré. Demandez-en un nouveau.': {
    ar: 'انتهت صلاحية هذا الرمز. اطلبي رمزًا جديدًا.',
    en: 'This code has expired. Please request a new one.',
  },
  'Refresh token invalide.': {
    ar: 'رمز التجديد غير صالح.',
    en: 'Invalid refresh token.',
  },
  'Refresh token expiré.': {
    ar: 'انتهت صلاحية رمز التجديد.',
    en: 'Refresh token expired.',
  },

  // ── Éléments introuvables ──────────────────────────────────────────────
  'Utilisateur introuvable.': { ar: 'المستخدم غير موجود.', en: 'User not found.' },
  'Client introuvable.': { ar: 'العميلة غير موجودة.', en: 'Client not found.' },
  'Service introuvable.': { ar: 'الخدمة غير موجودة.', en: 'Service not found.' },
  'Service introuvable ou indisponible.': {
    ar: 'الخدمة غير موجودة أو غير متاحة.',
    en: 'Service not found or unavailable.',
  },
  'Produit introuvable.': { ar: 'المنتج غير موجود.', en: 'Product not found.' },
  'Catégorie introuvable.': { ar: 'الفئة غير موجودة.', en: 'Category not found.' },
  'Commande introuvable.': { ar: 'الطلب غير موجود.', en: 'Order not found.' },
  'Rendez-vous introuvable.': { ar: 'الموعد غير موجود.', en: 'Appointment not found.' },
  'Récompense introuvable.': { ar: 'المكافأة غير موجودة.', en: 'Reward not found.' },
  'Récompense introuvable ou indisponible.': {
    ar: 'المكافأة غير موجودة أو غير متاحة.',
    en: 'Reward not found or unavailable.',
  },
  'Compte fidélité introuvable.': {
    ar: 'حساب الولاء غير موجود.',
    en: 'Loyalty account not found.',
  },
  'Palier introuvable.': { ar: 'المستوى غير موجود.', en: 'Milestone not found.' },
  'Bon introuvable.': { ar: 'القسيمة غير موجودة.', en: 'Voucher not found.' },
  'Fermeture introuvable.': { ar: 'الإغلاق غير موجود.', en: 'Closure not found.' },
  'Élément introuvable.': { ar: 'العنصر غير موجود.', en: 'Item not found.' },

  // ── Réservation ────────────────────────────────────────────────────────
  'Le centre est fermé ce jour-là.': {
    ar: 'المعهد مغلق في هذا اليوم.',
    en: 'The salon is closed that day.',
  },
  'Ce créneau est complet.': {
    ar: 'هذا الموعد محجوز بالكامل.',
    en: 'This slot is full.',
  },
  'Impossible de réserver dans le passé.': {
    ar: 'لا يمكن الحجز في وقت مضى.',
    en: 'You cannot book a time in the past.',
  },
  'Ce rendez-vous ne vous appartient pas.': {
    ar: 'هذا الموعد لا يخصّك.',
    en: 'This appointment is not yours.',
  },

  // ── Fidélité ───────────────────────────────────────────────────────────
  'Ce bon a déjà été remis.': {
    ar: 'سبق أن سُلّمت هذه القسيمة.',
    en: 'This voucher has already been redeemed.',
  },

  // ── Validation des champs ──────────────────────────────────────────────
  'Adresse email invalide.': {
    ar: 'البريد الإلكتروني غير صالح.',
    en: 'Invalid email address.',
  },
  'Le mot de passe est obligatoire.': {
    ar: 'كلمة المرور إلزامية.',
    en: 'Password is required.',
  },
  'Le mot de passe doit contenir au moins une majuscule.': {
    ar: 'يجب أن تتضمّن كلمة المرور حرفًا لاتينيًا كبيرًا على الأقل.',
    en: 'Password must contain at least one uppercase letter.',
  },
  'Le mot de passe doit contenir au moins une minuscule.': {
    ar: 'يجب أن تتضمّن كلمة المرور حرفًا لاتينيًا صغيرًا على الأقل.',
    en: 'Password must contain at least one lowercase letter.',
  },
  'Le code est obligatoire.': { ar: 'الرمز إلزامي.', en: 'The code is required.' },
  'Le prénom est obligatoire.': {
    ar: 'الاسم الشخصي إلزامي.',
    en: 'First name is required.',
  },
  'Le prénom ne peut pas être vide.': {
    ar: 'لا يمكن ترك الاسم الشخصي فارغًا.',
    en: 'First name cannot be empty.',
  },
  'Le prénom ne doit pas dépasser 50 caractères.': {
    ar: 'يجب ألّا يتجاوز الاسم الشخصي 50 حرفًا.',
    en: 'First name must not exceed 50 characters.',
  },
  'Le nom est obligatoire.': {
    ar: 'الاسم العائلي إلزامي.',
    en: 'Last name is required.',
  },
  'Le nom ne peut pas être vide.': {
    ar: 'لا يمكن ترك الاسم العائلي فارغًا.',
    en: 'Last name cannot be empty.',
  },
  'Le nom ne doit pas dépasser 50 caractères.': {
    ar: 'يجب ألّا يتجاوز الاسم العائلي 50 حرفًا.',
    en: 'Last name must not exceed 50 characters.',
  },
  'locale doit valoir fr, ar ou en.': {
    ar: 'يجب أن تكون قيمة locale إحدى: fr أو ar أو en.',
    en: 'locale must be fr, ar or en.',
  },
  'Le numéro de téléphone est obligatoire.': {
    ar: 'رقم الهاتف إلزامي.',
    en: 'Phone number is required.',
  },

  // ── Commande ───────────────────────────────────────────────────────────
  'La commande doit contenir au moins un article.': {
    ar: 'يجب أن يتضمّن الطلب منتجًا واحدًا على الأقل.',
    en: 'The order must contain at least one item.',
  },
  'La quantité doit être au moins 1.': {
    ar: 'يجب أن تكون الكمية 1 على الأقل.',
    en: 'Quantity must be at least 1.',
  },
  'Quantité maximale : 99 par article.': {
    ar: 'الكمية القصوى: 99 لكلّ منتج.',
    en: 'Maximum quantity: 99 per item.',
  },
  'Cinquante articles différents au maximum.': {
    ar: 'خمسون منتجًا مختلفًا كحدّ أقصى.',
    en: 'Fifty different items at most.',
  },

  // ── Erreurs techniques exposées à la cliente ───────────────────────────
  'Cette valeur est déjà utilisée.': {
    ar: 'هذه القيمة مستعملة بالفعل.',
    en: 'This value is already in use.',
  },
  'Référence invalide : un élément lié est introuvable.': {
    ar: 'مرجع غير صالح: عنصر مرتبط غير موجود.',
    en: 'Invalid reference: a linked item was not found.',
  },
  'Une valeur dépasse la longueur autorisée.': {
    ar: 'إحدى القيم تتجاوز الطول المسموح به.',
    en: 'A value exceeds the allowed length.',
  },
  'Requête invalide.': { ar: 'طلب غير صالح.', en: 'Invalid request.' },
  'Une erreur interne est survenue.': {
    ar: 'حدث خطأ داخلي.',
    en: 'An internal error occurred.',
  },
  'Service temporairement indisponible. Réessayez dans un instant.': {
    ar: 'الخدمة غير متاحة مؤقتًا. أعيدي المحاولة بعد لحظات.',
    en: 'Service temporarily unavailable. Please try again shortly.',
  },

  // ── Réponses de succès ─────────────────────────────────────────────────
  // Renvoyées par un 200, pas par une exception : elles passent donc par
  // l'intercepteur (`common/interceptors/translate-response.interceptor.ts`)
  // et non par le filtre. L'application mobile les affiche telles quelles —
  // celle du changement de mot de passe, notamment, dit à la cliente que ses
  // autres appareils ont été déconnectés.
  'Adresse email confirmée.': {
    ar: 'تمّ تأكيد البريد الإلكتروني.',
    en: 'Email address confirmed.',
  },
  'Votre adresse email est déjà confirmée.': {
    ar: 'بريدك الإلكتروني مؤكَّد بالفعل.',
    en: 'Your email address is already confirmed.',
  },
  'Un code de confirmation vous a été envoyé par email.': {
    ar: 'أُرسل إليك رمز تأكيد عبر البريد الإلكتروني.',
    en: 'A confirmation code has been sent to your email.',
  },
  'Si un compte existe avec cette adresse, un code de réinitialisation vient d’être envoyé.': {
    ar: 'إذا كان هناك حساب مرتبط بهذا العنوان، فقد أُرسل إليه رمز لإعادة التعيين.',
    en: 'If an account exists for this address, a reset code has just been sent.',
  },
  'Mot de passe réinitialisé. Vous pouvez maintenant vous connecter, et toutes vos sessions ouvertes ont été déconnectées.': {
    ar: 'تمّت إعادة تعيين كلمة المرور. يمكنك الآن تسجيل الدخول، وقد أُنهيت جميع جلساتك المفتوحة.',
    en: 'Password reset. You can now sign in, and all your open sessions have been signed out.',
  },
  'Mot de passe modifié. Toutes vos sessions ont été déconnectées, y compris sur vos autres appareils.': {
    ar: 'تمّ تغيير كلمة المرور. أُنهيت جميع جلساتك، بما فيها تلك المفتوحة على أجهزتك الأخرى.',
    en: 'Password changed. All your sessions have been signed out, including on your other devices.',
  },
  'Déconnecté.': { ar: 'تمّ تسجيل الخروج.', en: 'Signed out.' },
  'Compte supprimé.': { ar: 'تمّ حذف الحساب.', en: 'Account deleted.' },

  // ── Conflits et états incompatibles ────────────────────────────────────
  'Un rendez-vous terminé ou annulé ne peut pas être reprogrammé.': {
    ar: 'لا يمكن إعادة جدولة موعد منتهٍ أو ملغى.',
    en: 'A completed or cancelled appointment cannot be rescheduled.',
  },
  'Refresh token déjà utilisé. Session révoquée pour sécurité.': {
    ar: 'رمز التجديد مستعمل من قبل. أُلغيت الجلسة حفاظًا على الأمان.',
    en: 'Refresh token already used. Session revoked for security.',
  },
  'Trop de tentatives sur ce code. Demandez-en un nouveau.': {
    ar: 'محاولات كثيرة على هذا الرمز. اطلبي رمزًا جديدًا.',
    en: 'Too many attempts on this code. Please request a new one.',
  },
  'Cette récompense a déjà été réclamée.': {
    ar: 'سبق أن استُلمت هذه المكافأة.',
    en: 'This reward has already been claimed.',
  },
  'Solde insuffisant : vos points ont changé entre-temps. Rechargez la page.': {
    ar: 'الرصيد غير كافٍ: تغيّرت نقاطك في هذه الأثناء. أعيدي تحميل الصفحة.',
    en: 'Not enough points: your balance changed in the meantime. Please refresh.',
  },
  'Cette commande a changé de statut entre-temps. Rechargez la page.': {
    ar: 'تغيّرت حالة هذا الطلب في هذه الأثناء. أعيدي تحميل الصفحة.',
    en: 'This order changed status in the meantime. Please refresh.',
  },
  'Une adresse est requise pour la livraison.': {
    ar: 'العنوان مطلوب للتوصيل.',
    en: 'An address is required for delivery.',
  },
  'Un ou plusieurs produits sont introuvables ou indisponibles.': {
    ar: 'منتج واحد أو أكثر غير موجود أو غير متاح.',
    en: 'One or more products are missing or unavailable.',
  },
  'Le numéro doit être un numéro marocain valide (ex. 0612345678 ou +212612345678).': {
    ar: 'يجب أن يكون الرقم مغربيًا صحيحًا (مثال: 0612345678 أو +212612345678).',
    en: 'The number must be a valid Moroccan phone number (e.g. 0612345678 or +212612345678).',
  },

  // ── Réservé au back-office (suite) ─────────────────────────────────────
  'Le premier jour de fermeture doit précéder le dernier.': {
    ar: 'يجب أن يسبق أوّل يوم إغلاق آخِرَه.',
    en: 'The first day of closure must come before the last.',
  },
  'Un compte administrateur ne peut pas être supprimé ainsi.': {
    ar: 'لا يمكن حذف حساب مسؤول بهذه الطريقة.',
    en: 'An administrator account cannot be deleted this way.',
  },
  'Un administrateur existe déjà. Rétrogradez-le avant de promouvoir un nouveau gérant.': {
    ar: 'يوجد مسؤول بالفعل. أنزلي رتبته قبل ترقية مسؤول جديد.',
    en: 'An administrator already exists. Demote them before promoting a new manager.',
  },
  'Impossible de rétrograder le seul administrateur du centre.': {
    ar: 'لا يمكن إنزال رتبة المسؤول الوحيد للمعهد.',
    en: 'You cannot demote the only administrator of the salon.',
  },

  // ── Réservé au back-office ─────────────────────────────────────────────
  // Traduits par souci de complétude : le back-office n'envoie pas
  // d'`Accept-Language`, une cliente ne verra donc jamais ces messages.
  'Le centre doit avoir au moins une cabine réservable.': {
    ar: 'يجب أن يتوفّر المعهد على مقصورة واحدة قابلة للحجز على الأقل.',
    en: 'The salon must have at least one bookable room.',
  },
  'Six plages par jour au maximum.': {
    ar: 'ستّ فترات في اليوم كحدّ أقصى.',
    en: 'Six time ranges per day at most.',
  },
  'date doit être au format AAAA-MM-JJ.': {
    ar: 'يجب أن يكون التاريخ بصيغة سنة-شهر-يوم.',
    en: 'date must use the YYYY-MM-DD format.',
  },
  'date doit être un jour réel.': {
    ar: 'يجب أن يكون التاريخ يومًا حقيقيًا.',
    en: 'date must be a real day.',
  },
  'startDate doit être une date au format AAAA-MM-JJ.': {
    ar: 'يجب أن يكون startDate بصيغة سنة-شهر-يوم.',
    en: 'startDate must use the YYYY-MM-DD format.',
  },
  'endDate doit être une date au format AAAA-MM-JJ.': {
    ar: 'يجب أن يكون endDate بصيغة سنة-شهر-يوم.',
    en: 'endDate must use the YYYY-MM-DD format.',
  },
  'startTime doit être au format HH:MM (ex : 09:00).': {
    ar: 'يجب أن يكون startTime بصيغة ساعة:دقيقة (مثال: 09:00).',
    en: 'startTime must use the HH:MM format (e.g. 09:00).',
  },
  'endTime doit être au format HH:MM (ex : 12:00).': {
    ar: 'يجب أن يكون endTime بصيغة ساعة:دقيقة (مثال: 12:00).',
    en: 'endTime must use the HH:MM format (e.g. 12:00).',
  },
  'serviceId doit être un identifiant valide.': {
    ar: 'يجب أن يكون serviceId معرّفًا صالحًا.',
    en: 'serviceId must be a valid identifier.',
  },
  'role doit valoir CLIENT, STAFF ou ADMIN.': {
    ar: 'يجب أن تكون قيمة role إحدى: CLIENT أو STAFF أو ADMIN.',
    en: 'role must be CLIENT, STAFF or ADMIN.',
  },
  'page doit être un entier.': {
    ar: 'يجب أن تكون page عددًا صحيحًا.',
    en: 'page must be an integer.',
  },
  'page commence à 1.': { ar: 'تبدأ page من 1.', en: 'page starts at 1.' },
  'limit doit être un entier.': {
    ar: 'يجب أن تكون limit عددًا صحيحًا.',
    en: 'limit must be an integer.',
  },
  'limit vaut au minimum 1.': {
    ar: 'أدنى قيمة لـ limit هي 1.',
    en: 'limit is at least 1.',
  },
};

// ── Messages construits à l'exécution ────────────────────────────────────
//
// Un seul cas dans tout le backend : la rupture de stock, dont le message
// nomme les produits concernés. Les noms viennent de la base — ils restent
// tels que le serveur les a écrits ; seule l'ossature de la phrase se traduit.
export const PATTERNS: {
  re: RegExp;
  ar: (m: RegExpMatchArray) => string;
  en: (m: RegExpMatchArray) => string;
}[] = [

  // ── Validation des champs, bornes venues de constantes ─────────────────
  {
    re: /^Le mot de passe doit faire au moins (\d+) caractères\.$/,
    ar: (m) => `يجب أن تتكوّن كلمة المرور من ${m[1]} خانات على الأقل.`,
    en: (m) => `Password must be at least ${m[1]} characters long.`,
  },
  {
    re: /^Le mot de passe ne doit pas dépasser (\d+) caractères\.$/,
    ar: (m) => `يجب ألّا تتجاوز كلمة المرور ${m[1]} خانة.`,
    en: (m) => `Password must not exceed ${m[1]} characters.`,
  },
  {
    re: /^Le code doit contenir (\d+) chiffres\.$/,
    ar: (m) => `يجب أن يتكوّن الرمز من ${m[1]} أرقام.`,
    en: (m) => `The code must contain ${m[1]} digits.`,
  },

  // ── Fidélité ───────────────────────────────────────────────────────────
  {
    re: /^Solde insuffisant\. Il vous manque (\d+) point\(s\)\.$/,
    ar: (m) => `الرصيد غير كافٍ. تنقصك ${m[1]} نقطة.`,
    en: (m) => `Not enough points. You need ${m[1]} more.`,
  },
  {
    re: /^Récompense « (.+) » réclamée\. Présentez le code (.+) à l'institut\.$/,
    ar: (m) => `تمّ استلام مكافأة «${m[1]}». قدّمي الرمز ${m[2]} في المعهد.`,
    en: (m) => `Reward “${m[1]}” claimed. Show the code ${m[2]} at the salon.`,
  },
  {
    re: /^Récompense « (.+) » échangée\. Présentez le code (.+) à l'institut\.$/,
    ar: (m) => `تمّ استبدال مكافأة «${m[1]}». قدّمي الرمز ${m[2]} في المعهد.`,
    en: (m) => `Reward “${m[1]}” redeemed. Show the code ${m[2]} at the salon.`,
  },
  {
    re: /^« (.+) » remise\.$/,
    ar: (m) => `تمّ تسليم «${m[1]}».`,
    en: (m) => `“${m[1]}” handed over.`,
  },
  {
    re: /^(-?\d+) point\(s\) ajouté\(s\) manuellement\.$/,
    ar: (m) => `تمّت إضافة ${m[1]} نقطة يدويًا.`,
    en: (m) => `${m[1]} point(s) added manually.`,
  },
  {
    re: /^Un palier doit valoir au moins (\d+) visites\.$/,
    ar: (m) => `يجب أن يساوي المستوى ${m[1]} زيارات على الأقل.`,
    en: (m) => `A milestone must be at least ${m[1]} visits.`,
  },
  {
    re: /^Un palier ne peut dépasser (\d+) visites\.$/,
    ar: (m) => `لا يمكن أن يتجاوز المستوى ${m[1]} زيارة.`,
    en: (m) => `A milestone cannot exceed ${m[1]} visits.`,
  },
  {
    re: /^Un ajout manuel ne peut dépasser (\d+) points\.$/,
    ar: (m) => `لا يمكن أن تتجاوز الإضافة اليدوية ${m[1]} نقطة.`,
    en: (m) => `A manual adjustment cannot exceed ${m[1]} points.`,
  },
  {
    re: /^Le motif ne doit pas dépasser (\d+) caractères\.$/,
    ar: (m) => `يجب ألّا يتجاوز السبب ${m[1]} حرفًا.`,
    en: (m) => `The reason must not exceed ${m[1]} characters.`,
  },

  // ── Rendez-vous et commandes ───────────────────────────────────────────
  {
    re: /^Le créneau doit tenir dans une plage d'ouverture : (.+) \(heure locale\)\.$/,
    ar: (m) => `يجب أن يقع الموعد ضمن أوقات العمل: ${m[1]} (بالتوقيت المحلي).`,
    en: (m) => `The slot must fall within opening hours: ${m[1]} (local time).`,
  },
  {
    re: /^Transition impossible de (.+) vers (.+)\.$/,
    ar: (m) => `لا يمكن الانتقال من ${m[1]} إلى ${m[2]}.`,
    en: (m) => `Cannot move from ${m[1]} to ${m[2]}.`,
  },
  {
    re: /^Produit indisponible dans la commande \((.+)\)\.$/,
    ar: (m) => `منتج غير متاح في الطلب (${m[1]}).`,
    en: (m) => `Unavailable product in the order (${m[1]}).`,
  },

  // ── Réservé au back-office ─────────────────────────────────────────────
  {
    re: /^Plage (.+)–(.+) : le début doit précéder la fin\.$/,
    ar: (m) => `الفترة ${m[1]}–${m[2]}: يجب أن تسبق البداية النهاية.`,
    en: (m) => `Range ${m[1]}–${m[2]}: the start must come before the end.`,
  },
  {
    re: /^Les plages (.+)–(.+) et (.+)–(.+) se chevauchent\.$/,
    ar: (m) => `الفترتان ${m[1]}–${m[2]} و ${m[3]}–${m[4]} متداخلتان.`,
    en: (m) => `Ranges ${m[1]}–${m[2]} and ${m[3]}–${m[4]} overlap.`,
  },
  {
    re: /^L'écart entre créneaux doit valoir (.+) minutes\.$/,
    ar: (m) => `يجب أن يكون الفاصل بين المواعيد ${m[1]} دقيقة.`,
    en: (m) => `The gap between slots must be ${m[1]} minutes.`,
  },
  {
    re: /^filter doit valoir (.+)\.$/,
    ar: (m) => `يجب أن تكون قيمة filter إحدى: ${m[1]}.`,
    en: (m) => `filter must be one of: ${m[1]}.`,
  },
  {
    re: /^status doit valoir (.+)\.$/,
    ar: (m) => `يجب أن تكون قيمة status إحدى: ${m[1]}.`,
    en: (m) => `status must be one of: ${m[1]}.`,
  },
  {
    re: /^limit ne peut dépasser (\d+)\.$/,
    ar: (m) => `لا يمكن أن تتجاوز limit القيمة ${m[1]}.`,
    en: (m) => `limit cannot exceed ${m[1]}.`,
  },
  {
    re: /^Stock insuffisant pour (.+)\.$/,
    ar: (m) => `المخزون غير كافٍ لـ ${m[1]}.`,
    en: (m) => `Not enough stock for ${m[1]}.`,
  },
];

// Fragments internes au message de stock : ils se répètent autant de fois
// qu'il y a de produits en rupture, donc ils se traduisent à part.
export const FRAGMENTS: { re: RegExp; ar: string; en: string }[] = [
  { re: /\(épuisé\)/g, ar: '(نفد)', en: '(out of stock)' },
  {
    re: /\(reste (\d+), demandé (\d+)\)/g,
    ar: '(المتبقّي $1، المطلوب $2)',
    en: '(remaining $1, requested $2)',
  },
];
