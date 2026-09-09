import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

// Creates the first Super Admin so there's someone who can log in and start
// creating companies (§04 of the plan). Change the password immediately.
async function main() {
  const email = process.env.SEED_SUPER_ADMIN_EMAIL ?? 'admin@example.com';
  const password = process.env.SEED_SUPER_ADMIN_PASSWORD ?? 'change-me-now-12345';

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`Super Admin ${email} already exists — skipping.`);
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.user.create({
    data: {
      email,
      name: 'Super Admin',
      passwordHash,
      role: Role.SUPER_ADMIN,
    },
  });

  console.log(`Created Super Admin ${email} — log in and change the password.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
