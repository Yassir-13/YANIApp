import { PrismaClient, Role } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
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