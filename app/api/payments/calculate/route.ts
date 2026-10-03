import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { sendMonthlyPaymentSms } from '@/lib/sms';
import { round2 } from '@/lib/billing';

// Thrown inside the transaction when a collection/credit was paid by another request meanwhile
class AlreadyPaidError extends Error {}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { customerId, month, year, startDate, endDate, pricePerKilo, settledCreditIds, settledCollectionIds, shortfallAction } = body;

  if (!customerId || !month || !year || !pricePerKilo) {
    return NextResponse.json(
      { error: 'customerId, month, year, and pricePerKilo are required' },
      { status: 400 }
    );
  }
  if (!Number.isFinite(Number(pricePerKilo)) || Number(pricePerKilo) <= 0) {
    return NextResponse.json({ error: 'pricePerKilo must be a number greater than 0' }, { status: 400 });
  }
  if (!Number.isInteger(month) || month < 1 || month > 12 || !Number.isInteger(year)) {
    return NextResponse.json({ error: 'Invalid month or year' }, { status: 400 });
  }
  if (shortfallAction != null && shortfallAction !== 'cash' && shortfallAction !== 'carry_forward') {
    return NextResponse.json({ error: 'Invalid shortfallAction' }, { status: 400 });
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
      kilosValidated: { not: null },
      // Only unpaid collections: a double click / retry can't bill the same tea twice
      monthlyPaid: false,
      instantPaid: false,
    },
    include: { driver: true },
    orderBy: { collectionDate: 'asc' },
  });
  const totalKilos = round2(collections.reduce((sum, c) => sum + (c.kilosValidated as number), 0));

  if (totalKilos === 0) {
    return NextResponse.json(
      { error: 'No validated tea collections found for this month' },
      { status: 400 }
    );
  }

  // Calculate transport cost: only for lorry collections (lorryId is not null)
  const lorryKilos = round2(collections
    .filter(c => c.lorryId !== null)
    .reduce((sum, c) => sum + (c.kilosValidated as number), 0));
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

    groceryDeduction = round2(selectedCredits
      .filter(c => c.itemType === 'grocery')
      .reduce((sum, c) => sum + c.totalCost, 0));

    fertiliserDeduction = round2(selectedCredits
      .filter(c => c.itemType === 'fertiliser')
      .reduce((sum, c) => sum + c.totalCost, 0));

    cashAdvanceDeduction = round2(selectedCredits
      .filter(c => c.itemType === 'cash_advance')
      .reduce((sum, c) => sum + c.totalCost, 0));
  }

  // Calculate payment
  // All money rounded to 2 decimals (same maths as the popup preview)
  const grossPayment = round2(totalKilos * pricePerKilo);
  const otherDeductionAmt = Math.round(grossPayment * (otherDeductionPct / 100) * 100) / 100;
  
  const totalDeductions = groceryDeduction + fertiliserDeduction + cashAdvanceDeduction + transportCostTotal + stampCostTotal + otherDeductionAmt;
  const netPayment = round2(Math.max(0, grossPayment - totalDeductions));

  const availableForDeduction = round2(Math.max(0, grossPayment - transportCostTotal - stampCostTotal - otherDeductionAmt));
  const creditDeductionRequested = groceryDeduction + fertiliserDeduction + cashAdvanceDeduction;
  const shortfall = round2(Math.max(0, creditDeductionRequested - availableForDeduction));
  
  let cashReceived = 0;
  if (shortfall > 0 && shortfallAction === 'cash') {
    cashReceived = shortfall;
  }

  // All writes in one transaction: payment, settled credits, carry-forward and paid collections
  // either all save or none do.
  const payment = await prisma.$transaction(async (tx) => {
    // Accumulate with existing payment if it exists
    const existingPayment = await tx.monthlyPayment.findUnique({
      where: { customerId_month_year: { customerId, month, year } }
    });

    let mergedCreditIds = creditIds;
    if (existingPayment?.settledCreditIds) {
      const oldIds = existingPayment.settledCreditIds as number[];
      mergedCreditIds = Array.from(new Set([...oldIds, ...creditIds]));
    }

    const payment = await tx.monthlyPayment.upsert({
      where: { customerId_month_year: { customerId, month, year } },
      update: {
        totalKilos: { increment: totalKilos },
        grossPayment: { increment: grossPayment },
        groceryDeduction: { increment: groceryDeduction },
        fertiliserDeduction: { increment: fertiliserDeduction },
        cashAdvanceDeduction: { increment: cashAdvanceDeduction },
        transportCostTotal: { increment: transportCostTotal },
        stampCostTotal: { increment: stampCostTotal },
        otherDeductionAmt: { increment: otherDeductionAmt },
        netPayment: { increment: netPayment },
        cashReceived: { increment: cashReceived },
        settledCreditIds: mergedCreditIds,
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
        cashReceived,
        settledCreditIds: mergedCreditIds,
        paid: true,
        paidAt: new Date(),
      },
      include: { customer: true },
    });

    // Mark only the selected credits as settled and link to payment
    if (selectedCredits.length > 0) {
      const settledNow = await tx.creditPurchase.updateMany({
        where: { id: { in: selectedCredits.map(c => c.id) }, customerId, settled: false },
        data: { settled: true, monthlyPaymentId: payment.id },
      });
      if (settledNow.count !== selectedCredits.length) throw new AlreadyPaidError();
    }

    // If carry forward, create a new credit purchase for the shortfall
    if (shortfall > 0 && shortfallAction === 'carry_forward') {
      // Next month calculation
      let nextMonth = month + 1;
      let nextYear = year;
      if (nextMonth > 12) {
        nextMonth = 1;
        nextYear += 1;
      }
      await tx.creditPurchase.create({
        data: {
          customerId,
          itemType: 'cash_advance',
          description: 'Brought forward from previous month',
          quantity: 1,
          unitPrice: shortfall,
          totalCost: shortfall,
          month: nextMonth,
          year: nextYear,
          settled: false,
        }
      });
    }

    // Mark collections as paid and link to payment
    if (collections.length > 0) {
      const paidNow = await tx.teaCollection.updateMany({
        where: { id: { in: collections.map(c => c.id) }, customerId, monthlyPaid: false },
        data: { monthlyPaid: true, monthlyPaymentId: payment.id },
      });
      if (paidNow.count !== collections.length) throw new AlreadyPaidError();
    }

    return payment;
  }, { timeout: 20000 }).catch((err) => {
    if (err instanceof AlreadyPaidError) return null;
    throw err;
  });

  if (!payment) {
    return NextResponse.json(
      { error: 'This payment was already processed. Please refresh. / මෙම ගෙවීම දැනටමත් සිදු කර ඇත.' },
      { status: 409 }
    );
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
      netPayment,
      cashReceived,
      shortfall > 0 && shortfallAction === 'carry_forward' ? shortfall : 0
    ).catch(err => console.error('[SMS] Monthly payment SMS error:', err));
  }

  return NextResponse.json({
    payment, // month record (running total for the month)
    // This payment only — what the receipt should show (same numbers as the SMS)
    thisPayment: {
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
      otherDeductionAmt,
      netPayment,
      cashReceived,
      shortfall,
      shortfallAction: shortfall > 0 ? shortfallAction : null,
    },
    collections,
    settledCredits: selectedCredits,
  });
}
