import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const startDateParam = searchParams.get('startDate');
  const endDateParam = searchParams.get('endDate');
  const monthParam = searchParams.get('month');
  const yearParam = searchParams.get('year');

  // Determine date range
  let startDate: Date;
  let endDate: Date;

  if (startDateParam && endDateParam) {
    startDate = new Date(startDateParam);
    startDate.setHours(0, 0, 0, 0);
    endDate = new Date(endDateParam);
    endDate.setHours(23, 59, 59, 999);
  } else {
    // Fallback to month/year
    const month = parseInt(monthParam || String(new Date().getMonth() + 1));
    const year = parseInt(yearParam || String(new Date().getFullYear()));
    startDate = new Date(year, month - 1, 1);
    endDate = new Date(year, month, 0, 23, 59, 59, 999);
  }

  const paymentMonth = startDate.getMonth() + 1;
  const paymentYear = startDate.getFullYear();

  // Get all active regular customers with their filtered data in ONE query
  const customers = await prisma.customer.findMany({
    where: { active: true, type: 'regular' },
    orderBy: { name: 'asc' },
    include: {
      teaCollections: {
        where: {
          collectionDate: { lte: endDate },
          kilosValidated: { not: null },
          monthlyPaid: false,
          instantPaid: false,
        },
        select: { kilosValidated: true },
      },
      creditPurchases: {
        where: {
          settled: false,
          purchaseDate: { lte: endDate },
        },
        select: { totalCost: true },
      },
      monthlyPayments: {
        where: {
          month: paymentMonth,
          year: paymentYear,
        },
      },
    },
  });

  const results = [];

  for (const customer of customers) {
    const existingPayment = customer.monthlyPayments[0] || null;
    const totalKilos = existingPayment 
      ? existingPayment.totalKilos 
      : customer.teaCollections.reduce((sum, c) => sum + (c.kilosValidated as number), 0);
    const totalPendingCredit = customer.creditPurchases.reduce((sum, p) => sum + p.totalCost, 0);

    // Only include customers that have collections or pending credits or a payment
    if (totalKilos > 0 || totalPendingCredit > 0 || existingPayment) {
      results.push({
        customerId: customer.id,
        customerName: customer.name,
        customerPhone: customer.phone,
        customerId_display: customer.customerId,
        totalKilos,
        totalPendingCredit,
        pendingCreditCount: customer.creditPurchases.length,
        payment: existingPayment,
      });
    }
  }

  return NextResponse.json(results);
}

