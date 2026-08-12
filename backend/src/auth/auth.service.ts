import {
  Injectable,
  BadRequestException,
  ConflictException,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { VerificationPurpose } from '@prisma/client';
import * as argon2 from 'argon2';
import { randomBytes, createHash } from 'crypto';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { MailService } from '../mail/mail.service';
import {
  CODE_TTL_MINUTES,
  VerificationCodeService,
} from './verification-code.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly mail: MailService,
    private readonly verificationCodes: VerificationCodeService,
  ) {}

  // ─────────────────────────────────────────
  //  Utilitaires refresh token
  // ─────────────────────────────────────────

  // Génère une chaîne aléatoire cryptographiquement sûre
  private generateRefreshToken(): string {
    return randomBytes(48).toString('hex');
  }

  // Hache le token (SHA-256 suffit : c'est un secret aléatoire, pas un mot de passe)
  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  // Crée et persiste un refresh token
  private async issueRefreshToken(userId: string, familyId: string) {
    const token = this.generateRefreshToken();
    const days = Number(
      this.config.get<string>('JWT_REFRESH_EXPIRES_IN_DAYS') ?? 14,
    );
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

    await this.prisma.refreshToken.create({
      data: {
        tokenHash: this.hashToken(token),
        userId,
        familyId,
        expiresAt,
      },
    });

    return token;
  }

  // ─────────────────────────────────────────
  //  Défense contre l'énumération par mesure du temps
  // ─────────────────────────────────────────

  // Hash de référence, calculé une seule fois au premier besoin, sur une
  // valeur aléatoire que personne ne connaît. Il ne protège rien : il sert
  // uniquement à faire travailler argon2 aussi longtemps qu'une vraie
  // vérification, pour qu'un email inconnu réponde au même rythme.
  private dummyHashPromise?: Promise<string>;

  private async burnPasswordComparison(candidate: string): Promise<void> {
    this.dummyHashPromise ??= argon2.hash(randomBytes(32).toString('hex'));
    const dummyHash = await this.dummyHashPromise;
    // Échoue toujours : seul le temps consommé nous intéresse.
    await argon2.verify(dummyHash, candidate).catch(() => false);
  }

  // Génère l'access token (JWT court)
  private async issueAccessToken(user: {
    id: string;
    email: string;
    role: string;
  }) {
    const payload = { sub: user.id, email: user.email, role: user.role };
    return this.jwtService.signAsync(payload);
  }

  // ─────────────────────────────────────────
  //  Inscription
  // ─────────────────────────────────────────

  // Renvoie les mêmes jetons que `login`, et pour une raison précise.
  //
  // L'app appelait `/auth/register` PUIS `/auth/login`. Entre les deux, il
  // existait une fenêtre où le compte était créé mais la session non : un
  // réseau qui lâche ou la limite de débit atteinte sur `login`, et la cliente
  // lisait « Inscription impossible » alors que son compte existait. Elle
  // recommençait, et se voyait répondre « Un compte existe déjà avec cet
  // email » — bloquée, sans rien comprendre.
  //
  // Émettre la session ici ferme la fenêtre : une inscription réussie est une
  // session ouverte, il n'y a plus de « entre les deux ». C'est aussi un
  // aller-retour et un jeton de rate limit économisés.
  async register(dto: RegisterDto) {
    const existing = await this.usersService.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException('Un compte existe déjà avec cet email.');
    }

    const passwordHash = await argon2.hash(dto.password);

    const user = await this.usersService.create({
      email: dto.email,
      passwordHash,
      firstName: dto.firstName,
      lastName: dto.lastName,
      phone: dto.phone,
    });

    // Le compte est utilisable immédiatement : la confirmation est demandée,
    // jamais imposée. Une cliente dont l'email tombe en spam doit pouvoir
    // réserver quand même — elle appellerait l'institut sinon, ce qui nous
    // ferait perdre le bénéfice de l'application.
    await this.issueVerificationCode(user);

    // Nouvelle session = nouvelle famille de tokens, comme à la connexion.
    const familyId = randomUUID();
    const accessToken = await this.issueAccessToken(user);
    const refreshToken = await this.issueRefreshToken(user.id, familyId);

    // Exactement la forme de `login`, à dessein : l'app traite les deux
    // réponses par le même chemin. Le profil, qui était auparavant à la racine
    // de la réponse, descend d'un cran sous `user` — seule l'app mobile
    // consomme cette route, et elle ignorait ce profil.
    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        role: user.role,
        emailVerifiedAt: user.emailVerifiedAt,
      },
    };
  }

  // ─────────────────────────────────────────
  //  Vérification de l'adresse email
  // ─────────────────────────────────────────

  // Émet un code et l'envoie. Ne fait rien si un code a déjà été envoyé il y a
  // moins d'une minute (délai anti-flood géré par VerificationCodeService).
  private async issueVerificationCode(user: {
    id: string;
    email: string;
    firstName: string | null;
  }) {
    const code = await this.verificationCodes.issue(
      user.id,
      VerificationPurpose.EMAIL_VERIFY,
    );
    if (!code) return;

    await this.mail.sendVerificationCode({
      to: user.email,
      code,
      expiresInMinutes: CODE_TTL_MINUTES,
      firstName: user.firstName,
    });
  }

  async verifyEmail(userId: string, code: string) {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new UnauthorizedException('Utilisateur introuvable.');
    }

    // Déjà confirmée : on répond succès sans consommer de code. Sinon, une
    // cliente qui appuie deux fois sur « Valider » verrait une erreur alors
    // que son adresse vient bien d'être confirmée.
    if (user.emailVerifiedAt) {
      return {
        message: 'Votre adresse email est déjà confirmée.',
        emailVerifiedAt: user.emailVerifiedAt,
      };
    }

    await this.verificationCodes.consume(
      userId,
      VerificationPurpose.EMAIL_VERIFY,
      code,
    );

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { emailVerifiedAt: new Date() },
    });

    return {
      message: 'Adresse email confirmée.',
      emailVerifiedAt: updated.emailVerifiedAt,
    };
  }

  async resendVerificationCode(userId: string) {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new UnauthorizedException('Utilisateur introuvable.');
    }

    if (user.emailVerifiedAt) {
      return { message: 'Votre adresse email est déjà confirmée.' };
    }

    await this.issueVerificationCode(user);

    // Message volontairement neutre : le délai anti-flood peut avoir empêché
    // l'envoi, mais le code précédent est alors toujours valable. Annoncer un
    // échec inquiéterait sans raison.
    return { message: 'Un code de confirmation vous a été envoyé par email.' };
  }

  // ─────────────────────────────────────────
  //  Mot de passe oublié
  // ─────────────────────────────────────────

  async forgotPassword(email: string) {
    const user = await this.usersService.findByEmail(email);

    // Un compte anonymisé ne reçoit plus rien : la réponse reste identique,
    // mais aucun code n'est émis pour une coquille sans propriétaire.
    if (user && !user.deletedAt) {
      const code = await this.verificationCodes.issue(
        user.id,
        VerificationPurpose.PASSWORD_RESET,
      );

      if (code) {
        // Envoi délibérément non attendu.
        //
        // Le message de réponse est déjà identique dans les deux cas, mais
        // attendre le serveur SMTP rendrait la réponse nettement plus lente
        // quand le compte existe (~500 ms contre ~5 ms). Ce seul écart suffit
        // à faire de cette route un test d'existence : on saurait qui est
        // cliente de l'institut. `send` n'échoue jamais, il journalise — il
        // n'y a donc pas de promesse rejetée à surveiller ici.
        void this.mail.sendPasswordResetCode({
          to: user.email,
          code,
          expiresInMinutes: CODE_TTL_MINUTES,
          firstName: user.firstName,
        });
      }
    }

    return {
      message:
        'Si un compte existe avec cette adresse, un code de réinitialisation vient d’être envoyé.',
    };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const user = await this.usersService.findByEmail(dto.email);

    // Compte inconnu OU anonymisé : exactement la même erreur qu'un code
    // erroné. Distinguer les trois transformerait cette route en annuaire de
    // nos clientes, anciennes comprises.
    if (!user || user.deletedAt) {
      throw new BadRequestException('Code invalide ou expiré.');
    }

    await this.verificationCodes.consume(
      user.id,
      VerificationPurpose.PASSWORD_RESET,
      dto.code,
    );

    const passwordHash = await argon2.hash(dto.newPassword);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: {
          passwordHash,
          // Recevoir ce code prouve l'accès à la boîte mail : autant en tirer
          // la confirmation d'adresse. Sans cela, une cliente jamais confirmée
          // resterait signalée comme telle après avoir pourtant fait la
          // démonstration qu'elle relève bien cette adresse.
          emailVerifiedAt: user.emailVerifiedAt ?? new Date(),
        },
      }),
      // Même raisonnement que pour le changement de mot de passe : si le compte
      // a été compromis, la reprise en main doit couper les sessions ouvertes
      // par l'intrus, sinon il reste connecté malgré le nouveau mot de passe.
      this.prisma.refreshToken.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    return {
      message:
        'Mot de passe réinitialisé. Vous pouvez maintenant vous connecter, et toutes vos sessions ouvertes ont été déconnectées.',
    };
  }

  // ─────────────────────────────────────────
  //  Profil complet de l'utilisateur connecté
  // ─────────────────────────────────────────

  async me(userId: string) {
    // Renvoie le profil complet (avec phone, prénom, nom) depuis la base,
    // et non le simple payload JWT qui ne contient que id/email/role.
    return this.usersService.getProfile(userId);
  }

  // ─────────────────────────────────────────
  //  Connexion : émet les deux tokens
  // ─────────────────────────────────────────

  async login(dto: LoginDto) {
    const user = await this.usersService.findByEmail(dto.email);
    // Compte inexistant OU anonymisé : strictement le même chemin. Un compte
    // supprimé a de toute façon vu son adresse remplacée, donc il ne sera pas
    // retrouvé ici — ce test est la seconde serrure, et il garantit surtout
    // qu'on ne distinguera jamais « jamais existé » de « a supprimé son
    // compte ». Le second révélerait qu'une adresse a fréquenté l'institut.
    if (!user || user.deletedAt) {
      // Hachage factice avant de refuser.
      //
      // Le message d'erreur est déjà identique dans les deux cas, mais le
      // TEMPS de réponse, lui, trahissait tout : email inconnu = réponse
      // immédiate (~5 ms), email connu = ~100 ms le temps qu'argon2 vérifie.
      // En comparant les délais, on pouvait donc déterminer qui est cliente
      // du centre. On paie ici le même coût pour égaliser les deux chemins.
      await this.burnPasswordComparison(dto.password);
      throw new UnauthorizedException('Email ou mot de passe incorrect.');
    }

    const passwordValid = await argon2.verify(user.passwordHash, dto.password);
    if (!passwordValid) {
      throw new UnauthorizedException('Email ou mot de passe incorrect.');
    }

    // Nouvelle session = nouvelle famille de tokens
    const familyId = randomUUID();

    const accessToken = await this.issueAccessToken(user);
    const refreshToken = await this.issueRefreshToken(user.id, familyId);

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        role: user.role,
        emailVerifiedAt: user.emailVerifiedAt,
      },
    };
  }

  // ─────────────────────────────────────────
  //  Refresh : rotation + détection de réutilisation
  // ─────────────────────────────────────────

  async refresh(presentedToken: string) {
    const tokenHash = this.hashToken(presentedToken);

    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    // Token inconnu
    if (!stored) {
      throw new UnauthorizedException('Refresh token invalide.');
    }

    // ⚠ Token déjà révoqué = réutilisation suspecte
    // On tue toute la famille : la session est compromise
    if (stored.revokedAt) {
      await this.prisma.refreshToken.updateMany({
        where: { familyId: stored.familyId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new ForbiddenException(
        'Refresh token déjà utilisé. Session révoquée pour sécurité.',
      );
    }

    // Token expiré
    if (stored.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException('Refresh token expiré.');
    }

    // Rotation : on révoque l'ancien, on en émet un nouveau (même famille)
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    const accessToken = await this.issueAccessToken(stored.user);
    const refreshToken = await this.issueRefreshToken(
      stored.userId,
      stored.familyId,
    );

    return { accessToken, refreshToken };
  }

  // ─────────────────────────────────────────
  //  Déconnexion : révoque le refresh token
  // ─────────────────────────────────────────

  async logout(presentedToken: string) {
    const tokenHash = this.hashToken(presentedToken);

    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
    });

    if (stored && !stored.revokedAt) {
      // On révoque toute la famille (déconnexion complète de cette session)
      await this.prisma.refreshToken.updateMany({
        where: { familyId: stored.familyId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }

    // On répond toujours OK, même si le token n'existe pas
    // (ne pas révéler si un token est valide ou non)
    return { message: 'Déconnecté.' };
  }
}
