import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductCategoryDto } from './dto/create-category.dto';
import { CreateProductDto } from './dto/create-product.dto';

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

  async findOne(id: string) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: { category: true },
    });
    if (!product) {
      throw new NotFoundException('Produit introuvable.');
    }
    return product;
  }

  async deactivate(id: string) {
    await this.findOne(id);
    return this.prisma.product.update({
      where: { id },
      data: { active: false },
    });
  }
}