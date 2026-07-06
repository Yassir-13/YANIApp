import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { CreateServiceDto } from './dto/create-service.dto';

@Injectable()
export class ServicesService {
  constructor(private readonly prisma: PrismaService) {}

  // ----- Catégories -----

  createCategory(dto: CreateCategoryDto) {
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

  async findOne(id: string) {
    const service = await this.prisma.service.findUnique({
      where: { id },
      include: { category: true },
    });
    if (!service) {
      throw new NotFoundException('Service introuvable.');
    }
    return service;
  }

  // Soft delete : on désactive plutôt que supprimer
  async deactivate(id: string) {
    await this.findOne(id); // vérifie l'existence
    return this.prisma.service.update({
      where: { id },
      data: { active: false },
    });
  }
}