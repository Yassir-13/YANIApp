import { PrismaClient, Role } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

// Plages de départ, modifiables ensuite depuis le backoffice (page Horaires).
// 0 = dimanche … 6 = samedi. Le dimanche n'a aucune plage : c'est ce qui dit
// qu'un jour est fermé.
//
// Une pause déjeuner est posée d'emblée plutôt qu'une journée continue : c'est
// le fonctionnement réel d'un institut, et ça rend le mécanisme visible dès la
// première ouverture de la page.
const HORAIRES_PAR_DEFAUT = [
  { dayOfWeek: 1, startTime: '09:00', endTime: '13:00' },
  { dayOfWeek: 1, startTime: '14:00', endTime: '18:00' },
  { dayOfWeek: 2, startTime: '09:00', endTime: '13:00' },
  { dayOfWeek: 2, startTime: '14:00', endTime: '18:00' },
  { dayOfWeek: 3, startTime: '09:00', endTime: '13:00' },
  { dayOfWeek: 3, startTime: '14:00', endTime: '18:00' },
  { dayOfWeek: 4, startTime: '09:00', endTime: '13:00' },
  { dayOfWeek: 4, startTime: '14:00', endTime: '18:00' },
  { dayOfWeek: 5, startTime: '09:00', endTime: '13:00' },
  { dayOfWeek: 5, startTime: '14:00', endTime: '19:00' },
  { dayOfWeek: 6, startTime: '09:00', endTime: '13:00' },
  { dayOfWeek: 6, startTime: '14:00', endTime: '19:00' },
];

// Sans une seule ligne dans `opening_hours`, le centre est considéré fermé tous
// les jours : la recherche de créneaux renvoie `closed: true` partout et aucune
// cliente ne peut réserver. Une installation neuve était donc muette jusqu'à ce
// que quelqu'un pense à ouvrir la page Horaires.
//
// ⚠️ Le garde-fou est un comptage, et non plus `skipDuplicates`. Depuis que le
// modèle porte plusieurs plages par jour, « déjà présent » ne veut plus rien
// dire ligne à ligne : si Fati a réglé le lundi sur 10h-16h, insérer en
// « ignorant les doublons » lui AJOUTERAIT 9h-13h et 14h-18h, qui chevauchent
// ses vraies heures. Table non vide = installation en service, on ne touche à
// rien.
async function seedHoraires() {
  const dejaConfigurees = await prisma.openingHours.count();
  if (dejaConfigurees > 0) {
    console.log("Horaires d'ouverture déjà configurés. Aucune action.");
    return;
  }

  const { count } = await prisma.openingHours.createMany({
    data: HORAIRES_PAR_DEFAUT,
  });
  console.log(`Horaires d'ouverture créés : ${count} plages.`);
}

async function main() {
  await seedHoraires();

  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  const firstName = process.env.ADMIN_FIRST_NAME ?? 'Admin';
  const lastName = process.env.ADMIN_LAST_NAME ?? 'Institut';
  const phone = process.env.ADMIN_PHONE ?? null;

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

  // `emailVerifiedAt` est daté d'emblée : ce compte n'est pas né d'une
  // inscription, personne ne lui enverra de code. Sans lui, le backoffice
  // affichait « non vérifié » à côté du compte de la gérante — un doute inutile
  // sur le seul compte qui ne peut pas en faire l'objet.
  //
  // Nom et téléphone suivent la même logique : ils sont obligatoires à
  // l'inscription, un compte administrateur incomplet dénotait dans la liste.
  const admin = await prisma.user.create({
    data: {
      email,
      passwordHash,
      firstName,
      lastName,
      phone,
      emailVerifiedAt: new Date(),
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