// Contenu des emails transactionnels, en français, arabe et anglais.
//
// Chaque gabarit renvoie une version texte ET une version HTML. Le texte n'est
// pas un reliquat : un email sans partie texte est noté comme suspect par les
// filtres anti-spam, et c'est cette version que lisent les montres connectées
// et les aperçus de notification.
//
// La langue vient du champ `locale` de la cliente, enregistré à l'inscription
// et mis à jour quand elle change de langue dans l'application. Un compte créé
// avant l'ajout de ce champ vaut « fr », comme avant.

export interface MailContent {
  subject: string;
  text: string;
  html: string;
}

export type MailLanguage = 'fr' | 'ar' | 'en';

interface CodeMailParams {
  code: string;
  expiresInMinutes: number;
  firstName?: string | null;
  lang?: MailLanguage;
}

const BRAND = 'Institut Yani';

// Le code est affiché espacé (« 482 913 ») : à 6 chiffres collés, on se trompe
// en recopiant. L'espace est purement visuel, il est retiré à la saisie.
function spaced(code: string): string {
  return `${code.slice(0, 3)} ${code.slice(3)}`;
}

interface Textes {
  greeting: (nom: string | null | undefined) => string;
  footer: string;
  verifySubject: (code: string) => string;
  verifyIntro: string;
  verifyInstruction: string;
  verifyIgnore: string;
  resetSubject: (code: string) => string;
  resetIntro: string;
  resetInstruction: string;
  resetIgnore: string;
  expiry: (minutes: number) => string;
}

const TEXTES: Record<MailLanguage, Textes> = {
  fr: {
    greeting: (n) => (n ? `Bonjour ${n},` : 'Bonjour,'),
    footer: 'Cet email vous a été envoyé automatiquement, merci de ne pas y répondre.',
    verifySubject: (c) => `${c} — votre code de confirmation ${BRAND}`,
    verifyIntro: 'Voici votre code de confirmation :',
    verifyInstruction:
      "Saisissez-le dans l'application pour confirmer votre adresse email.",
    verifyIgnore:
      "Si vous n'avez pas créé de compte chez nous, ignorez simplement ce message.",
    resetSubject: (c) => `${c} — réinitialisation de votre mot de passe ${BRAND}`,
    resetIntro: 'Voici votre code de réinitialisation :',
    resetInstruction:
      "Saisissez-le dans l'application pour choisir un nouveau mot de passe.",
    resetIgnore:
      "Si vous n'êtes pas à l'origine de cette demande, ignorez ce message : votre mot de passe actuel reste valable et rien n'a été modifié.",
    expiry: (m) => `Ce code expire dans ${m} minutes.`,
  },

  ar: {
    greeting: (n) => (n ? `مرحبًا ${n}،` : 'مرحبًا،'),
    footer: 'أُرسلت هذه الرسالة آليًا، يُرجى عدم الردّ عليها.',
    verifySubject: (c) => `${c} — رمز التأكيد الخاص بك من ${BRAND}`,
    verifyIntro: 'إليك رمز التأكيد الخاص بك:',
    verifyInstruction: 'أدخليه في التطبيق لتأكيد بريدك الإلكتروني.',
    verifyIgnore: 'إذا لم تنشئي حسابًا لدينا، تجاهلي هذه الرسالة ببساطة.',
    resetSubject: (c) => `${c} — إعادة تعيين كلمة المرور من ${BRAND}`,
    resetIntro: 'إليك رمز إعادة التعيين:',
    resetInstruction: 'أدخليه في التطبيق لاختيار كلمة مرور جديدة.',
    resetIgnore:
      'إذا لم تكوني صاحبة هذا الطلب، تجاهلي هذه الرسالة: كلمة مرورك الحالية تبقى صالحة ولم يطرأ أيّ تغيير.',
    expiry: (m) => `تنتهي صلاحية هذا الرمز بعد ${m} دقيقة.`,
  },

  en: {
    greeting: (n) => (n ? `Hello ${n},` : 'Hello,'),
    footer: 'This email was sent automatically, please do not reply to it.',
    verifySubject: (c) => `${c} — your ${BRAND} confirmation code`,
    verifyIntro: 'Here is your confirmation code:',
    verifyInstruction: 'Enter it in the app to confirm your email address.',
    verifyIgnore:
      'If you did not create an account with us, simply ignore this message.',
    resetSubject: (c) => `${c} — reset your ${BRAND} password`,
    resetIntro: 'Here is your reset code:',
    resetInstruction: 'Enter it in the app to choose a new password.',
    resetIgnore:
      'If you did not request this, ignore this message: your current password remains valid and nothing has been changed.',
    expiry: (m) => `This code expires in ${m} minutes.`,
  },
};

