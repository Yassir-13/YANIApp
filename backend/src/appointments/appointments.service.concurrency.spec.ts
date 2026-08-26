import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { Prisma, AppointmentStatus } from '@prisma/client';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';
import { AppointmentsService } from './appointments.service';
import { LoyaltyService } from '../loyalty/loyalty.service';
import { SettingsService } from '../settings/settings.service';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';

// Test d'INTÉGRATION : la capacité des cabines se compte sur un ENSEMBLE de
// rendez-vous. C'est le verrou consultatif Postgres qu'on vérifie ici, et un
// verrou n'existe pas dans un mock. Voir orders.service.concurrency.spec.ts.

const TZ = process.env.CENTER_TIMEZONE ?? 'Africa/Casablanca';

// PrismaService porte les réglages de transaction de l'application.
const prisma = new PrismaService();
const service = new AppointmentsService(
  prisma,
  new LoyaltyService(prisma),
  new SettingsService(prisma),
  { get: () => TZ } as unknown as ConfigService,
);

// Ni la capacité ni l'écart ne sont des constantes du code : les deux sont lus
// en base, comme le fait le service. Une valeur recopiée ici mentirait le jour
// où la gérante ajoute une salle ou resserre ses créneaux depuis le backoffice.
//
// L'ÉCART est ce qui décide de l'occupation d'un rendez-vous. La durée de la
// prestation n'entre plus nulle part dans ce calcul — c'est même ce que
// vérifient les tests ci-dessous.
let CAPACITE = 2;
let ECART = 60;

const aNettoyer = {
  users: [] as string[],
  services: [] as string[],
  categories: [] as string[],
};

// On ne touche PAS aux horaires d'ouverture de l'institut : on lit sa
// configuration réelle et on projette une plage ouverte dans un futur lointain,
// où aucun rendez-vous existant ne peut se trouver.
//
// Une fermeture exceptionnelle ne peut pas gêner : elles portent sur des dates
// réelles, jamais sur janvier 2099.
async function trouverCreneau(minutesNecessaires: number) {
  const plages = await prisma.openingHours.findMany();
  if (plages.length === 0) return null;

  for (let i = 1; i <= 7; i++) {
    const dateStr = `2099-01-0${i}`;
    const jourLocal = toZonedTime(
      new Date(`${dateStr}T12:00:00.000Z`),
      TZ,
    ).getDay();

    // Le créneau doit tenir ENTIÈREMENT dans UNE plage : depuis la pause
    // déjeuner, un jour ouvert ne garantit plus une amplitude continue.
    for (const plage of plages.filter((p) => p.dayOfWeek === jourLocal)) {
      const [dh, dm] = plage.startTime.split(':').map(Number);
      const [fh, fm] = plage.endTime.split(':').map(Number);
      if (dh * 60 + dm + minutesNecessaires > fh * 60 + fm) continue;

      return fromZonedTime(`${dateStr}T${plage.startTime}:00`, TZ);
    }
  }
  return null;
}

// La durée est volontairement démesurée — quatre heures — et volontairement
// sans rapport avec l'écart. Si un test de ce fichier venait à en dépendre,
// c'est que le moteur s'est remis à lire `durationMin`, ce qu'il ne doit plus
// faire : le centre espace ses rendez-vous d'un écart fixe, un point c'est tout.
async function creerPrestation() {
  const categorie = await prisma.serviceCategory.create({
    data: { name: `Cat RDV ${randomUUID()}` },
  });
  aNettoyer.categories.push(categorie.id);

  const prestation = await prisma.service.create({
    data: {
      categoryId: categorie.id,
      name: `Prestation concurrence ${randomUUID()}`,
      durationMin: 240,
      price: new Prisma.Decimal('200.00'),
    },
  });
  aNettoyer.services.push(prestation.id);
  return prestation;
}

async function creerClientes(combien: number) {
  const clientes: { id: string }[] = [];
  for (let i = 0; i < combien; i++) {
    const user = await prisma.user.create({
      data: {
        email: `rdv-${randomUUID()}@exemple.test`,
        passwordHash: 'hash-factice',
        firstName: `Cliente${i}`,
        lastName: 'Concurrence',
        loyaltyAccount: { create: {} },
      },
    });
    aNettoyer.users.push(user.id);
    clientes.push(user);
  }
  return clientes;
}

