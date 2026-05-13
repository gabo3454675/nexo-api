import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

/**
 * Poolers (Supabase, Neon, PgBouncer, etc.) → error `prepared statement "s0" already exists`.
 * Solución A: URL con `?pgbouncer=true` (Prisma deja de usar prepared statements).
 * Solución B: variable DIRECT_URL con Postgres **sin** pooler (puerto/host directo).
 */
function seedDatabaseUrl(): string {
  const direct = process.env.DIRECT_URL ?? process.env.DATABASE_URL_DIRECT;
  if (direct?.trim()) {
    return direct.trim();
  }

  const raw = process.env.DATABASE_URL;
  if (!raw?.trim()) {
    throw new Error('Define DATABASE_URL o DIRECT_URL en el entorno.');
  }

  try {
    const u = new URL(raw);
    if (!u.searchParams.has('pgbouncer')) {
      u.searchParams.set('pgbouncer', 'true');
    }
    return u.toString();
  } catch {
    const sep = raw.includes('?') ? '&' : '?';
    return raw.includes('pgbouncer=') ? raw : `${raw}${sep}pgbouncer=true`;
  }
}

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: seedDatabaseUrl(),
    },
  },
});

async function main() {
  const email = 'test@nexo.com';
  const password = 'Nexo1234!';
  const passwordHash = await bcrypt.hash(password, 10);

  const demoUser = await prisma.user.upsert({
    where: { email },
    update: {
      passwordHash,
      role: 'ADMIN',
      accountStatus: 'VERIFIED',
      isKycVerified: true,
      trustScore: 82,
      nexoPoints: 150,
      balance: 500,
      name: 'Usuario Demo NEXO',
    },
    create: {
      email,
      passwordHash,
      role: 'ADMIN',
      accountStatus: 'VERIFIED',
      isKycVerified: true,
      trustScore: 82,
      nexoPoints: 150,
      balance: 500,
      name: 'Usuario Demo NEXO',
    },
  });

  const sellerEmail = 'tecnico@nexo.com';
  const seller = await prisma.user.upsert({
    where: { email: sellerEmail },
    update: {
      passwordHash,
      role: 'TECHNICIAN',
      accountStatus: 'VERIFIED',
      isKycVerified: true,
      trustScore: 95,
      nexoPoints: 320,
      balance: 120,
      name: 'Técnico Caracas',
    },
    create: {
      email: sellerEmail,
      passwordHash,
      role: 'TECHNICIAN',
      accountStatus: 'VERIFIED',
      isKycVerified: true,
      trustScore: 95,
      nexoPoints: 320,
      balance: 120,
      name: 'Técnico Caracas',
    },
  });

  await prisma.listing.deleteMany({
    where: {
      ownerId: seller.id,
      title: {
        in: ['iPhone 14 Pro Max 256GB', 'Electricista certificado'],
      },
    },
  });

  await prisma.listing.createMany({
    data: [
      {
        ownerId: seller.id,
        type: 'PRODUCT',
        status: 'PUBLISHED',
        category: 'Tecnologia',
        location: 'CARACAS',
        title: 'iPhone 14 Pro Max 256GB',
        description: 'Equipo liberado, bateria 90%, incluye cargador y caja.',
        imageUrls: [
          'https://images.unsplash.com/photo-1678685888221-cda773a3dcdb?auto=format&fit=crop&w=800&q=80',
          'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?auto=format&fit=crop&w=800&q=80',
        ],
        priceAmount: 850,
        priceCurrency: 'USD',
        quantity: 1,
      },
      {
        ownerId: seller.id,
        type: 'SERVICE',
        status: 'PUBLISHED',
        category: 'Servicios del Hogar',
        location: 'GUATIRE',
        title: 'Electricista certificado',
        description: 'Visita a domicilio, diagnostico y reparacion residencial.',
        imageUrls: [
          'https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=800&q=80',
          'https://images.unsplash.com/photo-1621905252507-b35492cc74b4?auto=format&fit=crop&w=800&q=80',
        ],
        priceAmount: 35,
        priceCurrency: 'USD',
        serviceUnit: 'visita',
      },
    ],
  });

  console.log('Usuario de prueba listo:');
  console.log(`Email: ${email}`);
  console.log(`Password: ${password}`);
  console.log(`Seller: ${sellerEmail}`);
}

main()
  .catch(error => {
    console.error('Error sembrando usuario de prueba', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
