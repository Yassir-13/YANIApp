import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LoyaltyService } from '../loyalty/loyalty.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { FulfillmentType, OrderStatus, Prisma, Role } from '@prisma/client';

// Transitions de statut autorisées (machine à états)
const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
  CONFIRMED: [OrderStatus.READY, OrderStatus.CANCELLED],
  READY: [OrderStatus.COMPLETED, OrderStatus.CANCELLED],
  COMPLETED: [],
  CANCELLED: [],
};

// Statuts jusqu'auxquels le client peut annuler lui-même (inclus)
const CLIENT_CANCELLABLE: OrderStatus[] = [
  OrderStatus.PENDING,
  OrderStatus.CONFIRMED,
  OrderStatus.READY,
];

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly loyaltyService: LoyaltyService,
  ) {}

  // ─────────────────────────────────────────
  //  Création d'une commande (client)
  //  - fige le prix unitaire de chaque ligne
  //  - calcule le total
  //  - NE décrémente PAS le stock (fait à la confirmation staff)
  // ─────────────────────────────────────────
  async create(userId: string, dto: CreateOrderDto) {
    if (dto.fulfillment === FulfillmentType.DELIVERY && !dto.address?.trim()) {
      throw new BadRequestException('Une adresse est requise pour la livraison.');
    }

    // Fusionne les doublons éventuels (même productId) en sommant les quantités
    const merged = new Map<string, number>();
    for (const item of dto.items) {
      merged.set(item.productId, (merged.get(item.productId) ?? 0) + item.quantity);
    }
    const productIds = [...merged.keys()];

    // Charge les produits concernés (actifs uniquement)
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds }, active: true },
    });

    if (products.length !== productIds.length) {
      throw new BadRequestException(
        'Un ou plusieurs produits sont introuvables ou indisponibles.',
      );
    }

    // Construit les lignes avec prix figé + calcule le total
    let total = new Prisma.Decimal(0);
    const itemsData = products.map((p) => {
      const quantity = merged.get(p.id)!;
      total = total.plus(p.price.mul(quantity));
      return {
        productId: p.id,
        quantity,
        unitPrice: p.price, // snapshot du prix au moment de la commande
      };
    });

    // Création atomique de la commande + lignes
    const order = await this.prisma.order.create({
      data: {
        userId,
        status: OrderStatus.PENDING,
        fulfillment: dto.fulfillment,
        address: dto.fulfillment === FulfillmentType.DELIVERY ? dto.address?.trim() : null,
        note: dto.note?.trim() || null,
        total,
        items: { create: itemsData },
      },
      include: { items: { include: { product: true } } },
    });

    return order;
  }

  // ─────────────────────────────────────────
  //  Lectures
  // ─────────────────────────────────────────
  async findMine(userId: string) {
    return this.prisma.order.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: { items: { include: { product: true } } },
    });
  }

  async findOneForUser(id: string, userId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: { items: { include: { product: true } } },
    });
    if (!order || order.userId !== userId) {
      throw new NotFoundException('Commande introuvable.');
    }
    return order;
  }

  // STAFF/ADMIN : toutes les commandes, filtrables par statut
  async findAll(status?: OrderStatus) {
    return this.prisma.order.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: 'desc' },
      include: {
        items: { include: { product: true } },
        user: { select: { id: true, firstName: true, lastName: true, phone: true, email: true } },
      },
    });
  }

  // ─────────────────────────────────────────
  //  Annulation par le client (jusqu'à READY inclus)
  // ─────────────────────────────────────────
  async cancelByClient(id: string, userId: string) {
    const order = await this.prisma.order.findUnique({ where: { id } });
    if (!order || order.userId !== userId) {
      throw new NotFoundException('Commande introuvable.');
    }
    if (!CLIENT_CANCELLABLE.includes(order.status)) {
      throw new BadRequestException(
        "Cette commande ne peut plus être annulée. Contactez l'institut.",
      );
    }
    return this.transitionTo(id, OrderStatus.CANCELLED);
  }

  // ─────────────────────────────────────────
  //  Changement de statut par le staff
  // ─────────────────────────────────────────
  async updateStatus(id: string, newStatus: OrderStatus) {
    return this.transitionTo(id, newStatus);
  }

  // ─────────────────────────────────────────
  //  Cœur : applique une transition de statut avec ses effets de bord
  //   - CONFIRMED  → décrémente le stock (vérifie la dispo)
  //   - COMPLETED  → crédite les points fidélité (5%)
  //   - CANCELLED  → restaure le stock si déjà décrémenté (venant de CONFIRMED/READY)
  // ─────────────────────────────────────────
  private async transitionTo(id: string, newStatus: OrderStatus) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!order) throw new NotFoundException('Commande introuvable.');

    const allowed = ALLOWED_TRANSITIONS[order.status];
    if (!allowed.includes(newStatus)) {
      throw new BadRequestException(
        `Transition impossible de ${order.status} vers ${newStatus}.`,
      );
    }

    // Le stock est considéré "décrémenté" dès que la commande a été CONFIRMED.
    const stockWasReserved =
      order.status === OrderStatus.CONFIRMED || order.status === OrderStatus.READY;

    // ── CONFIRMED : vérifie et décrémente le stock atomiquement ──
    if (newStatus === OrderStatus.CONFIRMED) {
      await this.prisma.$transaction(async (tx) => {
        // Recharge les produits pour vérifier la dispo au moment T
        for (const item of order.items) {
          const product = await tx.product.findUnique({ where: { id: item.productId } });
          if (!product || !product.active) {
            throw new BadRequestException(
              `Produit indisponible dans la commande (${item.productId}).`,
            );
          }
          if (product.stockQty < item.quantity) {
            throw new BadRequestException(
              `Stock insuffisant pour « ${product.name} » (reste ${product.stockQty}, demandé ${item.quantity}).`,
            );
          }
        }
        // Décrémente
        for (const item of order.items) {
          await tx.product.update({
            where: { id: item.productId },
            data: { stockQty: { decrement: item.quantity } },
          });
        }
        await tx.order.update({ where: { id }, data: { status: newStatus } });
      });
      return this.findByIdFull(id);
    }

    // ── CANCELLED : restaure le stock si déjà réservé ──
    if (newStatus === OrderStatus.CANCELLED) {
      await this.prisma.$transaction(async (tx) => {
        if (stockWasReserved) {
          for (const item of order.items) {
            await tx.product.update({
              where: { id: item.productId },
              data: { stockQty: { increment: item.quantity } },
            });
          }
        }
        await tx.order.update({ where: { id }, data: { status: newStatus } });
      });
      return this.findByIdFull(id);
    }

    // ── COMPLETED : marque puis crédite les points (5% du total) ──
    if (newStatus === OrderStatus.COMPLETED) {
      const updated = await this.prisma.order.update({
        where: { id },
        data: { status: newStatus },
      });
      // Crédit fidélité (idempotent via la contrainte unique orderId)
      await this.loyaltyService.earnFromOrder(updated);
      return this.findByIdFull(id);
    }

    // ── READY (ou autres transitions simples) : juste le statut ──
    await this.prisma.order.update({ where: { id }, data: { status: newStatus } });
    return this.findByIdFull(id);
  }

  private findByIdFull(id: string) {
    return this.prisma.order.findUnique({
      where: { id },
      include: { items: { include: { product: true } } },
    });
  }
}