import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateServiceCategoryDto } from './dto/create-category.dto';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';

@Injectable()
export class ServicesService {
  constructor(private readonly prisma: PrismaService) {}

  // ----- Catégories -----

  createCategory(dto: CreateServiceCategoryDto) {
    return this.prisma.serviceCategory.create({ data: { name: dto.name } });
  }

  findAllCategories() {
    return this.prisma.serviceCategory.findMany({
      orderBy: { name: 'asc' },
    });
  }

  // Une faute de frappe dans un nom de catégorie était définitive : seul POST
  // existait. Le nom reste unique — le renommage vers un nom déjà pris est
  // refusé par la base (409).
  async renameCategory(id: string, name: string) {
    await this.findCategoryOrFail(id);
    return this.prisma.serviceCategory.update({
      where: { id },
      data: { name },
    });
  }

  // Suppression réelle, et non désactivation comme pour les prestations : une
  // catégorie vide ne laisse rien derrière elle. Une catégorie qui contient
  // encore des prestations n'est PAS supprimée — il faudrait les déplacer, et
  // c'est une décision qui appartient à la gérante, pas à une suppression en
  // cascade silencieuse.
  async deleteCategory(id: string) {
    const category = await this.findCategoryOrFail(id);
    const utilisee = await this.prisma.service.count({ where: { categoryId: id } });

    if (utilisee > 0) {
      throw new BadRequestException(
        `« ${category.name} » contient encore ${utilisee} prestation(s). Déplacez-les dans une autre catégorie avant de la supprimer.`,
      );
    }

    return this.prisma.serviceCategory.delete({ where: { id } });
  }

  private async findCategoryOrFail(id: string) {
    const category = await this.prisma.serviceCategory.findUnique({
      where: { id },
    });
    if (!category) {
      throw new NotFoundException('Catégorie introuvable.');
    }
    return category;
  }

  // ----- Services -----

  createService(dto: CreateServiceDto) {
    return this.prisma.service.create({ data: dto });
  }

  // Catalogue public : uniquement les services actifs
  findAllActive() {
    return this.prisma.service.findMany({
      where: { active: true },
      include: { category: true },
      orderBy: { name: 'asc' },
    });
  }

  // Route publique : une prestation désactivée n'existe pas pour les clientes.
  async findOne(id: string) {
    const service = await this.prisma.service.findUnique({
      where: { id },
      include: { category: true },
    });
    if (!service || !service.active) {
      throw new NotFoundException('Service introuvable.');
    }
    return service;
  }

  // Usage interne / admin : récupère la prestation même désactivée
  // (nécessaire pour la modifier ou la réactiver).
  async findOneAny(id: string) {
    const service = await this.prisma.service.findUnique({
      where: { id },
      include: { category: true },
    });
    if (!service) {
      throw new NotFoundException('Service introuvable.');
    }
    return service;
  }

    // Staff/admin : inclut les prestations désactivées, pour pouvoir les réactiver.
  findAllIncludingInactive() {
    return this.prisma.service.findMany({
      include: { category: true },
      orderBy: { name: 'asc' },
    });
  }

  async update(id: string, dto: UpdateServiceDto) {
    await this.findOneAny(id);
    return this.prisma.service.update({
      where: { id },
      data: dto,
      include: { category: true },
    });
  }

  // Soft delete : on désactive plutôt que supprimer
  async deactivate(id: string) {
    await this.findOneAny(id); // vérifie l'existence
    return this.prisma.service.update({
      where: { id },
      data: { active: false },
    });
  }
}