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

  // Get all active regular customers with their data in the date range
  const customers = await prisma.customer.findMany({
    where: { active: true, type: 'regular' },
    orderBy: { name: 'asc' },
  });

  const results = [];

  for (const customer of customers) {
    // Total validated kilos within the date range
    const collections = await prisma.teaCollection.findMany({
      where: {
        customerId: customer.id,
        collectionDate: { gte: startDate, lte: endDate },
        kilosValidated: { not: null },
      },
    });
    const totalKilos = collections.reduce((sum, c) => sum + (c.kilosValidated as number), 0);

    // Pending credit purchases within the date range
    const pendingCredits = await prisma.creditPurchase.findMany({
      where: {
        customerId: customer.id,
        settled: false,
        purchaseDate: { lte: endDate },
      },
    });
    const totalPendingCredit = pendingCredits.reduce((sum, p) => sum + p.totalCost, 0);

    // Check if payment already exists for the month of the start date
    const paymentMonth = startDate.getMonth() + 1;
    const paymentYear = startDate.getFullYear();
    const existingPayment = await prisma.monthlyPayment.findUnique({
      where: { customerId_month_year: { customerId: customer.id, month: paymentMonth, year: paymentYear } },
    });

    // Only include customers that have collections or pending credits
    if (totalKilos > 0 || totalPendingCredit > 0 || existingPayment) {
      results.push({
        customerId: customer.id,
        customerName: customer.name,
        customerPhone: customer.phone,
        customerId_display: customer.customerId,
        totalKilos,
        totalPendingCredit,
        pendingCreditCount: pendingCredits.length,
        payment: existingPayment,
      });
    }
  }

  return NextResponse.json(results);
}

