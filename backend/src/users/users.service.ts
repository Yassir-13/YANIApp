import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, User, Role } from '@prisma/client';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';

// Champs sûrs à exposer (jamais le passwordHash)
const SAFE_USER_SELECT = {
  id: true,
  email: true,
  firstName: true,
  lastName: true,
  phone: true,
  role: true,
  createdAt: true,
};

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
  }): Promise<User> {
    return this.prisma.user.create({
      data: {
        email: data.email,
        passwordHash: data.passwordHash,
        firstName: data.firstName,
        lastName: data.lastName,
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
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });

    return { message: 'Mot de passe modifié avec succès.' };
  }

  // Suppression de compte (droit à l'effacement — CNDP)
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

    await this.prisma.user.delete({ where: { id: userId } });
    return { message: 'Compte supprimé.' };
  }

  // ----- STAFF / ADMIN -----

  // Liste des utilisateurs (recherche au comptoir)
  findAll(search?: string) {
    const where: Prisma.UserWhereInput = search
      ? {
          OR: [
            { email: { contains: search, mode: 'insensitive' } },
            { firstName: { contains: search, mode: 'insensitive' } },
            { lastName: { contains: search, mode: 'insensitive' } },
            { phone: { contains: search } },
          ],
        }
      : {};

    return this.prisma.user.findMany({
      where,
      select: SAFE_USER_SELECT,
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
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