import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

// Connexion au démarrage : plusieurs essais, espacés de plus en plus.
//
// En développement la base tourne depuis longtemps quand on lance l'API, et un
// seul essai suffit. En production les deux démarrent ENSEMBLE, et Postgres est
// régulièrement prêt quelques secondes après nous — au premier lancement comme
// à chaque redéploiement. Un unique `$connect()` faisait alors échouer le
// bootstrap NestJS et laissait l'API morte jusqu'à ce qu'un humain s'en
// aperçoive et la relance.
//
// 5 essais espacés de 1, 2, 4 puis 8 s. À quoi s'ajoute le délai que Prisma
// s'accorde lui-même avant de renoncer, ~4 s par essai : mesuré à **~35 s** au
// total entre le premier essai et l'abandon. Large pour un redémarrage de base,
// assez court pour ne pas masquer une vraie panne.
const CONNECT_MAX_ATTEMPTS = 5;
const CONNECT_BASE_DELAY_MS = 1_000;

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

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
    await this.connectWithRetry();
  }

  private async connectWithRetry() {
    for (let attempt = 1; attempt <= CONNECT_MAX_ATTEMPTS; attempt++) {
      try {
        await this.$connect();
        // Silence quand tout va bien du premier coup : ce message ne doit
        // apparaître que s'il raconte quelque chose d'utile.
        if (attempt > 1) {
          this.logger.log(
            `Base de données joignable au bout de ${attempt} essais.`,
          );
        }
        return;
      } catch (error) {
        const cause = (error as Error).message;

        // Dernier essai perdu : on laisse l'erreur remonter, et NestJS refuse
        // de démarrer. C'est voulu. Une API debout sans base répondrait 500 à
        // chaque requête en se croyant en bonne santé ; en échouant, elle
        // laisse l'orchestrateur (Docker, EAS, le service systemd) la relancer.
        if (attempt === CONNECT_MAX_ATTEMPTS) {
          this.logger.error(
            `Base de données injoignable après ${CONNECT_MAX_ATTEMPTS} essais : ${cause}`,
          );
          throw error;
        }

        const delay = CONNECT_BASE_DELAY_MS * 2 ** (attempt - 1);
        this.logger.warn(
          `Base de données injoignable (essai ${attempt}/${CONNECT_MAX_ATTEMPTS}) : ${cause}. ` +
            `Nouvel essai dans ${delay / 1_000} s.`,
        );
        await this.sleep(delay);
      }
    }
  }

  // Méthode à part, et non un `setTimeout` en ligne : les tests la remplacent
  // pour ne pas attendre 15 s pour de vrai.
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
