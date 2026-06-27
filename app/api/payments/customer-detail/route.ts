import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const customerId = parseInt(searchParams.get('customerId') || '0');
  const month = parseInt(searchParams.get('month') || String(new Date().getMonth() + 1));
  const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()));

  if (!customerId) {
    return NextResponse.json({ error: 'customerId is required' }, { status: 400 });
  }

  const customer = await prisma.customer.findUnique({ where: { id: customerId } });
  if (!customer) {
    return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
  }

  // Get all tea collections for the month (validated only count towards payment)
  const collections = await prisma.teaCollection.findMany({
    where: { customerId, month, year },
    include: { driver: true, lorry: true },
    orderBy: { collectionDate: 'asc' },
  });

  // Get ALL pending credit purchases (from any month up to current)
  const pendingCredits = await prisma.creditPurchase.findMany({
    where: {
      customerId,
      settled: false,
      OR: [
        { year: { lt: year } },
        { year, month: { lte: month } },
      ],
    },
    include: { fertiliser: true },
    orderBy: { purchaseDate: 'asc' },
  });

  // Get default price from settings
  const priceSetting = await prisma.settings.findUnique({ where: { key: 'tea_price_per_kilo' } });
  const defaultPricePerKilo = priceSetting ? parseFloat(priceSetting.value) : 0;

  // Get other deduction rate from settings
  const deductionSetting = await prisma.settings.findUnique({ where: { key: 'other_deduction_rate' } });
  const otherDeductionRate = deductionSetting ? parseFloat(deductionSetting.value) : 5;

  // Calculate totals
  const totalValidatedKilos = collections
    .filter(c => c.kilosValidated != null)
    .reduce((sum, c) => sum + (c.kilosValidated as number), 0);

  const totalPendingCredit = pendingCredits.reduce((sum, p) => sum + p.totalCost, 0);

  // Existing payment for this month
  const existingPayment = await prisma.monthlyPayment.findUnique({
    where: { customerId_month_year: { customerId, month, year } },
  });

  return NextResponse.json({
    customer,
    collections,
    pendingCredits,
    defaultPricePerKilo,
    otherDeductionRate,
    totalValidatedKilos,
    totalPendingCredit,
    existingPayment,
  });
}
