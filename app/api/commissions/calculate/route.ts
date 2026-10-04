import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { commissionPeriod, round2 } from '@/lib/billing';

// Calculate driver commissions for a period (26th of previous month – 25th of this month), on net kilos.
//
// Each collection is counted in exactly one commission (tea_collections.driver_commission_id):
//  - Takes every collection up to the 25th that is not yet in any commission,
//    including late entries from earlier periods.
//  - Paid commissions are never changed. Late tea for a paid period goes to the next period.
//  - Recalculating an unpaid commission re-collects its tea (picks up new entries).
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { month, year, pricePerKilo } = body;

  if (!month || !year || !pricePerKilo) {
    return NextResponse.json({ error: 'Month, year, and price per kilo are required' }, { status: 400 });
  }
  if (!Number.isInteger(month) || month < 1 || month > 12 || !Number.isInteger(year)) {
    return NextResponse.json({ error: 'Invalid month or year' }, { status: 400 });
  }
  const price = Number(pricePerKilo);
  if (!Number.isFinite(price) || price <= 0) {
    return NextResponse.json({ error: 'Price per kilo must be a number greater than 0' }, { status: 400 });
  }

  const period = commissionPeriod(month, year);

  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.driverCommission.findMany({ where: { month, year } });
    const paidDriverIds = new Set(existing.filter(c => c.paid).map(c => c.driverId));
    const unpaid = existing.filter(c => !c.paid);

    // Release tea held by unpaid commissions of this period, so it is counted fresh
    if (unpaid.length > 0) {
      await tx.teaCollection.updateMany({
        where: { driverCommissionId: { in: unpaid.map(c => c.id) } },
        data: { driverCommissionId: null },
      });
    }

    // All tea up to the 25th that is not in any commission yet
    const eligible = await tx.teaCollection.findMany({
      where: {
        driverId: { not: null },
        driverCommissionId: null,
        kilosValidated: { not: null },
        collectionDate: { lt: period.endExclusive },
      },
      select: { id: true, driverId: true, kilosValidated: true },
    });

    const byDriver = new Map<number, { ids: number[]; kilos: number }>();
    for (const c of eligible) {
      if (paidDriverIds.has(c.driverId!)) continue; // paid period: their late tea waits for next period
      const entry = byDriver.get(c.driverId!) || { ids: [], kilos: 0 };
      entry.ids.push(c.id);
      entry.kilos += c.kilosValidated as number;
      byDriver.set(c.driverId!, entry);
    }

    const saved = [];
    for (const [driverId, { ids, kilos }] of byDriver) {
      const totalKilos = round2(kilos);
      const commissionAmount = round2(totalKilos * price);
      const commission = await tx.driverCommission.upsert({
        where: { driverId_month_year: { driverId, month, year } },
        update: { totalKilos, pricePerKilo: price, commissionRate: 0, commissionAmount },
        create: { driverId, month, year, totalKilos, pricePerKilo: price, commissionRate: 0, commissionAmount },
      });
      await tx.teaCollection.updateMany({
        where: { id: { in: ids }, driverCommissionId: null },
        data: { driverCommissionId: commission.id },
      });
      saved.push(commission);
    }

    // Unpaid commissions that no longer have any tea are removed
    const emptied = unpaid.filter(c => !byDriver.has(c.driverId));
    if (emptied.length > 0) {
      await tx.driverCommission.deleteMany({ where: { id: { in: emptied.map(c => c.id) }, paid: false } });
    }

    return { saved, skippedPaid: paidDriverIds.size };
  }, { timeout: 30000 });

  return NextResponse.json(result.saved, { headers: { 'X-Skipped-Paid': String(result.skippedPaid) } });
}
