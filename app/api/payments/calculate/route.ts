import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { month, year, pricePerKilo } = body;

  if (!month || !year || !pricePerKilo) {
    return NextResponse.json({ error: 'Month, year, and price per kilo are required' }, { status: 400 });
  }

  // Get all active regular customers
  const customers = await prisma.customer.findMany({
    where: { active: true, type: 'regular' },
  });

  const results = [];

  for (const customer of customers) {
    // Total tea kilos for the month (use validated if available, otherwise driver kilos)
    const collections = await prisma.teaCollection.findMany({
      where: { customerId: customer.id, month, year },
    });

    const totalKilos = collections.reduce((sum, c) => sum + (c.kilosValidated || c.kilosByDriver), 0);
    if (totalKilos === 0) continue;

    // Grocery deductions for the month
    const groceryPurchases = await prisma.creditPurchase.findMany({
      where: { customerId: customer.id, month, year, itemType: 'grocery', settled: false },
    });
    const groceryDeduction = groceryPurchases.reduce((sum, p) => sum + p.totalCost, 0);

    // Fertiliser deductions for the month
    const fertiliserPurchases = await prisma.creditPurchase.findMany({
      where: { customerId: customer.id, month, year, itemType: 'fertiliser', settled: false },
    });
    const fertiliserDeduction = fertiliserPurchases.reduce((sum, p) => sum + p.totalCost, 0);

    // Calculate
    const grossPayment = totalKilos * pricePerKilo;
    const otherDeductionPct = 5; // 5% as specified in SRS
    const otherDeductionAmt = grossPayment * (otherDeductionPct / 100);
    const netPayment = Math.max(0, grossPayment - groceryDeduction - fertiliserDeduction - otherDeductionAmt);

    // Upsert payment record
    const payment = await prisma.monthlyPayment.upsert({
      where: { customerId_month_year: { customerId: customer.id, month, year } },
      update: {
        totalKilos,
        pricePerKilo,
        grossPayment,
        groceryDeduction,
        fertiliserDeduction,
        otherDeductionPct,
        otherDeductionAmt,
        netPayment,
        paid: false,
      },
      create: {
        customerId: customer.id,
        month,
        year,
        totalKilos,
        pricePerKilo,
        grossPayment,
        groceryDeduction,
        fertiliserDeduction,
        otherDeductionPct,
        otherDeductionAmt,
        netPayment,
      },
    });

    // Mark credit purchases as settled
    await prisma.creditPurchase.updateMany({
      where: { customerId: customer.id, month, year, settled: false },
      data: { settled: true },
    });

    results.push(payment);
  }

  return NextResponse.json(results);
}