// Gabarit HTML commun. Tout est en style inline : les clients mail ignorent
// largement les feuilles de style, et Gmail supprime carrément les balises
// <style> dans certaines vues.
//
// `lang` et `dir` sont posés sur <html> : sans `dir="rtl"`, un email arabe
// s'affiche aligné à gauche et la ponctuation se retrouve du mauvais côté.
function layout(bodyHtml: string, lang: MailLanguage): string {
  const rtl = lang === 'ar';
  const dir = rtl ? 'rtl' : 'ltr';
  const align = rtl ? 'right' : 'left';
  return `<!doctype html>
<html lang="${lang}" dir="${dir}">
  <body style="margin:0;padding:24px;background:#faf7f5;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#2b2b2b;direction:${dir};text-align:${align};">
    <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px;">
      <p style="margin:0 0 24px;font-size:18px;font-weight:600;letter-spacing:0.5px;">${BRAND}</p>
      ${bodyHtml}
      <p style="margin:32px 0 0;font-size:12px;color:#8a8a8a;line-height:1.5;">
        ${TEXTES[lang].footer}
      </p>
    </div>
  </body>
</html>`;
}

// Le bloc du code reste toujours de gauche à droite : six chiffres se lisent
// dans le même sens dans les trois langues.
function codeBlock(code: string): string {
  return `<p style="margin:0 0 24px;font-size:32px;font-weight:700;letter-spacing:6px;text-align:center;padding:16px;background:#faf7f5;border-radius:8px;direction:ltr;">${spaced(
    code,
  )}</p>`;
}

export function verificationCodeMail({
  code,
  expiresInMinutes,
  firstName,
  lang = 'fr',
}: CodeMailParams): MailContent {
  const T = TEXTES[lang];
  return {
    subject: T.verifySubject(code),
    text: [
      T.greeting(firstName),
      '',
      `${T.verifyIntro} ${spaced(code)}`,
      '',
      T.verifyInstruction,
      T.expiry(expiresInMinutes),
      '',
      T.verifyIgnore,
      '',
      BRAND,
    ].join('\n'),
    html: layout(
      `
      <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">${T.greeting(firstName)}</p>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">${T.verifyIntro}</p>
      ${codeBlock(code)}
      <p style="margin:0 0 8px;font-size:15px;line-height:1.6;">${T.verifyInstruction}</p>
      <p style="margin:0;font-size:14px;color:#6b6b6b;line-height:1.6;">${T.expiry(expiresInMinutes)} ${T.verifyIgnore}</p>
    `,
      lang,
    ),
  };
}

export function passwordResetCodeMail({
  code,
  expiresInMinutes,
  firstName,
  lang = 'fr',
}: CodeMailParams): MailContent {
  const T = TEXTES[lang];
  return {
    subject: T.resetSubject(code),
    text: [
      T.greeting(firstName),
      '',
      `${T.resetIntro} ${spaced(code)}`,
      '',
      T.resetInstruction,
      T.expiry(expiresInMinutes),
      '',
      T.resetIgnore,
      '',
      BRAND,
    ].join('\n'),
    html: layout(
      `
      <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">${T.greeting(firstName)}</p>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">${T.resetIntro}</p>
      ${codeBlock(code)}
      <p style="margin:0 0 8px;font-size:15px;line-height:1.6;">${T.resetInstruction}</p>
      <p style="margin:0;font-size:14px;color:#6b6b6b;line-height:1.6;">${T.expiry(expiresInMinutes)} ${T.resetIgnore}</p>
    `,
      lang,
    ),
  };
}
