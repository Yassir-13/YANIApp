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
  //  - VÉRIFIE le stock, sans le réserver
  //  - NE décrémente PAS le stock (fait à la confirmation staff)
  // ─────────────────────────────────────────
  async create(userId: string, dto: CreateOrderDto) {
    if (dto.fulfillment === FulfillmentType.DELIVERY && !dto.address?.trim()) {
      throw new BadRequestException(
        'Une adresse est requise pour la livraison.',
      );
    }

    // Fusionne les doublons éventuels (même productId) en sommant les quantités
    const merged = new Map<string, number>();
    for (const item of dto.items) {
      merged.set(
        item.productId,
        (merged.get(item.productId) ?? 0) + item.quantity,
      );
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

    // ── Stock : on VÉRIFIE ici, on ne RÉSERVE pas ──
    //
    // La réservation reste à la confirmation par le personnel (transitionTo),
    // où elle est atomique. Réserver dès la commande obligerait à libérer tout
    // ce qui n'est jamais confirmé — paniers abandonnés, commandes oubliées —
    // donc à construire une mécanique d'expiration entière, pour un institut
    // où deux clientes ne se disputent presque jamais la dernière unité.
    //
    // Ce contrôle ne supprime donc pas la course : il supprime le cas
    // prévisible et fréquent — commander 10 unités quand il en reste 1, voir
    // « Commande confirmée », et l'apprendre le lendemain par téléphone.
    // Le message nomme le produit : « stock insuffisant » sans dire lequel
    // oblige la cliente à retirer ses articles un par un pour deviner.
    const insuffisants = products.filter((p) => p.stockQty < merged.get(p.id)!);
    if (insuffisants.length > 0) {
      const details = insuffisants
        .map((p) =>
          p.stockQty === 0
            ? `« ${p.name} » (épuisé)`
            : `« ${p.name} » (reste ${p.stockQty}, demandé ${merged.get(p.id)})`,
        )
        .join(', ');
      throw new BadRequestException(`Stock insuffisant pour ${details}.`);
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
        address:
          dto.fulfillment === FulfillmentType.DELIVERY
            ? dto.address?.trim()
            : null,
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
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
            email: true,
          },
        },
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
    const found = await this.prisma.order.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!found) throw new NotFoundException('Commande introuvable.');

    const { items, ...order } = found;
    const previousStatus = order.status;
    const allowed = ALLOWED_TRANSITIONS[previousStatus];
    if (!allowed.includes(newStatus)) {
      throw new BadRequestException(
        `Transition impossible de ${previousStatus} vers ${newStatus}.`,
      );
    }

    // Le stock est considéré "décrémenté" dès que la commande a été CONFIRMED.
    const stockWasReserved =
      previousStatus === OrderStatus.CONFIRMED ||
      previousStatus === OrderStatus.READY;

    await this.prisma.$transaction(async (tx) => {
      // ── Réservation de la transition, AVANT tout effet de bord ──
      // L'écriture n'aboutit que si le statut est encore celui qu'on a lu.
      // Sans cette condition, deux clics rapides sur « Confirmer » passaient
      // tous deux le contrôle ci-dessus et décrémentaient le stock DEUX fois
      // pour la même commande. Ici, le second ne touche aucune ligne
      // (count === 0), lève, et toute sa transaction est annulée.
      const { count } = await tx.order.updateMany({
        where: { id, status: previousStatus },
        data: { status: newStatus },
      });
      if (count === 0) {
        throw new BadRequestException(
          'Cette commande a changé de statut entre-temps. Rechargez la page.',
        );
      }

      // ── CONFIRMED : décrémente le stock, sous condition de disponibilité ──
      if (newStatus === OrderStatus.CONFIRMED) {
        for (const item of items) {
          // La disponibilité est vérifiée PAR l'écriture, pas avant elle :
          // deux confirmations simultanées lisaient toutes deux « stock = 1 »
          // et décrémentaient chacune. Le stock finissait à −1.
          const { count: decremented } = await tx.product.updateMany({
            where: {
              id: item.productId,
              active: true,
              stockQty: { gte: item.quantity },
            },
            data: { stockQty: { decrement: item.quantity } },
          });

          if (decremented === 0) {
            // Aucune ligne touchée : produit retiré du catalogue, ou stock
            // devenu insuffisant. On relit uniquement pour le message —
            // la transaction est annulée juste après, rien n'est écrit.
            const product = await tx.product.findUnique({
              where: { id: item.productId },
            });
            if (!product || !product.active) {
              throw new BadRequestException(
                `Produit indisponible dans la commande (${item.productId}).`,
              );
            }
            throw new BadRequestException(
              `Stock insuffisant pour « ${product.name} » (reste ${product.stockQty}, demandé ${item.quantity}).`,
            );
          }
        }
      }

      // ── CANCELLED : restaure le stock si déjà réservé ──
      if (newStatus === OrderStatus.CANCELLED && stockWasReserved) {
        for (const item of items) {
          await tx.product.update({
            where: { id: item.productId },
            data: { stockQty: { increment: item.quantity } },
          });
        }
      }

      // ── COMPLETED : crédite les points (5% du total) ──
      // DANS la transaction, et non après elle.
      //
      // Le crédit se jouait auparavant une fois le commit passé. S'il échouait
      // — base indisponible une seconde, serveur redémarré au mauvais moment —
      // la commande restait COMPLETED sans points. Et COMPLETED est un état
      // FINAL (voir ALLOWED_TRANSITIONS) : impossible d'y revenir, donc les
      // points étaient perdus pour de bon, sans que personne ne le sache.
      //
      // Ici, un crédit qui échoue annule aussi le passage en « terminée ». Le
      // staff voit l'erreur et rejoue l'opération — c'est réparable, alors
      // qu'une commande terminée sans points ne l'était pas.
      //
      // Le double crédit reste impossible : `updateMany` ci-dessus n'a laissé
      // passer qu'une seule fois la transition, et la contrainte unique sur
      // orderId garde le verrou en dernier recours.
      if (newStatus === OrderStatus.COMPLETED) {
        await this.loyaltyService.earnFromOrder(
          { ...order, status: newStatus },
          tx,
        );
      }
    });

    return this.findByIdFull(id);
  }

  private findByIdFull(id: string) {
    return this.prisma.order.findUnique({
      where: { id },
      include: { items: { include: { product: true } } },
    });
  }
}
