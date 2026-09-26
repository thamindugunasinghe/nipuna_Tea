import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const customerId = parseInt(searchParams.get('customerId') || '0');
  const month = parseInt(searchParams.get('month') || String(new Date().getMonth() + 1));
  const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()));
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');

  if (!customerId) {
    return NextResponse.json({ error: 'customerId is required' }, { status: 400 });
  }

  const customer = await prisma.customer.findUnique({ where: { id: customerId } });
  if (!customer) {
    return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
  }

  // Run queries in parallel to drastically improve performance
  const [
    collections,
    pendingCredits,
    settings,
    existingPayment
  ] = await Promise.all([
    // 1. Get all tea collections for the date range
    prisma.teaCollection.findMany({
      where: { 
        customerId, 
        collectionDate: { 
          lte: endDate ? new Date(`${endDate}T23:59:59.999Z`) : new Date(year, month, 0, 23, 59, 59, 999) 
        },
        monthlyPaid: false,
        instantPaid: false,
      },
      include: { driver: true, lorry: true },
      orderBy: { collectionDate: 'asc' },
    }),
    // 2. Get ALL pending credit purchases
    prisma.creditPurchase.findMany({
      where: {
        customerId,
        settled: false,
        purchaseDate: {
          lte: endDate ? new Date(`${endDate}T23:59:59.999Z`) : new Date(year, month, 0, 23, 59, 59, 999)
        },
      },
      include: { fertiliser: true },
      orderBy: { purchaseDate: 'asc' },
    }),
    // 3. Batch fetch settings
    prisma.settings.findMany({
      where: { key: { in: ['tea_price_per_kilo', 'transport_cost_per_kilo', 'stamp_cost_per_kilo', 'other_deduction_pct'] } }
    }),
    // 4. Existing payment for this month
    prisma.monthlyPayment.findUnique({
      where: { customerId_month_year: { customerId, month, year } },
      include: { 
        settledCredits: { include: { fertiliser: true } }, 
        settledCollections: { include: { driver: true, lorry: true }, orderBy: { collectionDate: 'asc' } } 
      }
    })
  ]);

  let finalCollections = collections;
  let finalPendingCredits = pendingCredits;

  const isPending = collections.length > 0 || pendingCredits.length > 0;

  if (existingPayment && !isPending) {
    finalCollections = existingPayment.settledCollections;
    finalPendingCredits = existingPayment.settledCredits;
  }

  const getSetting = (key: string, def: number) => {
    const s = settings.find(x => x.key === key);
    return s ? parseFloat(s.value) : def;
  };

  const defaultPricePerKilo = getSetting('tea_price_per_kilo', 0);
  const transportCostPerKilo = getSetting('transport_cost_per_kilo', 6);
  const stampCostPerKilo = getSetting('stamp_cost_per_kilo', 0);
  const otherDeductionPct = getSetting('other_deduction_pct', 5);

  // Calculate totals
  const totalValidatedKilos = finalCollections
    .filter(c => c.kilosValidated != null)
    .reduce((sum, c) => sum + (c.kilosValidated as number), 0);

  const lorryKilos = finalCollections
    .filter(c => c.kilosValidated != null && c.lorryId !== null)
    .reduce((sum, c) => sum + (c.kilosValidated as number), 0);

  const totalPendingCredit = finalPendingCredits.reduce((sum, p) => sum + p.totalCost, 0);

  return NextResponse.json({
    customer,
    collections: finalCollections,
    pendingCredits: finalPendingCredits,
    defaultPricePerKilo,
    transportCostPerKilo,
    stampCostPerKilo,
    otherDeductionPct,
    totalValidatedKilos,
    lorryKilos,
    totalPendingCredit,
    existingPayment,
  });
}
