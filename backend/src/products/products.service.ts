import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductCategoryDto } from './dto/create-category.dto';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  // ----- Catégories -----

  createCategory(dto: CreateProductCategoryDto) {
    return this.prisma.productCategory.create({ data: { name: dto.name } });
  }

  findAllCategories() {
    return this.prisma.productCategory.findMany({ orderBy: { name: 'asc' } });
  }

  // ----- Produits -----

  createProduct(dto: CreateProductDto) {
    return this.prisma.product.create({ data: dto });
  }

  findAllActive() {
    return this.prisma.product.findMany({
      where: { active: true },
      include: { category: true },
      orderBy: { name: 'asc' },
    });
  }

  // Staff/admin : inclut les produits désactivés, pour pouvoir les réactiver.
  findAllIncludingInactive() {
    return this.prisma.product.findMany({
      include: { category: true },
      orderBy: { name: 'asc' },
    });
  }

  // Route publique : un produit désactivé n'existe pas pour les clientes.
  async findOne(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: { category: true },
    });
    if (!product || !product.active) {
      throw new NotFoundException('Produit introuvable.');
    }
    return product;
  }

  // Usage interne / admin : récupère le produit même désactivé
  // (nécessaire pour le modifier ou le réactiver).
  async findOneAny(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: { category: true },
    });
    if (!product) {
      throw new NotFoundException('Produit introuvable.');
    }
    return product;
  }

  async update(id: string, dto: UpdateProductDto) {
    await this.findOneAny(id);
    return this.prisma.product.update({
      where: { id },
      data: dto,
      include: { category: true },
    });
  }

  async deactivate(id: string) {
    await this.findOneAny(id);
    return this.prisma.product.update({
      where: { id },
      data: { active: false },
    });
  }
}