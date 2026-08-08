// Contenu des emails transactionnels.
//
// Chaque gabarit renvoie une version texte ET une version HTML. Le texte n'est
// pas un reliquat : un email sans partie texte est noté comme suspect par les
// filtres anti-spam, et c'est cette version que lisent les montres connectées
// et les aperçus de notification.

export interface MailContent {
  subject: string;
  text: string;
  html: string;
}

interface CodeMailParams {
  code: string;
  expiresInMinutes: number;
  firstName?: string | null;
}

const BRAND = 'Institut Yani';

function greeting(firstName?: string | null): string {
  return firstName ? `Bonjour ${firstName},` : 'Bonjour,';
}

// Le code est affiché espacé (« 482 913 ») : à 6 chiffres collés, on se trompe
// en recopiant. L'espace est purement visuel, il est retiré à la saisie.
function spaced(code: string): string {
  return `${code.slice(0, 3)} ${code.slice(3)}`;
}

// Gabarit HTML commun. Tout est en style inline : les clients mail ignorent
// largement les feuilles de style, et Gmail supprime carrément les balises
// <style> dans certaines vues.
function layout(bodyHtml: string): string {
  return `<!doctype html>
<html lang="fr">
  <body style="margin:0;padding:24px;background:#faf7f5;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#2b2b2b;">
    <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px;">
      <p style="margin:0 0 24px;font-size:18px;font-weight:600;letter-spacing:0.5px;">${BRAND}</p>
      ${bodyHtml}
      <p style="margin:32px 0 0;font-size:12px;color:#8a8a8a;line-height:1.5;">
        Cet email vous a été envoyé automatiquement, merci de ne pas y répondre.
      </p>
    </div>
  </body>
</html>`;
}

function codeBlock(code: string): string {
  return `<p style="margin:0 0 24px;font-size:32px;font-weight:700;letter-spacing:6px;text-align:center;padding:16px;background:#faf7f5;border-radius:8px;">${spaced(
    code,
  )}</p>`;
}

export function verificationCodeMail({
  code,
  expiresInMinutes,
  firstName,
}: CodeMailParams): MailContent {
  return {
    subject: `${code} — votre code de confirmation ${BRAND}`,
    text: [
      greeting(firstName),
      '',
      `Voici votre code de confirmation : ${spaced(code)}`,
      '',
      `Saisissez-le dans l'application pour confirmer votre adresse email.`,
      `Ce code expire dans ${expiresInMinutes} minutes.`,
      '',
      `Si vous n'avez pas créé de compte chez nous, ignorez simplement ce message.`,
      '',
      BRAND,
    ].join('\n'),
    html: layout(`
      <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">${greeting(firstName)}</p>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">Voici votre code de confirmation :</p>
      ${codeBlock(code)}
      <p style="margin:0 0 8px;font-size:15px;line-height:1.6;">Saisissez-le dans l'application pour confirmer votre adresse email.</p>
      <p style="margin:0;font-size:14px;color:#6b6b6b;line-height:1.6;">Ce code expire dans ${expiresInMinutes} minutes. Si vous n'avez pas créé de compte chez nous, ignorez simplement ce message.</p>
    `),
  };
}

export function passwordResetCodeMail({
  code,
  expiresInMinutes,
  firstName,
}: CodeMailParams): MailContent {
  return {
    subject: `${code} — réinitialisation de votre mot de passe ${BRAND}`,
    text: [
      greeting(firstName),
      '',
      `Voici votre code de réinitialisation : ${spaced(code)}`,
      '',
      `Saisissez-le dans l'application pour choisir un nouveau mot de passe.`,
      `Ce code expire dans ${expiresInMinutes} minutes.`,
      '',
      `Si vous n'êtes pas à l'origine de cette demande, ignorez ce message :`,
      `votre mot de passe actuel reste valable et rien n'a été modifié.`,
      '',
      BRAND,
    ].join('\n'),
    html: layout(`
      <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">${greeting(firstName)}</p>
      <p style="margin:0 0 16px;font-size:15px;line-height:1.6;">Voici votre code de réinitialisation :</p>
      ${codeBlock(code)}
      <p style="margin:0 0 8px;font-size:15px;line-height:1.6;">Saisissez-le dans l'application pour choisir un nouveau mot de passe.</p>
      <p style="margin:0;font-size:14px;color:#6b6b6b;line-height:1.6;">Ce code expire dans ${expiresInMinutes} minutes. Si vous n'êtes pas à l'origine de cette demande, ignorez ce message : votre mot de passe actuel reste valable.</p>
    `),
  };
}
