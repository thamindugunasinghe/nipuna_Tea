import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { commissionPeriod } from '@/lib/billing';

// GET ?month=10&year=2026&type=collection|delivery — commissions for the period 26 Sep – 25 Oct,
// each with the collections (or factory deliveries) it pays for
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const month = parseInt(searchParams.get('month') || String(new Date().getMonth() + 1));
  const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()));
  const type = searchParams.get('type') === 'delivery' ? 'delivery' : 'collection';

  if (!Number.isInteger(month) || month < 1 || month > 12 || !Number.isInteger(year)) {
    return NextResponse.json({ error: 'Invalid month or year' }, { status: 400 });
  }

  const period = commissionPeriod(month, year);

  const commissions = await prisma.driverCommission.findMany({
    where: { month, year, type },
    include: {
      driver: { select: { id: true, name: true, phone: true } },
      collections: type === 'collection' ? {
        select: {
          id: true,
          collectionDate: true,
          kilosByDriver: true,
          waterDeduction: true,
          packagingDeduction: true,
          kilosValidated: true,
          customer: { select: { name: true, customerId: true } },
        },
        orderBy: { collectionDate: 'asc' },
      } : false,
      deliveries: type === 'delivery' ? {
        select: {
          id: true,
          deliveryDate: true,
          teaSentKg: true,
          commissionPerKg: true,
          factory: { select: { name: true } },
          lorry: { select: { lorryNumber: true } },
        },
        orderBy: { deliveryDate: 'asc' },
      } : false,
    },
    orderBy: { commissionAmount: 'desc' },
  });

  return NextResponse.json({
    period: { start: period.start, end: period.end },
    commissions: commissions.map(c => ({
      ...c,
      // Before this period but added late (not paid in an earlier commission)
      collections: (c.collections || []).map(col => ({ ...col, late: col.collectionDate < period.start })),
      deliveries: (c.deliveries || []).map(d => ({ ...d, late: d.deliveryDate < period.start })),
    })),
  });
}
