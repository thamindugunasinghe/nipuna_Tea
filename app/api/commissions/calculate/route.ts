import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { month, year, pricePerKilo, commissionRate = 5 } = body;

  if (!month || !year || !pricePerKilo) {
    return NextResponse.json({ error: 'Month, year, and price per kilo are required' }, { status: 400 });
  }

  const drivers = await prisma.driver.findMany({ where: { active: true } });
  const results = [];

  for (const driver of drivers) {
    // Only count validated collections
    const collections = await prisma.teaCollection.findMany({
      where: { driverId: driver.id, month, year, kilosValidated: { not: null } },
    });

    const totalKilos = collections.reduce((sum, c) => sum + (c.kilosValidated as number), 0);
    if (totalKilos === 0) continue;

    // Commission = Total Kilos × Price × Rate%
    const commissionAmount = totalKilos * pricePerKilo * (commissionRate / 100);

    const commission = await prisma.driverCommission.upsert({
      where: { driverId_month_year: { driverId: driver.id, month, year } },
      update: { totalKilos, pricePerKilo, commissionRate, commissionAmount, paid: false },
      create: { driverId: driver.id, month, year, totalKilos, pricePerKilo, commissionRate, commissionAmount },
    });

    results.push(commission);
  }

  return NextResponse.json(results);
}
