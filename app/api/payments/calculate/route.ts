import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { customerId, month, year, pricePerKilo, settledCreditIds } = body;

  if (!customerId || !month || !year || !pricePerKilo) {
    return NextResponse.json(
      { error: 'customerId, month, year, and pricePerKilo are required' },
      { status: 400 }
    );
  }

  // Get other deduction rate from settings
  const deductionSetting = await prisma.settings.findUnique({ where: { key: 'other_deduction_rate' } });
  const otherDeductionPct = deductionSetting ? parseFloat(deductionSetting.value) : 5;

  // Total validated tea kilos for the month
  const collections = await prisma.teaCollection.findMany({
    where: { customerId, month, year, kilosValidated: { not: null } },
  });
  const totalKilos = collections.reduce((sum, c) => sum + (c.kilosValidated as number), 0);

  if (totalKilos === 0) {
    return NextResponse.json(
      { error: 'No validated tea collections found for this month' },
      { status: 400 }
    );
  }

  // Get selected credit purchases to settle
  const creditIds: number[] = settledCreditIds || [];
  let groceryDeduction = 0;
  let fertiliserDeduction = 0;

  if (creditIds.length > 0) {
    const selectedCredits = await prisma.creditPurchase.findMany({
      where: { id: { in: creditIds }, customerId, settled: false },
    });

    groceryDeduction = selectedCredits
      .filter(c => c.itemType === 'grocery')
      .reduce((sum, c) => sum + c.totalCost, 0);

    fertiliserDeduction = selectedCredits
      .filter(c => c.itemType === 'fertiliser')
      .reduce((sum, c) => sum + c.totalCost, 0);
  }

  // Calculate payment
  const grossPayment = totalKilos * pricePerKilo;
  const otherDeductionAmt = grossPayment * (otherDeductionPct / 100);
  const netPayment = Math.max(0, grossPayment - groceryDeduction - fertiliserDeduction - otherDeductionAmt);

  // Upsert payment record
  const payment = await prisma.monthlyPayment.upsert({
    where: { customerId_month_year: { customerId, month, year } },
    update: {
      totalKilos,
      pricePerKilo,
      grossPayment,
      groceryDeduction,
      fertiliserDeduction,
      otherDeductionPct,
      otherDeductionAmt,
      netPayment,
      settledCreditIds: creditIds,
      paid: true,
      paidAt: new Date(),
    },
    create: {
      customerId,
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
      settledCreditIds: creditIds,
      paid: true,
      paidAt: new Date(),
    },
    include: { customer: true },
  });

  // Mark only the selected credits as settled and link to payment
  if (creditIds.length > 0) {
    await prisma.creditPurchase.updateMany({
      where: { id: { in: creditIds }, customerId },
      data: { settled: true, monthlyPaymentId: payment.id },
    });
  }

  // Fetch the settled credits for the response (for bill generation)
  const settledCredits = creditIds.length > 0
    ? await prisma.creditPurchase.findMany({
        where: { id: { in: creditIds } },
        include: { fertiliser: true },
        orderBy: { purchaseDate: 'asc' },
      })
    : [];

  // Fetch collections for the response
  const paymentCollections = await prisma.teaCollection.findMany({
    where: { customerId, month, year, kilosValidated: { not: null } },
    include: { driver: true },
    orderBy: { collectionDate: 'asc' },
  });

  return NextResponse.json({
    payment,
    collections: paymentCollections,
    settledCredits,
  });
}
