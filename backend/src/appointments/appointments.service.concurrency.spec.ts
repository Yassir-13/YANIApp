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

// La capacité n'est plus une constante du code : elle est lue en base, comme
// le fait le service. Une valeur recopiée ici mentirait le jour où la gérante
// ajoute une cabine depuis le backoffice.
let CAPACITE = 2;

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
async function trouverCreneau(durationMin: number) {
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
      if (dh * 60 + dm + durationMin > fh * 60 + fm) continue;

      return fromZonedTime(`${dateStr}T${plage.startTime}:00`, TZ);
    }
  }
  return null;
}

async function creerPrestation(durationMin: number) {
  const categorie = await prisma.serviceCategory.create({
    data: { name: `Cat RDV ${randomUUID()}` },
  });
  aNettoyer.categories.push(categorie.id);

  const prestation = await prisma.service.create({
    data: {
      categoryId: categorie.id,
      name: `Prestation concurrence ${randomUUID()}`,
      durationMin,
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
    CAPACITE = (await new SettingsService(prisma).get()).capacity;
  }, 30_000);

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

  it('ne réserve jamais plus de cabines qu’il n’en existe', async () => {
    const DUREE = 30;
    const startAt = await trouverCreneau(DUREE);
    if (!startAt) {
      throw new Error(
        "Aucun jour d'ouverture configuré : lancez `npx prisma db seed` avant ce test.",
      );
    }

    const prestation = await creerPrestation(DUREE);
    // Trois clientes de plus que de cabines : il en restera toujours à refuser,
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

    // L'invariant : autant de réservations que de cabines, pas une de plus.
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
    const DUREE = 60;
    const début = await trouverCreneau(DUREE + 30);
    if (!début) {
      throw new Error(
        "Aucun jour d'ouverture configuré : lancez `npx prisma db seed` avant ce test.",
      );
    }

    const prestation = await creerPrestation(DUREE);
    const clientes = await creerClientes(4);

    // Deux à l'ouverture, deux 30 minutes plus tard : les quatre créneaux
    // d'une heure se chevauchent tous deux à deux.
    const décalé = new Date(début.getTime() + 30 * 60_000);
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
});
