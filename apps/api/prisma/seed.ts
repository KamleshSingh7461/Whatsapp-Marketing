import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

/**
 * Production Database Seeder for FGSN WhatsApp ERP
 * 
 * Seeds the initial hierarchy:
 * 1. Super Admin (Full system ownership, WABA credentials, encryption keys, and user management)
 * 2. Operations Admin (Full operational control over campaigns, CRM, and automations)
 * 3. Marketing Manager (Broadcast campaigns, Template Studio, and audience cohorts)
 * 4. Customer Support Agents (Live shared inbox chats, customer care, and ticket resolution)
 */
async function main() {
  console.log('--- Starting FGSN Production Database Seeding ---');

  const superAdminEmail = process.env.SEED_SUPER_ADMIN_EMAIL ?? 'superadmin@fgsn.com';
  const superAdminPass = process.env.SEED_SUPER_ADMIN_PASSWORD ?? 'FGSN_SuperAdmin_2026!';
  const superAdminName = process.env.SEED_SUPER_ADMIN_NAME ?? 'FGSN Super Admin';

  const defaultUsers = [
    {
      email: superAdminEmail,
      name: superAdminName,
      password: superAdminPass,
      role: Role.ADMIN, // Admin role with super-admin privileges
    },
    {
      email: 'operations@fgsn.com',
      name: 'Operations Manager',
      password: process.env.SEED_ADMIN_PASSWORD ?? 'FGSN_Ops_2026!',
      role: Role.ADMIN,
    },
    {
      email: 'marketing@fgsn.com',
      name: 'Growth & Marketing Lead',
      password: process.env.SEED_MARKETER_PASSWORD ?? 'FGSN_Marketing_2026!',
      role: Role.MARKETER,
    },
    {
      email: 'support1@fgsn.com',
      name: 'Elena Vance (Support)',
      password: process.env.SEED_AGENT_PASSWORD ?? 'FGSN_Agent_2026!',
      role: Role.AGENT,
    },
    {
      email: 'support2@fgsn.com',
      name: 'Marcus Brody (Support)',
      password: process.env.SEED_AGENT_PASSWORD ?? 'FGSN_Agent_2026!',
      role: Role.AGENT,
    },
  ];

  for (const u of defaultUsers) {
    const existing = await prisma.user.findUnique({ where: { email: u.email } });
    if (existing) {
      console.log(`[EXISTS] User ${u.email} (${u.role}) already registered.`);
    } else {
      const passwordHash = await bcrypt.hash(u.password, 12);
      await prisma.user.create({
        data: {
          email: u.email,
          name: u.name,
          passwordHash,
          role: u.role,
        },
      });
      console.log(`[CREATED] User ${u.email} (${u.role}) seeded successfully.`);
    }
  }

  console.log('--- FGSN Database Seeding Complete ---');
}

main()
  .catch((err) => {
    console.error('Seeding error:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
