import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import {
  MailContent,
  passwordResetCodeMail,
  verificationCodeMail,
} from './mail.templates';

// Deux modes d'envoi :
//
//  - console : rien ne part, le message est écrit dans les logs du serveur.
//    C'est le mode de développement — on déroule tout le parcours (inscription,
//    saisie du code, mot de passe oublié) sans dépendre d'un fournisseur ni
//    d'une boîte mail réelle.
//
//  - smtp : envoi réel via nodemailer.
//
// Changer de fournisseur (Gmail aujourd'hui, un domaine dédié demain) ne touche
// que le .env : aucune ligne de code à reprendre.
type MailDriver = 'console' | 'smtp';

@Injectable()
export class MailService implements OnModuleInit {
  private readonly logger = new Logger(MailService.name);
  private readonly driver: MailDriver;
  private readonly from: string;
  private transporter?: nodemailer.Transporter;

  constructor(private readonly config: ConfigService) {
    this.driver =
      (this.config.get<string>('MAIL_DRIVER') as MailDriver) ?? 'console';

    // Le nom est injecté entre guillemets dans un en-tête `From`. Un retour à
    // la ligne y couperait l'en-tête en deux et permettrait d'en ajouter
    // d'autres ; un guillemet fermerait la chaîne. Valeur de configuration
    // seulement — mais un fichier `.env` recopié de travers suffit à produire
    // un en-tête cassé, et l'échec serait silencieux.
    const fromName = this.echapperNom(
      this.config.get<string>('MAIL_FROM_NAME') ?? 'Institut Yani',
    );
    const fromAddress =
      this.config.get<string>('MAIL_FROM') ??
      this.config.get<string>('SMTP_USER') ??
      'no-reply@localhost';
    this.from = `"${fromName}" <${fromAddress}>`;
  }

  // Retire ce qui casserait l'en-tête : sauts de ligne, guillemets, antislashs.
  private echapperNom(nom: string): string {
    return nom.replace(/[\r\n"\\]/g, ' ').trim();
  }

  async onModuleInit() {
    if (this.driver !== 'smtp') {
      this.logger.log(
        "Envoi d'emails en mode console : les codes s'affichent ici, aucun message ne part.",
      );
      return;
    }

    const port = Number(this.config.get<string>('SMTP_PORT') ?? 587);

    this.transporter = nodemailer.createTransport({
      host: this.config.getOrThrow<string>('SMTP_HOST'),
      port,
      // 465 est le port TLS implicite ; 587 ouvre en clair puis passe en TLS
      // via STARTTLS. Se tromper de couple port/secure donne une connexion qui
      // pend jusqu'au timeout, sans message d'erreur exploitable.
      secure: port === 465,
      auth: {
        user: this.config.getOrThrow<string>('SMTP_USER'),
        pass: this.config.getOrThrow<string>('SMTP_PASSWORD'),
      },
    });

    // On teste la connexion au démarrage plutôt qu'à la première inscription.
    // Sans cela, un mot de passe d'application erroné ne se manifesterait que
    // le jour où une vraie cliente s'inscrit — et l'échec serait silencieux,
    // puisque `send` n'interrompt jamais la requête en cours (voir plus bas).
    try {
      await this.transporter.verify();
      this.logger.log(`Serveur SMTP joignable (${this.config.get('SMTP_HOST')}).`);
    } catch (error) {
      this.logger.error(
        `Connexion SMTP impossible : ${(error as Error).message}. ` +
          'Aucun email ne partira tant que la configuration SMTP_* ne sera pas corrigée.',
      );
    }
  }

  async sendVerificationCode(params: {
    to: string;
    code: string;
    expiresInMinutes: number;
    firstName?: string | null;
  }) {
    await this.send(params.to, verificationCodeMail(params));
  }

  async sendPasswordResetCode(params: {
    to: string;
    code: string;
    expiresInMinutes: number;
    firstName?: string | null;
  }) {
    await this.send(params.to, passwordResetCodeMail(params));
  }

  // Volontairement sans propagation d'erreur.
  //
  // Une panne du serveur SMTP ne doit pas faire échouer une inscription déjà
  // enregistrée en base : la cliente se retrouverait avec un compte créé mais
  // un écran d'erreur, sans savoir si elle doit recommencer. Elle peut demander
  // un nouveau code à tout moment. L'échec est tracé en logs pour être vu côté
  // serveur, et la vérification au démarrage attrape en amont le cas le plus
  // fréquent (mauvaise configuration).
  private async send(to: string, content: MailContent) {
    if (this.driver === 'console') {
      this.logger.log(
        `\n────────── EMAIL (mode console) ──────────\n` +
          `À      : ${to}\n` +
          `Sujet  : ${content.subject}\n\n` +
          `${content.text}\n` +
          `──────────────────────────────────────────`,
      );
      return;
    }

    try {
      await this.transporter!.sendMail({
        from: this.from,
        to,
        subject: content.subject,
        text: content.text,
        html: content.html,
      });
    } catch (error) {
      // L'adresse est journalisée : sans elle, impossible de savoir quelle
      // cliente rappeler quand elle signale n'avoir rien reçu.
      this.logger.error(
        `Échec de l'envoi à ${to} — ${(error as Error).message}`,
      );
    }
  }
}