describe('AppointmentsService — réservations concurrentes (vraie base)', () => {
  // Préchauffage du moteur Prisma : sans lui, la rafale de réservations
  // simultanées fait la queue derrière le démarrage du moteur et dépasse
  // `maxWait`. On mesurerait le banc d'essai, pas la condition de course.
  beforeAll(async () => {
    await prisma.$connect();
    await prisma.$transaction(async (tx) => tx.appointment.count());
    const reglages = await new SettingsService(prisma).get();
    CAPACITE = reglages.capacity;
    ECART = reglages.slotIntervalMin;
  }, 30_000);

  // Chaque test doit trouver le centre VIDE. Ils visent tous le même créneau —
  // le premier de la première journée ouverte de janvier 2099 — et les
  // rendez-vous d'un test précédent en occuperaient les salles. Le suivant
  // mesurerait alors l'état laissé par son voisin, pas la règle qu'il annonce.
  //
  // ⚠️ Ce nettoyage manquait, et le fichier ne passait que par chance : les
  // rendez-vous de 30 minutes du premier test se terminaient pile au début du
  // créneau décalé du second, qui restait donc libre. Le jour où l'occupation
  // est devenue un écart fixe d'une heure, les deux tests sont tombés
  // ensemble — ils dépendaient d'une coïncidence depuis le début.
  afterEach(async () => {
    await prisma.appointment.deleteMany({
      where: { serviceId: { in: aNettoyer.services } },
    });
  });

  afterAll(async () => {
    // Les RDV d'abord, explicitement. Ils ne partent PLUS avec la cliente :
    // `appointments.user_id` est passé en ON DELETE RESTRICT le jour où la
    // suppression de compte est devenue une anonymisation — un rendez-vous est
    // une prestation facturée, il ne doit pas disparaître avec la personne.
    await prisma.appointment.deleteMany({
      where: { userId: { in: aNettoyer.users } },
    });
    await prisma.user.deleteMany({ where: { id: { in: aNettoyer.users } } });
    await prisma.service.deleteMany({
      where: { id: { in: aNettoyer.services } },
    });
    await prisma.serviceCategory.deleteMany({
      where: { id: { in: aNettoyer.categories } },
    });
    await prisma.$disconnect();
  });

  it('ne réserve jamais plus de salles qu’il n’en existe', async () => {
    const startAt = await trouverCreneau(ECART);
    if (!startAt) {
      throw new Error(
        "Aucun jour d'ouverture configuré : lancez `npx prisma db seed` avant ce test.",
      );
    }

    const prestation = await creerPrestation();
    // Trois clientes de plus que de salles : il en restera toujours à refuser,
    // quelle que soit la capacité réglée dans le backoffice.
    const CANDIDATES = CAPACITE + 3;
    const clientes = await creerClientes(CANDIDATES);

    // Toutes les réservations partent ensemble sur le même créneau, et toutes
    // voient le créneau libre au moment de compter.
    const résultats = await Promise.allSettled(
      clientes.map((c) =>
        service.create(c.id, {
          serviceId: prestation.id,
          startAt: startAt.toISOString(),
        }),
      ),
    );

    // L'invariant : autant de réservations que de salles, pas une de plus.
    // Avant le correctif : les cinq passaient.
    expect(résultats.filter((r) => r.status === 'fulfilled')).toHaveLength(
      CAPACITE,
    );

    const refus = résultats
      .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
      .map((r) => String(r.reason?.message ?? r.reason));
    expect(refus).toHaveLength(CANDIDATES - CAPACITE);
    refus.forEach((m) => expect(m).toMatch(/complet/));

    // Et la base le confirme : pas de 3ᵉ ligne écrite en douce.
    const enBase = await prisma.appointment.count({
      where: {
        serviceId: prestation.id,
        startAt,
        status: {
          in: [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED],
        },
      },
    });
    expect(enBase).toBe(CAPACITE);
  });

  it('compte les RDV qui se chevauchent, pas seulement ceux à la même heure', async () => {
    // Un décalage d'une demi-écart : hors de la grille, mais bien chevauchant.
    // C'est le cas du comptoir qui case une cliente entre deux créneaux.
    const DECALAGE = Math.floor(ECART / 2);
    const début = await trouverCreneau(ECART + DECALAGE);
    if (!début) {
      throw new Error(
        "Aucun jour d'ouverture configuré : lancez `npx prisma db seed` avant ce test.",
      );
    }

    const prestation = await creerPrestation();
    const clientes = await creerClientes(4);

    // Deux à l'ouverture, deux un demi-écart plus tard : les quatre
    // occupations se chevauchent deux à deux.
    const décalé = new Date(début.getTime() + DECALAGE * 60_000);
    const résultats = await Promise.allSettled([
      service.create(clientes[0].id, {
        serviceId: prestation.id,
        startAt: début.toISOString(),
      }),
      service.create(clientes[1].id, {
        serviceId: prestation.id,
        startAt: décalé.toISOString(),
      }),
      service.create(clientes[2].id, {
        serviceId: prestation.id,
        startAt: début.toISOString(),
      }),
      service.create(clientes[3].id, {
        serviceId: prestation.id,
        startAt: décalé.toISOString(),
      }),
    ]);

    expect(résultats.filter((r) => r.status === 'fulfilled')).toHaveLength(
      CAPACITE,
    );

    const enBase = await prisma.appointment.count({
      where: {
        serviceId: prestation.id,
        status: {
          in: [AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED],
        },
      },
    });
    expect(enBase).toBe(CAPACITE);
  });

  // La règle de gestion du centre, vérifiée de bout en bout : un rendez-vous
  // occupe UN créneau, jamais la durée de sa prestation. La prestation utilisée
  // ici dure quatre heures ; l'ancien calcul lui aurait fait manger les trois
  // créneaux suivants, et ce test aurait échoué sur la deuxième salve.
  it("libère le créneau suivant, même sur une prestation de quatre heures", async () => {
    const début = await trouverCreneau(ECART * 2);
    if (!début) {
      throw new Error(
        "Aucun jour d'ouverture configuré : lancez `npx prisma db seed` avant ce test.",
      );
    }

    const prestation = await creerPrestation();
    const suivant = new Date(début.getTime() + ECART * 60_000);
    const clientes = await creerClientes(CAPACITE * 2);

    const résultats = await Promise.allSettled(
      clientes.map((c, i) =>
        service.create(c.id, {
          serviceId: prestation.id,
          startAt: (i < CAPACITE ? début : suivant).toISOString(),
        }),
      ),
    );

    // Les deux salves passent en entier : le créneau suivant n'a jamais été
    // occupé par les rendez-vous du premier.
    const refus = résultats
      .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
      .map((r) => String(r.reason?.message ?? r.reason));
    expect(refus).toEqual([]);

    expect(
      await prisma.appointment.count({
        where: { serviceId: prestation.id, startAt: suivant },
      }),
    ).toBe(CAPACITE);
  });
});
