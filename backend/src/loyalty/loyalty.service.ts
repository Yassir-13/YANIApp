import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  Appointment,
  Order,
  LoyaltyAccount,
  LoyaltyTxType,
  VoucherSource,
  Prisma,
} from '@prisma/client';
import { CreateRewardDto } from './dto/create-reward.dto';
import { UpdateRewardDto } from './dto/update-reward.dto';
import { CreateMilestoneDto } from './dto/create-milestone.dto';
import { UpdateMilestoneDto } from './dto/update-milestone.dto';
import { ManualPointsDto } from './dto/manual-points.dto';
import { generateVoucherCode } from './voucher-code';
import {
  PaginationQueryDto,
  Paginated,
} from '../common/dto/pagination-query.dto';

// Taux de fidélité : 5% du montant dépensé, converti en points
const LOYALTY_RATE = 0.05;

@Injectable()
export class LoyaltyService {
  constructor(private readonly prisma: PrismaService) {}

  async getAccount(userId: string) {
    const account = await this.prisma.loyaltyAccount.findUnique({
      where: { userId },
    });
    if (!account) {
      throw new NotFoundException('Compte fidélité introuvable.');
    }
    return account;
  }

  async getHistory(userId: string) {
    const account = await this.getAccount(userId);
    return this.prisma.loyaltyTransaction.findMany({
      where: { accountId: account.id },
      // Le nom de la récompense vient d'ici et non du catalogue chargé par
      // l'app : ce catalogue ne contient que les récompenses ACTIVES, donc une
      // récompense retirée depuis laisserait un blanc précisément sur les
      // vieilles lignes de l'historique.
      include: { reward: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Crédite les points gagnés sur un RDV complété.
  // `tx` : transaction ouverte par l'appelant. Fournie, le crédit et le
  // changement de statut du RDV réussissent ou échouent ensemble.
  async earnFromAppointment(
    appointment: Appointment,
    tx?: Prisma.TransactionClient,
  ) {
    const db: Prisma.TransactionClient = tx ?? this.prisma;

    // Prix de référence : celui figé à la réservation (priceAtBooking).
    // Un changement de tarif après la réservation ne doit pas modifier les
    // points gagnés. Repli sur le prix courant du service pour les RDV
    // antérieurs à la colonne (priceAtBooking null).
    let price = appointment.priceAtBooking;
    if (price == null) {
      const service = await db.service.findUnique({
        where: { id: appointment.serviceId },
      });
      if (!service) return;
      price = service.price;
    }

    // Récupère le compte fidélité du client
    const account = await db.loyaltyAccount.findUnique({
      where: { userId: appointment.userId },
    });
    if (!account) return;

    // Calcule les points : 5% du prix, arrondi à l'entier
    const points = Math.round(Number(price) * LOYALTY_RATE);

    // Rien gagné, rien compté : ni points, ni visite, ni progression vers un
    // palier. Ce `return` est une RÈGLE COMMERCIALE, pas un oubli — il a déjà
    // été signalé comme bug lors d'un audit, d'où ce commentaire.
    //
    // Ce que ça couvre, à 5 % du prix : tout ce qui est sous 10 DH, donc les
    // prestations offertes (0 DH) et les gestes commerciaux symboliques.
    //
    // Pourquoi un offert ne doit surtout pas compter : un soin offert EST une
    // récompense de palier. S'il faisait avancer vers la récompense suivante,
    // le programme se financerait lui-même — cadeau, progression, cadeau — et
    // la fuite grossirait avec les meilleures clientes, celles qui coûtent
    // déjà le plus en récompenses.
    //
    // Seule une dépense réelle fait avancer la carte. Décision prise le
    // 2026-08-11 ; à ne pas « corriger » sans la remettre en cause d'abord.
    if (points <= 0) return;

    // Créer le mouvement + mettre à jour le solde et le compteur de visites
    const credit = async (client: Prisma.TransactionClient) => {
      await client.loyaltyTransaction.create({
        data: {
          accountId: account.id,
          ownerId: appointment.userId,
          pointsDelta: points,
          type: LoyaltyTxType.EARN,
          appointmentId: appointment.id,
        },
      });
      const updated = await client.loyaltyAccount.update({
        where: { id: account.id },
        data: {
          pointsBalance: { increment: points },
          visitCount: { increment: 1 },
        },
      });

      // Cette visite fait peut-être franchir un palier
      await this.grantMilestones(client, updated);

      return updated;
    };

    // Déjà dans une transaction : on y participe. Sinon, on en ouvre une.
    return tx ? credit(tx) : this.prisma.$transaction(credit);
  }

  // Crédite les points d'une COMMANDE terminée (5% du total, comme les RDV).
  // La transaction est liée à la commande via orderId (idempotence garantie
  // par la contrainte unique sur order_id).
  // N'incrémente PAS visitCount : une visite est une prestation réalisée à
  // l'institut, pas un achat de produits. Seuls les RDV comptent pour les
  // paliers de fidélité.
  //
  // `tx` : transaction ouverte par l'appelant. Fournie, le crédit et le passage
  // de la commande en « terminée » réussissent ou échouent ensemble. Sans elle,
  // un crédit qui échouait laissait la commande COMPLETED — un état FINAL, dont
  // on ne peut plus sortir — donc sans points, définitivement et en silence.
  // Même signature que earnFromAppointment, pour que les deux chemins se lisent
  // pareil.
  async earnFromOrder(order: Order, tx?: Prisma.TransactionClient) {
    const db: Prisma.TransactionClient = tx ?? this.prisma;

    const account = await db.loyaltyAccount.findUnique({
      where: { userId: order.userId },
    });
    if (!account) return;

    const points = Math.round(Number(order.total) * LOYALTY_RATE);
    if (points <= 0) return;

    const credit = async (client: Prisma.TransactionClient) => {
      await client.loyaltyTransaction.create({
        data: {
          accountId: account.id,
          ownerId: order.userId,
          pointsDelta: points,
          type: LoyaltyTxType.EARN,
          orderId: order.id,
        },
      });
      return client.loyaltyAccount.update({
        where: { id: account.id },
        data: {
          pointsBalance: { increment: points },
        },
      });
    };

    // Déjà dans une transaction : on y participe. Sinon, on en ouvre une.
    return tx ? credit(tx) : this.prisma.$transaction(credit);
  }

  // ----- PALIERS DE VISITES -----

  // Débloque les récompenses des paliers franchis par ce compte.
  // Appelée dans la transaction du RDV : le déblocage et le crédit de points
  // réussissent ou échouent ensemble.
  private async grantMilestones(
    client: Prisma.TransactionClient,
    account: LoyaltyAccount,
  ) {
    // Un palier dont la récompense a été retirée du catalogue ne débloque plus
    const milestones = await client.loyaltyMilestone.findMany({
      where: { active: true, reward: { active: true } },
    });

    for (const milestone of milestones) {
      if (milestone.visitThreshold <= 0) continue;

      // Combien de fois le seuil a été franchi : 10 visites pour un seuil de
      // 10 → cycle 1, 20 visites → cycle 2.
      const cycle = Math.floor(account.visitCount / milestone.visitThreshold);
      if (cycle < 1) continue;

      // Palier non récurrent : seul le premier franchissement compte
      if (!milestone.recurring && cycle > 1) continue;

      // skipDuplicates s'appuie sur l'unique (compte, palier, cycle) : si le
      // déblocage est rejoué, il ne fait rien plutôt que de faire échouer le
      // passage du RDV en « terminé ».
      await client.milestoneGrant.createMany({
        data: {
          accountId: account.id,
          milestoneId: milestone.id,
          // Récompense figée au déblocage : la modifier plus tard ne change
          // pas ce qui a déjà été offert.
          rewardId: milestone.rewardId,
          cycle,
        },
        skipDuplicates: true,
      });
    }
  }

  // Récompenses débloquées d'une cliente (réclamées ou non)
  async getMyGrants(userId: string) {
    const account = await this.getAccount(userId);
    return this.prisma.milestoneGrant.findMany({
      where: { accountId: account.id },
      include: {
        reward: true,
        milestone: { select: { visitThreshold: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // La cliente réclame une récompense offerte (aucun point dépensé)
  async claimGrant(userId: string, grantId: string) {
    const account = await this.getAccount(userId);

    const grant = await this.prisma.milestoneGrant.findUnique({
      where: { id: grantId },
      include: { reward: true },
    });
    // Un grant appartenant à quelqu'un d'autre est traité comme inexistant :
    // pas de fuite d'information sur les comptes tiers.
    if (!grant || grant.accountId !== account.id) {
      throw new NotFoundException('Récompense introuvable.');
    }

    const { transaction, voucher } = await this.prisma.$transaction(
      async (tx) => {
        // updateMany conditionné à claimedAt null : deux appels simultanés
        // (double tap sur mobile) ne peuvent pas réclamer deux fois.
        const { count } = await tx.milestoneGrant.updateMany({
          where: { id: grant.id, claimedAt: null },
          data: { claimedAt: new Date() },
        });
        if (count === 0) {
          throw new BadRequestException(
            'Cette récompense a déjà été réclamée.',
          );
        }

        // Trace dans l'historique fidélité, à solde inchangé
        const transaction = await tx.loyaltyTransaction.create({
          data: {
            accountId: account.id,
            ownerId: userId,
            pointsDelta: 0,
            type: LoyaltyTxType.MILESTONE,
            rewardId: grant.rewardId,
          },
        });

        // Le bon naît DANS la transaction. Sans ça, une réclamation qui
        // marquerait le grant sans émettre le bon laisserait la cliente avec
        // une récompense consommée et rien à présenter — exactement la panne
        // que ce chantier corrige.
        const voucher = await this.issueVoucher(tx, {
          accountId: account.id,
          rewardId: grant.rewardId,
          source: VoucherSource.MILESTONE,
          pointsSpent: 0,
          grantId: grant.id,
        });

        return { transaction, voucher };
      },
    );

    return {
      message: `Récompense « ${grant.reward.name} » réclamée. Présentez le code ${voucher.code} à l'institut.`,
      reward: grant.reward,
      voucher,
      transaction,
    };
  }

  // Paliers actifs (pour l'app cliente : afficher l'objectif en cours)
  findActiveMilestones() {
    return this.prisma.loyaltyMilestone.findMany({
      where: { active: true, reward: { active: true } },
      include: { reward: true },
      orderBy: { visitThreshold: 'asc' },
    });
  }

  // Tous les paliers, actifs ou non (pour l'admin)
  findAllMilestones() {
    return this.prisma.loyaltyMilestone.findMany({
      include: { reward: true },
      orderBy: { visitThreshold: 'asc' },
    });
  }

  async createMilestone(dto: CreateMilestoneDto) {
    const reward = await this.prisma.reward.findUnique({
      where: { id: dto.rewardId },
    });
    if (!reward) {
      throw new NotFoundException('Récompense introuvable.');
    }
    return this.prisma.loyaltyMilestone.create({
      data: dto,
      include: { reward: true },
    });
  }

  async updateMilestone(id: string, dto: UpdateMilestoneDto) {
    const milestone = await this.prisma.loyaltyMilestone.findUnique({
      where: { id },
    });
    if (!milestone) {
      throw new NotFoundException('Palier introuvable.');
    }
    if (dto.rewardId) {
      const reward = await this.prisma.reward.findUnique({
        where: { id: dto.rewardId },
      });
      if (!reward) {
        throw new NotFoundException('Récompense introuvable.');
      }
    }
    return this.prisma.loyaltyMilestone.update({
      where: { id },
      data: dto,
      include: { reward: true },
    });
  }

  async deactivateMilestone(id: string) {
    const milestone = await this.prisma.loyaltyMilestone.findUnique({
      where: { id },
    });
    if (!milestone) {
      throw new NotFoundException('Palier introuvable.');
    }
    return this.prisma.loyaltyMilestone.update({
      where: { id },
      data: { active: false },
      include: { reward: true },
    });
  }

  createReward(dto: CreateRewardDto) {
    return this.prisma.reward.create({ data: dto });
  }

  async updateReward(id: string, dto: UpdateRewardDto) {
    const reward = await this.prisma.reward.findUnique({ where: { id } });
    if (!reward) {
      throw new NotFoundException('Récompense introuvable.');
    }
    return this.prisma.reward.update({ where: { id }, data: dto });
  }

  // Catalogue des récompenses actives (pour les clients)
  findActiveRewards() {
    return this.prisma.reward.findMany({
      where: { active: true },
      orderBy: { pointsCost: 'asc' },
    });
  }

  // Toutes les récompenses, actives ou non (pour l'admin)
  findAllRewards() {
    return this.prisma.reward.findMany({
      orderBy: { pointsCost: 'asc' },
    });
  }

  async deactivateReward(id: string) {
    const reward = await this.prisma.reward.findUnique({ where: { id } });
    if (!reward) {
      throw new NotFoundException('Récompense introuvable.');
    }
    return this.prisma.reward.update({
      where: { id },
      data: { active: false },
    });
  }

  // ----- ÉCHANGE : le client dépense ses points -----

  async redeem(userId: string, rewardId: string) {
    // 1. La récompense existe et est disponible
    const reward = await this.prisma.reward.findUnique({
      where: { id: rewardId },
    });
    if (!reward || !reward.active) {
      throw new NotFoundException('Récompense introuvable ou indisponible.');
    }

    // 2. Le compte fidélité du client
    const account = await this.prisma.loyaltyAccount.findUnique({
      where: { userId },
    });
    if (!account) {
      throw new NotFoundException('Compte fidélité introuvable.');
    }

    // 3. Message précis quand le solde est visiblement insuffisant.
    //    Ce n'est PAS ce test qui protège le solde : entre cette lecture et
    //    l'écriture, le solde peut changer. Le vrai garde-fou est en 4.
    if (account.pointsBalance < reward.pointsCost) {
      throw new BadRequestException(
        `Solde insuffisant. Il vous manque ${reward.pointsCost - account.pointsBalance} point(s).`,
      );
    }

    // 4. Débit conditionnel atomique : Postgres réévalue « solde >= coût »
    //    au moment de l'écriture et ne touche aucune ligne si ce n'est plus
    //    vrai. Sans cette condition, deux échanges simultanés lisaient tous
    //    deux « solde = 100 », se croyaient chacun autorisés, et débitaient
    //    chacun 100 : le solde tombait à −100.
    //    Même motif que claimGrant.
    const { transaction, voucher } = await this.prisma.$transaction(
      async (tx) => {
        const { count } = await tx.loyaltyAccount.updateMany({
          where: { id: account.id, pointsBalance: { gte: reward.pointsCost } },
          data: { pointsBalance: { decrement: reward.pointsCost } },
        });
        if (count === 0) {
          throw new BadRequestException(
            'Solde insuffisant : vos points ont changé entre-temps. Rechargez la page.',
          );
        }

        const transaction = await tx.loyaltyTransaction.create({
          data: {
            accountId: account.id,
            ownerId: userId,
            pointsDelta: -reward.pointsCost, // négatif = dépense
            type: LoyaltyTxType.REDEEM,
            rewardId: reward.id,
          },
        });

        // Le bon naît DANS la même transaction que le débit. Si son émission
        // échoue, les points reviennent : une cliente qui a payé sans rien
        // recevoir à présenter n'aurait aucun recours (même panne qu'I2, mais
        // en sens inverse — là c'est elle qui perd).
        const voucher = await this.issueVoucher(tx, {
          accountId: account.id,
          rewardId: reward.id,
          source: VoucherSource.REDEEM,
          pointsSpent: reward.pointsCost,
          transactionId: transaction.id,
        });

        return { transaction, voucher };
      },
    );

    return {
      message: `Récompense « ${reward.name} » échangée. Présentez le code ${voucher.code} à l'institut.`,
      pointsSpent: reward.pointsCost,
      voucher,
      transaction,
    };
  }

  async addManualPoints(dto: ManualPointsDto, createdById: string) {
    // Le compte fidélité du client ciblé
    const account = await this.prisma.loyaltyAccount.findUnique({
      where: { userId: dto.userId },
    });
    if (!account) {
      throw new NotFoundException('Compte fidélité introuvable.');
    }

    // Transaction atomique : mouvement tracé + mise à jour du solde
    const [transaction] = await this.prisma.$transaction([
      this.prisma.loyaltyTransaction.create({
        data: {
          accountId: account.id,
          ownerId: dto.userId,
          pointsDelta: dto.points,
          type: LoyaltyTxType.MANUAL,
          createdById, // ← QUI a fait cet ajout (audit)
          reason: dto.reason?.trim() || null, // ← POURQUOI (audit)
        },
      }),
      this.prisma.loyaltyAccount.update({
        where: { id: account.id },
        data: { pointsBalance: { increment: dto.points } },
      }),
    ]);

    return {
      message: `${dto.points} point(s) ajouté(s) manuellement.`,
      transaction,
    };
  }

  // ----- AUDIT : l'admin consulte tous les ajouts manuels -----

  auditManualTransactions() {
    return this.prisma.loyaltyTransaction.findMany({
      where: { type: LoyaltyTxType.MANUAL },
      include: {
        owner: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
        createdBy: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ----- STAFF/ADMIN : consulter le compte fidélité d'un client -----

  async getAccountByUserId(userId: string) {
    const account = await this.prisma.loyaltyAccount.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            phone: true,
          },
        },
        // Récompenses offertes en attente : le comptoir doit les voir pour
        // honorer une cliente qui se présente sans avoir réclamé dans l'app.
        grants: {
          where: { claimedAt: null },
          include: { reward: true },
          orderBy: { createdAt: 'desc' },
        },
        // Bons encore dus. Ils sont ici, sur la fiche, et pas seulement dans
        // la liste globale : le comptoir doit pouvoir servir une cliente dont
        // le téléphone est déchargé, en la retrouvant par son nom.
        vouchers: {
          where: { honoredAt: null },
          include: { reward: true },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!account) {
      throw new NotFoundException('Compte fidélité introuvable.');
    }
    return account;
  }

  // ----- BONS DE RÉCOMPENSE -----
  //
  // Ce qui est dû à une cliente au comptoir. Les deux circuits y mènent :
  // une récompense offerte qu'elle a réclamée, ou une récompense qu'elle a
  // payée avec ses points. Avant cette notion, le premier cas disparaissait
  // des deux écrans à la réclamation, et le second n'existait nulle part.

  // Réserve un code libre. Le contrôle préalable évite de faire échouer une
  // transaction pour une collision ; l'index unique reste le vrai garde-fou,
  // et sur une collision simultanée l'opération échoue proprement (points
  // rendus) plutôt que de réutiliser un code déjà remis à quelqu'un d'autre.
  private async allocateVoucherCode(
    client: Prisma.TransactionClient,
  ): Promise<string> {
    for (let essai = 0; essai < 5; essai++) {
      const code = generateVoucherCode();
      const existant = await client.rewardVoucher.findUnique({
        where: { code },
        select: { id: true },
      });
      if (!existant) return code;
    }
    // 31^8 combinaisons : y arriver signifie que le tirage est cassé, pas
    // qu'on a joué de malchance.
    throw new Error("Impossible d'attribuer un code de bon unique.");
  }

  private async issueVoucher(
    client: Prisma.TransactionClient,
    data: {
      accountId: string;
      rewardId: string;
      source: VoucherSource;
      pointsSpent: number;
      grantId?: string;
      transactionId?: string;
    },
  ) {
    const code = await this.allocateVoucherCode(client);
    return client.rewardVoucher.create({
      data: { ...data, code },
      include: { reward: true },
    });
  }

  // Les bons d'une cliente : ce qu'elle doit présenter, puis ce qu'elle a déjà
  // utilisé. Les bons dus remontent en premier — c'est ce qu'elle ouvre l'écran
  // pour voir.
  async getMyVouchers(userId: string) {
    const account = await this.getAccount(userId);
    return this.prisma.rewardVoucher.findMany({
      where: { accountId: account.id },
      include: { reward: true },
      orderBy: [
        { honoredAt: { sort: 'asc', nulls: 'first' } },
        { createdAt: 'desc' },
      ],
    });
  }

  // La liste de travail du comptoir. Bornée par nature : elle ne contient que
  // ce qui reste dû, donc elle ne grossit pas avec l'historique.
  listPendingVouchers() {
    return this.prisma.rewardVoucher.findMany({
      where: { honoredAt: null },
      include: {
        reward: true,
        account: {
          select: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                phone: true,
              },
            },
          },
        },
      },
      // Le plus ancien d'abord : celui qui attend depuis le plus longtemps.
      orderBy: { createdAt: 'asc' },
    });
  }

  // La trace des remises. Celle-ci grossit sans fin, donc elle est paginée
  // dès maintenant plutôt que de rejoindre la liste des écrans à reprendre.
  async listHonoredVouchers(
    query: PaginationQueryDto,
  ): Promise<Paginated<any>> {
    const { page, limit } = query;
    const where = { honoredAt: { not: null } };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.rewardVoucher.findMany({
        where,
        include: {
          reward: true,
          account: {
            select: {
              user: {
                select: {
                  id: true,
                  email: true,
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
          honoredBy: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              role: true,
            },
          },
        },
        orderBy: { honoredAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.rewardVoucher.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    };
  }

  // Le comptoir remet la récompense.
  async honorVoucher(voucherId: string, staffId: string) {
    const voucher = await this.prisma.rewardVoucher.findUnique({
      where: { id: voucherId },
      include: { reward: true },
    });
    if (!voucher) {
      throw new NotFoundException('Bon introuvable.');
    }

    // Écriture conditionnée à honoredAt null, comme claimGrant et redeem :
    // deux clics au comptoir ne remettent pas deux fois la même récompense,
    // et le nom de qui l'a remise ne se réécrit pas après coup.
    const { count } = await this.prisma.rewardVoucher.updateMany({
      where: { id: voucherId, honoredAt: null },
      data: { honoredAt: new Date(), honoredById: staffId },
    });
    if (count === 0) {
      throw new BadRequestException('Ce bon a déjà été remis.');
    }

    return {
      message: `« ${voucher.reward.name} » remise.`,
      voucher: await this.prisma.rewardVoucher.findUnique({
        where: { id: voucherId },
        include: { reward: true },
      }),
    };
  }
}
