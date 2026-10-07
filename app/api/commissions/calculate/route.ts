import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { commissionPeriod, round2 } from '@/lib/billing';

// Calculate driver commissions for a period (26th of previous month – 25th of this month).
//
//  type "collection": tea collected from customers, net kilos × the price entered.
//  type "delivery":   tea taken to factories in our lorry, tea sent (kg) × the rate saved on each delivery.
//
// Each collection / delivery is counted in exactly one commission (driver_commission_id):
//  - Takes everything up to the 25th that is not yet in any commission,
//    including late entries from earlier periods.
//  - Paid commissions are never changed. Late items for a paid period go to the next period.
//  - Recalculating an unpaid commission re-collects its items (picks up new entries).
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { month, year, pricePerKilo } = body;
  const type = body.type === 'delivery' ? 'delivery' : 'collection';

  if (!month || !year) {
    return NextResponse.json({ error: 'Month and year are required' }, { status: 400 });
  }
  if (!Number.isInteger(month) || month < 1 || month > 12 || !Number.isInteger(year)) {
    return NextResponse.json({ error: 'Invalid month or year' }, { status: 400 });
  }
  const price = Number(pricePerKilo);
  if (type === 'collection' && (!Number.isFinite(price) || price <= 0)) {
    return NextResponse.json({ error: 'Price per kilo must be a number greater than 0' }, { status: 400 });
  }

  const period = commissionPeriod(month, year);

  const result = await prisma.$transaction(async (tx) => {
    const existing = await tx.driverCommission.findMany({ where: { month, year, type } });
    const paidDriverIds = new Set(existing.filter(c => c.paid).map(c => c.driverId));
    const unpaid = existing.filter(c => !c.paid);
    const unpaidIds = unpaid.map(c => c.id);

    // Release items held by unpaid commissions of this period, so they are counted fresh
    // Then group everything up to the 25th that is not in any commission yet, per driver
    const byDriver = new Map<number, { ids: number[]; kilos: number; amount: number }>();
    const add = (driverId: number, id: number, kilos: number, amount: number) => {
      if (paidDriverIds.has(driverId)) return; // paid period: late items wait for next period
      const entry = byDriver.get(driverId) || { ids: [], kilos: 0, amount: 0 };
      entry.ids.push(id);
      entry.kilos += kilos;
      entry.amount += amount;
      byDriver.set(driverId, entry);
    };

    if (type === 'collection') {
      if (unpaidIds.length > 0) {
        await tx.teaCollection.updateMany({ where: { driverCommissionId: { in: unpaidIds } }, data: { driverCommissionId: null } });
      }
      const eligible = await tx.teaCollection.findMany({
        where: {
          driverId: { not: null },
          driverCommissionId: null,
          kilosValidated: { not: null },
          collectionDate: { lt: period.endExclusive },
        },
        select: { id: true, driverId: true, kilosValidated: true },
      });
      for (const c of eligible) add(c.driverId!, c.id, c.kilosValidated as number, 0);
    } else {
      if (unpaidIds.length > 0) {
        await tx.factoryDelivery.updateMany({ where: { driverCommissionId: { in: unpaidIds } }, data: { driverCommissionId: null } });
      }
      const eligible = await tx.factoryDelivery.findMany({
        where: {
          transport: 'ours',
          driverId: { not: null },
          driverCommissionId: null,
          deliveryDate: { lt: period.endExclusive },
        },
        select: { id: true, driverId: true, teaSentKg: true, commissionPerKg: true },
      });
      for (const d of eligible) add(d.driverId!, d.id, d.teaSentKg, round2(d.teaSentKg * (d.commissionPerKg ?? 0)));
    }

    const saved = [];
    for (const [driverId, entry] of byDriver) {
      const totalKilos = round2(entry.kilos);
      const commissionAmount = type === 'collection' ? round2(totalKilos * price) : round2(entry.amount);
      // Delivery: each delivery keeps its own rate; show the average rate per kg
      const rate = type === 'collection' ? price : (totalKilos > 0 ? round2(commissionAmount / totalKilos) : 0);
      const data = { totalKilos, pricePerKilo: rate, commissionRate: 0, commissionAmount };
      const commission = await tx.driverCommission.upsert({
        where: { driverId_month_year_type: { driverId, month, year, type } },
        update: data,
        create: { driverId, month, year, type, ...data },
      });
      const link = { where: { id: { in: entry.ids }, driverCommissionId: null }, data: { driverCommissionId: commission.id } };
      if (type === 'collection') await tx.teaCollection.updateMany(link);
      else await tx.factoryDelivery.updateMany(link as Prisma.FactoryDeliveryUpdateManyArgs);
      saved.push(commission);
    }

    // Unpaid commissions that no longer have anything in them are removed
    const emptied = unpaid.filter(c => !byDriver.has(c.driverId));
    if (emptied.length > 0) {
      await tx.driverCommission.deleteMany({ where: { id: { in: emptied.map(c => c.id) }, paid: false } });
    }

    return { saved, skippedPaid: paidDriverIds.size };
  }, { timeout: 30000 });

  return NextResponse.json(result.saved, { headers: { 'X-Skipped-Paid': String(result.skippedPaid) } });
}
