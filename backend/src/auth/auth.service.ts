import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { randomBytes, createHash } from 'crypto';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
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
    const days = Number(this.config.get<string>('JWT_REFRESH_EXPIRES_IN_DAYS') ?? 14);
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
  private async issueAccessToken(user: { id: string; email: string; role: string }) {
    const payload = { sub: user.id, email: user.email, role: user.role };
    return this.jwtService.signAsync(payload);
  }

  // ─────────────────────────────────────────
  //  Inscription
  // ─────────────────────────────────────────

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

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      role: user.role,
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
    if (!user) {
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