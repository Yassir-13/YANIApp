import { Injectable, NotFoundException } from '@nestjs/common';
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