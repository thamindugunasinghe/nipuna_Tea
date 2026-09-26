import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { sendMonthlyPaymentSms } from '@/lib/sms';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { customerId, month, year, startDate, endDate, pricePerKilo, settledCreditIds, settledCollectionIds } = body;

  if (!customerId || !month || !year || !pricePerKilo) {
    return NextResponse.json(
      { error: 'customerId, month, year, and pricePerKilo are required' },
      { status: 400 }
    );
  }

  // Get cost settings (Batched query)
  const settings = await prisma.settings.findMany({
    where: { key: { in: ['transport_cost_per_kilo', 'stamp_cost_per_kilo', 'other_deduction_pct'] } }
  });
  
  const getSetting = (key: string, def: number) => {
    const s = settings.find(x => x.key === key);
    return s ? parseFloat(s.value) : def;
  };
  
  const transportCostPerKilo = getSetting('transport_cost_per_kilo', 6);
  const stampCostPerKilo = getSetting('stamp_cost_per_kilo', 0);
  const otherDeductionPct = getSetting('other_deduction_pct', 5);

  const collectionIds: number[] = settledCollectionIds || [];
  const collections = await prisma.teaCollection.findMany({
    where: { 
      id: { in: collectionIds },
      customerId, 
      kilosValidated: { not: null } 
    },
    include: { driver: true },
    orderBy: { collectionDate: 'asc' },
  });
  const totalKilos = collections.reduce((sum, c) => sum + (c.kilosValidated as number), 0);

  if (totalKilos === 0) {
    return NextResponse.json(
      { error: 'No validated tea collections found for this month' },
      { status: 400 }
    );
  }

  // Calculate transport cost: only for lorry collections (lorryId is not null)
  const lorryKilos = collections
    .filter(c => c.lorryId !== null)
    .reduce((sum, c) => sum + (c.kilosValidated as number), 0);
  const transportCostTotal = Math.round(lorryKilos * transportCostPerKilo * 100) / 100;

  // Stamp cost: applies to ALL collections
  const stampCostTotal = Math.round(totalKilos * stampCostPerKilo * 100) / 100;

  // Get selected credit purchases to settle
  const creditIds: number[] = settledCreditIds || [];
  let groceryDeduction = 0;
  let fertiliserDeduction = 0;
  let cashAdvanceDeduction = 0;
  let selectedCredits: any[] = [];

  if (creditIds.length > 0) {
    selectedCredits = await prisma.creditPurchase.findMany({
      where: { id: { in: creditIds }, customerId, settled: false },
      include: { fertiliser: true },
      orderBy: { purchaseDate: 'asc' },
    });

    groceryDeduction = selectedCredits
      .filter(c => c.itemType === 'grocery')
      .reduce((sum, c) => sum + c.totalCost, 0);

    fertiliserDeduction = selectedCredits
      .filter(c => c.itemType === 'fertiliser')
      .reduce((sum, c) => sum + c.totalCost, 0);

    cashAdvanceDeduction = selectedCredits
      .filter(c => c.itemType === 'cash_advance')
      .reduce((sum, c) => sum + c.totalCost, 0);
  }

  // Calculate payment
  const grossPayment = totalKilos * pricePerKilo;
  const otherDeductionAmt = Math.round(grossPayment * (otherDeductionPct / 100) * 100) / 100;
  
  const totalDeductions = groceryDeduction + fertiliserDeduction + cashAdvanceDeduction + transportCostTotal + stampCostTotal + otherDeductionAmt;
  const netPayment = Math.max(0, grossPayment - totalDeductions);

  // Upsert payment record
  const payment = await prisma.monthlyPayment.upsert({
    where: { customerId_month_year: { customerId, month, year } },
    update: {
      totalKilos,
      pricePerKilo,
      grossPayment,
      groceryDeduction,
      fertiliserDeduction,
      cashAdvanceDeduction,
      transportCostPerKilo,
      transportCostTotal,
      stampCostPerKilo,
      stampCostTotal,
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
      cashAdvanceDeduction,
      transportCostPerKilo,
      transportCostTotal,
      stampCostPerKilo,
      stampCostTotal,
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

  // Mark collections as paid and link to payment
  if (collections.length > 0) {
    await prisma.teaCollection.updateMany({
      where: { id: { in: collections.map(c => c.id) }, customerId },
      data: { monthlyPaid: true, monthlyPaymentId: payment.id },
    });
  }

  // Send SMS notification to customer (async, non-blocking)
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  if (payment.customer?.phone) {
    sendMonthlyPaymentSms(
      payment.customer.name,
      payment.customer.phone,
      monthNames[month - 1],
      year,
      totalKilos,
      pricePerKilo,
      grossPayment,
      groceryDeduction,
      fertiliserDeduction,
      cashAdvanceDeduction,
      transportCostTotal + stampCostTotal + otherDeductionAmt,
      netPayment
    ).catch(err => console.error('[SMS] Monthly payment SMS error:', err));
  }

  return NextResponse.json({
    payment,
    collections,
    settledCredits: selectedCredits,
  });
}
