import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { round2 } from '@/lib/billing';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { month, year, pricePerKilo } = body;

  if (!month || !year || !pricePerKilo) {
    return NextResponse.json({ error: 'Month, year, and price per kilo are required' }, { status: 400 });
  }
  if (!Number.isFinite(Number(pricePerKilo)) || Number(pricePerKilo) <= 0) {
    return NextResponse.json({ error: 'Price per kilo must be a number greater than 0' }, { status: 400 });
  }

  // Commissions already marked paid are never changed by recalculating
  // (otherwise they would flip back to unpaid and the driver could be paid twice)
  const paidAlready = await prisma.driverCommission.findMany({
    where: { month, year, paid: true },
    select: { driverId: true },
  });
  const paidDriverIds = new Set(paidAlready.map(c => c.driverId));

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
    if (paidDriverIds.has(driver.id)) return null;

    const totalKilos = round2(driver.teaCollections.reduce((sum, c) => sum + (c.kilosValidated as number), 0));
    if (totalKilos === 0) return null;

    const commissionAmount = round2(totalKilos * pricePerKilo);

    return prisma.driverCommission.upsert({
      where: { driverId_month_year: { driverId: driver.id, month, year } },
      update: { totalKilos, pricePerKilo, commissionRate: 0, commissionAmount },
      create: { driverId: driver.id, month, year, totalKilos, pricePerKilo, commissionRate: 0, commissionAmount },
    });
  }).filter((u): u is NonNullable<typeof u> => u !== null);

  const results = upserts.length > 0 ? await prisma.$transaction(upserts) : [];

  // Response stays an array of updated commissions; skippedPaid tells the page how many were left alone
  return NextResponse.json(results, { headers: { 'X-Skipped-Paid': String(paidDriverIds.size) } });
}
