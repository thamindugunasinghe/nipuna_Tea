import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { month, year, pricePerKilo } = body;

  if (!month || !year || !pricePerKilo) {
    return NextResponse.json({ error: 'Month, year, and price per kilo are required' }, { status: 400 });
  }

  const drivers = await prisma.driver.findMany({ 
    where: { active: true },
    include: {
      teaCollections: {
        where: { month, year, kilosValidated: { not: null } },
        select: { kilosValidated: true }
      }
    }
  });

  const upserts = drivers.map(driver => {
    const totalKilos = driver.teaCollections.reduce((sum, c) => sum + (c.kilosValidated as number), 0);
    if (totalKilos === 0) return null;

    const commissionAmount = totalKilos * pricePerKilo;

    return prisma.driverCommission.upsert({
      where: { driverId_month_year: { driverId: driver.id, month, year } },
      update: { totalKilos, pricePerKilo, commissionRate: 0, commissionAmount, paid: false },
      create: { driverId: driver.id, month, year, totalKilos, pricePerKilo, commissionRate: 0, commissionAmount },
    });
  }).filter((u): u is NonNullable<typeof u> => u !== null);

  const results = upserts.length > 0 ? await prisma.$transaction(upserts) : [];

  return NextResponse.json(results);
}
