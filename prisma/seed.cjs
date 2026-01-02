// prisma/seed.cjs
// Robust CommonJS seeder for Postgres/Neon (works locally & on Vercel)
require('dotenv').config();

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const DEFAULT_PASSWORD = process.env.SEED_PASSWORD || 'Password01';

// Prefer pooled Prisma URL; fall back to DATABASE_URL if you kept that alias
const pooledUrl = process.env.POSTGRES_PRISMA_URL || process.env.DATABASE_URL;
if (!pooledUrl) {
  console.error('[seed] Missing POSTGRES_PRISMA_URL (or DATABASE_URL). Check your .env');
  process.exit(1);
}

// Instantiate Prisma with explicit datasourceUrl to avoid env name drift
const prisma = new PrismaClient({ datasourceUrl: pooledUrl });

const toMinor = (amount, scale = 2) => BigInt(Math.round(Number(amount ?? 0) * Math.pow(10, scale)));

async function upsertUser({ email, name, role, office, password }) {
  const passwordHash = password ? await bcrypt.hash(password, 10) : null;
  return prisma.user.upsert({
    where: { email },
    update: {
      name,
      role,
      office,
      ...(passwordHash ? { passwordHash } : {}),
    },
    create: {
      email,
      name,
      role,
      office,
      passwordHash,
    },
  });
}

async function main() {
  // Connectivity probe (gives a clean error if DB is unreachable)
  await prisma.$queryRaw`SELECT 1`;

  const sharedPassword = DEFAULT_PASSWORD;

  // Users
  const system = await upsertUser({ email: 'system@local', name: 'System', role: 'ADMIN', office: 'HQ', password: null });

  await Promise.all([
    upsertUser({ email: 'qs@example.com', name: 'QS User', role: 'QS', office: 'Office A', password: sharedPassword }),
    upsertUser({ email: 'senior@example.com', name: 'Senior QS', role: 'SENIOR_QS', office: 'Office A', password: sharedPassword }),
    upsertUser({ email: 'sales@example.com', name: 'Sales User', role: 'SALES', office: 'Office A', password: sharedPassword }),
    upsertUser({ email: 'pm@example.com', name: 'Project Manager', role: 'PROJECT_MANAGER', office: 'Office A', password: sharedPassword }),
    upsertUser({ email: 'teamlead@example.com', name: 'Project Team Lead', role: 'PROJECT_TEAM', office: 'Office A', password: sharedPassword }),
    upsertUser({ email: 'seniorpm@example.com', name: 'Senior PM', role: 'SENIOR_PM', office: 'Office A', password: sharedPassword }),
   
    upsertUser({ email: 'admin@example.com', name: 'Admin', role: 'ADMIN', office: 'HQ', password: sharedPassword }),
    upsertUser({ email: 'client@example.com', name: 'Client', role: 'CLIENT', office: null, password: sharedPassword }),
    upsertUser({ email: 'procurement@example.com', name: 'Procurement', role: 'PROCUREMENT', office: 'Office A', password: sharedPassword }),
    upsertUser({ email: 'accounts@example.com', name: 'Accounts', role: 'ACCOUNTS', office: 'Office A', password: sharedPassword }),
    upsertUser({ email: 'security@example.com', name: 'Security', role: 'SECURITY', office: 'Office A', password: sharedPassword }),
    upsertUser({ email: 'driver@example.com', name: 'Driver', role: 'DRIVER', office: 'Office A', password: sharedPassword }),
    upsertUser({ email: 'accounting_clerk@example.com', name: 'Accounting Clerk', role: 'ACCOUNTING_CLERK', office: 'Office A', password: sharedPassword }),
    upsertUser({ email: 'accounting_officer@example.com', name: 'Accounting Officer', role: 'ACCOUNTING_OFFICER', office: 'Office A', password: sharedPassword }),
    upsertUser({ email: 'accounting_auditor@example.com', name: 'Accounting Auditor', role: 'ACCOUNTING_AUDITOR', office: 'Office A', password: sharedPassword }),
  ]);

  // Default customer
  const customer = await prisma.customer.upsert({
    where: { id: 'seed-default' },
    update: { displayName: 'Walk-in Customer',
       addressJson: { street: '—', city: '—' }, // object, not string
     },
    create: {
      id: 'seed-default',
      displayName: 'Walk-in Customer',
      email: null,
      phone: null,
      // On Postgres you can switch to Json if your schema uses it; for SQLite keep String
      addressJson: { street: '—', city: '—' }, // object, not string
    },
  });

  // Product (prefer basePriceMinor BigInt; fallback to legacy basePrice String if needed)
  try {
    await prisma.product.upsert({
      where: { sku: 'SAMPLE-001' },
      update: { name: 'Sample Item', unit: 'ea', basePriceMinor: toMinor(100), extraJson: null },
      create: { sku: 'SAMPLE-001', name: 'Sample Item', unit: 'ea', basePriceMinor: toMinor(100), extraJson: null },
    });
  } catch (e) {
    const msg = (e && e.message) || '';
    if (msg.includes('Unknown arg `basePriceMinor`') || msg.includes('no such column: basePriceMinor')) {
      console.warn('[seed] Falling back to legacy product schema (basePrice as String).');
      await prisma.product.upsert({
        where: { sku: 'SAMPLE-001' },
        update: { name: 'Sample Item', unit: 'ea', basePrice: '100.0000', extraJson: null },
        create: { sku: 'SAMPLE-001', name: 'Sample Item', unit: 'ea', basePrice: '100.0000', extraJson: null },
      });
    } else {
      throw e;
    }
  }

  console.log('[seed] Done:', { systemId: system.id, customerId: customer.id, defaultPassword: sharedPassword });
}

main()
  .catch((e) => {
    console.error('[seed] Failed:', e?.stack || e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });