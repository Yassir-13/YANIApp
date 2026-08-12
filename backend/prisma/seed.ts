import { PrismaClient, Role } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

// Horaires de départ, modifiables ensuite depuis le backoffice (page Horaires).
// 0 = dimanche … 6 = samedi.
const HORAIRES_PAR_DEFAUT = [
  { dayOfWeek: 0, openTime: '00:00', closeTime: '00:00', isClosed: true },
  { dayOfWeek: 1, openTime: '09:00', closeTime: '18:00', isClosed: false },
  { dayOfWeek: 2, openTime: '09:00', closeTime: '18:00', isClosed: false },
  { dayOfWeek: 3, openTime: '09:00', closeTime: '18:00', isClosed: false },
  { dayOfWeek: 4, openTime: '09:00', closeTime: '18:00', isClosed: false },
  { dayOfWeek: 5, openTime: '09:00', closeTime: '19:00', isClosed: false },
  { dayOfWeek: 6, openTime: '09:00', closeTime: '19:00', isClosed: false },
];

// Sans une seule ligne dans `opening_hours`, le centre est considéré fermé tous
// les jours : la recherche de créneaux renvoie `closed: true` partout et aucune
// cliente ne peut réserver. Une installation neuve était donc muette jusqu'à ce
// que quelqu'un pense à ouvrir la page Horaires.
//
// `createMany` + `skipDuplicates` : les jours déjà configurés ne sont jamais
// réécrits. Rejouer le seed sur une base en service ne peut pas écraser les
// horaires réels de l'institut.
async function seedHoraires() {
  const { count } = await prisma.openingHours.createMany({
    data: HORAIRES_PAR_DEFAUT,
    skipDuplicates: true,
  });
  console.log(
    count > 0
      ? `Horaires d'ouverture créés pour ${count} jour(s).`
      : "Horaires d'ouverture déjà configurés. Aucune action.",
  );
}

async function main() {
  await seedHoraires();

  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  const firstName = process.env.ADMIN_FIRST_NAME ?? 'Admin';

  if (!email || !password) {
    throw new Error(
      'ADMIN_EMAIL et ADMIN_PASSWORD doivent être définis dans le .env',
    );
  }

  // Idempotence : ne recrée pas si un admin existe déjà
  const existingAdmin = await prisma.user.findFirst({
    where: { role: Role.ADMIN },
  });

  if (existingAdmin) {
    console.log(`Un administrateur existe déjà (${existingAdmin.email}). Aucune action.`);
    return;
  }

  // Vérifie qu'aucun compte n'utilise déjà cet email
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    throw new Error(
      `Un compte existe déjà avec l'email ${email}. Choisissez un autre ADMIN_EMAIL.`,
    );
  }

  const passwordHash = await argon2.hash(password);

  const admin = await prisma.user.create({
    data: {
      email,
      passwordHash,
      firstName,
      role: Role.ADMIN,
      loyaltyAccount: { create: {} },
    },
  });

  console.log(`Administrateur créé : ${admin.email}`);
}

main()
  .catch((e) => {
    console.error('Erreur lors du seed :', e.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });