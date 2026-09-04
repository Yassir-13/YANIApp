import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
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

  // Une faute de frappe dans un nom de catégorie était définitive : seul POST
  // existait. Le nom reste unique — le renommage vers un nom déjà pris est
  // refusé par la base (409).
  // Le DTO entier, et pas seulement le nom : c'est aussi par ici que passent
  // les traductions arabe et anglaise de la catégorie.
  async renameCategory(id: string, dto: CreateProductCategoryDto) {
    await this.findCategoryOrFail(id);
    return this.prisma.productCategory.update({
      where: { id },
      data: dto,
    });
  }

  // Suppression réelle, et non désactivation comme pour les produits : une
  // catégorie vide ne laisse rien derrière elle. Une catégorie qui contient
  // encore des produits n'est PAS supprimée — il faudrait les déplacer, et
  // c'est une décision qui appartient à la gérante, pas à une suppression en
  // cascade silencieuse.
  async deleteCategory(id: string) {
    const category = await this.findCategoryOrFail(id);
    const utilisee = await this.prisma.product.count({ where: { categoryId: id } });

    if (utilisee > 0) {
      throw new BadRequestException(
        `« ${category.name} » contient encore ${utilisee} produit(s). Déplacez-les dans une autre catégorie avant de la supprimer.`,
      );
    }

    return this.prisma.productCategory.delete({ where: { id } });
  }

  private async findCategoryOrFail(id: string) {
    const category = await this.prisma.productCategory.findUnique({
      where: { id },
    });
    if (!category) {
      throw new NotFoundException('Catégorie introuvable.');
    }
    return category;
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