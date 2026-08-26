import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, User, Role } from '@prisma/client';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { FindUsersQueryDto } from './dto/find-users-query.dto';
import { Paginated } from '../common/dto/pagination-query.dto';

// Champs sûrs à exposer (jamais le passwordHash)
const SAFE_USER_SELECT = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  phone: true,
  role: true,
  createdAt: true,
  emailVerifiedAt: true,
} satisfies Prisma.UserSelect;

// Forme exacte d'un utilisateur exposé, dérivée du select ci-dessus :
// ajouter un champ sensible au select ferait échouer la compilation ailleurs
// plutôt que de le laisser fuiter silencieusement.
type SafeUser = Prisma.UserGetPayload<{ select: typeof SAFE_USER_SELECT }>;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async create(data: {
    email: string;
    passwordHash: string;
    firstName?: string;
    lastName?: string;
    phone?: string;
    locale?: string;
  }): Promise<User> {
    return this.prisma.user.create({
      data: {
        email: data.email,
        passwordHash: data.passwordHash,
        firstName: data.firstName,
        lastName: data.lastName,
        // Omise, la colonne prend son défaut « fr » : un client qui ne
        // transmet pas de langue se comporte exactement comme avant.
        ...(data.locale ? { locale: data.locale } : {}),
        phone: data.phone,
        loyaltyAccount: { create: {} },
      },
    });
  }

  // ----- PROFIL (client) -----

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: SAFE_USER_SELECT,
    });
    if (!user) {
      throw new NotFoundException('Utilisateur introuvable.');
    }
    return user;
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    return this.prisma.user.update({
      where: { id: userId },
      data: dto,
      select: SAFE_USER_SELECT,
    });
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('Utilisateur introuvable.');
    }

    // Vérifie l'ancien mot de passe avant d'autoriser le changement
    const valid = await argon2.verify(user.passwordHash, dto.currentPassword);
    if (!valid) {
      throw new UnauthorizedException('Mot de passe actuel incorrect.');
    }

    const passwordHash = await argon2.hash(dto.newPassword);

    // Changer son mot de passe DOIT couper les sessions existantes.
    // Sans cette révocation, une session volée survivait au changement :
    // la victime faisait le geste attendu (changer son mot de passe) et
    // l'attaquant restait connecté jusqu'à l'expiration du refresh token.
    //
    // Les deux écritures sont atomiques : jamais de mot de passe changé
    // sans révocation, ni l'inverse.
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { passwordHash },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    return {
      message:
        'Mot de passe modifié. Toutes vos sessions ont été déconnectées, y compris sur vos autres appareils.',
    };
  }

  // Suppression de compte (droit à l'effacement — CNDP)
  //
  // ANONYMISATION, et non suppression de la ligne.
  //
  // La version précédente faisait `user.delete()` en s'appuyant sur des
  // cascades. Elle marchait, mais elle emportait avec la cliente ses commandes
  // et ses rendez-vous — c'est-à-dire le chiffre d'affaires de l'institut.
  // Supprimer dix clientes fidèles aurait effacé dix historiques de vente, sans
  // que rien ne le signale.
  //
  // On garde donc une coquille anonyme : la ligne `users` survit pour que
  // l'historique reste rattaché à quelque chose, mais tout ce qui désigne la
  // personne est effacé. Les contraintes en base (commandes et rendez-vous en
  // ON DELETE RESTRICT) garantissent qu'on ne pourra plus revenir en arrière
  // par accident.
  async deleteAccount(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('Utilisateur introuvable.');
    }
    // Un admin ne peut pas supprimer son propre compte (sécurité)
    if (user.role === Role.ADMIN) {
      throw new ForbiddenException(
        'Un compte administrateur ne peut pas être supprimé ainsi.',
      );
    }
    // Déjà anonymisé : on répond succès sans rien réécrire. Rejouer écraserait
    // la date d'origine — la seule trace de QUAND le droit a été exercé.
    if (user.deletedAt) {
      return { message: 'Compte supprimé.' };
    }

    // Le mot de passe est remplacé par le haché d'un secret aléatoire que
    // personne ne connaît, nous compris. La connexion est déjà refusée sur
    // `deletedAt` ; ceci est la seconde serrure.
    const passwordHash = await argon2.hash(randomBytes(32).toString('hex'));

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: {
          // L'adresse d'origine est LIBÉRÉE : si la cliente revient un jour,
          // elle pourra se réinscrire avec le même email — sur un compte neuf,
          // sans ses anciens points. Le domaine `.invalid` est réservé par la
          // RFC 2606 et n'est routable nulle part : aucun email ne partira
          // jamais vers cette coquille, même par erreur de code.
          email: `supprime-${userId}@compte-supprime.invalid`,
          firstName: null,
          lastName: null,
          phone: null,
          passwordHash,
          emailVerifiedAt: null,
          deletedAt: new Date(),
        },
      }),
      // Les sessions ouvertes tombent tout de suite : le téléphone encore
      // connecté ne doit pas continuer à consulter le compte.
      this.prisma.refreshToken.deleteMany({ where: { userId } }),
      // Et un code de réinitialisation en cours ne doit pas servir de porte
      // dérobée sur une coquille anonyme.
      this.prisma.verificationCode.deleteMany({ where: { userId } }),
    ]);

    return { message: 'Compte supprimé.' };
  }

  // ----- STAFF / ADMIN -----

  // Liste paginée des utilisateurs (recherche au comptoir).
  //
  // Auparavant : `take: 50` en dur, sans indication. Au-delà de 50 comptes,
  // les suivants étaient purement invisibles — une cliente pouvait exister
  // en base et rester introuvable dans le backoffice, sans le moindre signal.
  async findAll(query: FindUsersQueryDto): Promise<Paginated<SafeUser>> {
    const { search, role, page, limit } = query;

    const where: Prisma.UserWhereInput = {
      // Les comptes anonymisés n'ont plus rien à faire dans une liste destinée
      // au comptoir : ni nom, ni téléphone, et une adresse
      // `supprime-<uuid>@compte-supprime.invalid` que Fati ne peut ni appeler
      // ni comprendre. Elles remontaient aussi dans la recherche de cliente du
      // modal de réservation et de l'onglet « Créditer ».
      //
      // L'export Excel filtrait déjà `deletedAt: null` et le DISAIT dans son
      // libellé : les deux comportements se contredisaient sur le même écran.
      deletedAt: null,
      ...(role ? { role } : {}),
      ...(search
        ? {
            OR: [
              { email: { contains: search, mode: 'insensitive' } },
              { firstName: { contains: search, mode: 'insensitive' } },
              { lastName: { contains: search, mode: 'insensitive' } },
              { phone: { contains: search } },
            ],
          }
        : {}),
    };

    // Les deux requêtes partagent le même `where` : le total décrit toujours
    // le même ensemble que la page renvoyée.
    const [data, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        select: SAFE_USER_SELECT,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  // ----- ADMIN seul -----

  async updateRole(userId: string, role: Role) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('Utilisateur introuvable.');
    }

    // Unicité du rôle ADMIN : un seul gérant
    if (role === Role.ADMIN) {
      const existingAdmin = await this.prisma.user.findFirst({
        where: { role: Role.ADMIN, id: { not: userId } },
      });
      if (existingAdmin) {
        throw new ConflictException(
          'Un administrateur existe déjà. Rétrogradez-le avant de promouvoir un nouveau gérant.',
        );
      }
    }

    // On ne rétrograde pas le dernier admin (évite de perdre tout accès)
    if (user.role === Role.ADMIN && role !== Role.ADMIN) {
      const otherAdmin = await this.prisma.user.findFirst({
        where: { role: Role.ADMIN, id: { not: userId } },
      });
      if (!otherAdmin) {
        throw new ForbiddenException(
          'Impossible de rétrograder le seul administrateur du centre.',
        );
      }
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: { role },
      select: SAFE_USER_SELECT,
    });
  }
}
