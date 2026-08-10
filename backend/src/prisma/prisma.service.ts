import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    super({
      transactionOptions: {
        // `maxWait` : temps accordé pour OUVRIR une transaction.
        // Les valeurs par défaut de Prisma (2 s) sont taillées pour des
        // transactions isolées. Or les chemins qui protègent nos invariants
        // — confirmer une commande, réserver un créneau, échanger des points
        // — sont justement ceux où plusieurs requêtes arrivent ensemble et
        // se mettent en file. Mesuré sur ce projet : une transaction seule
        // s'ouvre en ~10 ms, mais ~400 ms quand cinq sont demandées d'un
        // coup. À 2 s, la 5ᵉ réservation simultanée échouait sur une erreur
        // technique opaque au lieu d'un « Ce créneau est complet ».
        maxWait: 10_000,
        // `timeout` : durée de vie maximale d'une transaction une fois
        // ouverte. Les nôtres durent quelques millisecondes ; cette marge
        // couvre l'attente du verrou de réservation sous rafale.
        timeout: 15_000,
      },
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}