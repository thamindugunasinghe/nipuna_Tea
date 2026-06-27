import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const month = parseInt(searchParams.get('month') || String(new Date().getMonth() + 1));
  const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()));

  // Get all active regular customers with their month data
  const customers = await prisma.customer.findMany({
    where: { active: true, type: 'regular' },
    orderBy: { name: 'asc' },
  });

  const results = [];

  for (const customer of customers) {
    // Total validated kilos for the month
    const collections = await prisma.teaCollection.findMany({
      where: { customerId: customer.id, month, year, kilosValidated: { not: null } },
    });
    const totalKilos = collections.reduce((sum, c) => sum + (c.kilosValidated as number), 0);

    // All pending credit purchases (from any month up to selected)
    const pendingCredits = await prisma.creditPurchase.findMany({
      where: {
        customerId: customer.id,
        settled: false,
        OR: [
          { year: { lt: year } },
          { year, month: { lte: month } },
        ],
      },
    });
    const totalPendingCredit = pendingCredits.reduce((sum, p) => sum + p.totalCost, 0);

    // Check if payment already exists for this month
    const existingPayment = await prisma.monthlyPayment.findUnique({
      where: { customerId_month_year: { customerId: customer.id, month, year } },
    });

    // Only include customers that have collections or pending credits
    if (totalKilos > 0 || totalPendingCredit > 0 || existingPayment) {
      results.push({
        customerId: customer.id,
        customerName: customer.name,
        customerPhone: customer.phone,
        totalKilos,
        totalPendingCredit,
        pendingCreditCount: pendingCredits.length,
        payment: existingPayment,
      });
    }
  }

  return NextResponse.json(results);
}
