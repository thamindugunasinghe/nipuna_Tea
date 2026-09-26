import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';

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
          instantPaid: false,
        },
        select: { kilosValidated: true, monthlyPaid: true, collectionDate: true },
      },
      creditPurchases: {
        where: {
          settled: false,
          purchaseDate: { lte: endDate },
        },
        select: { totalCost: true },
      },
      monthlyPayments: true,
    },
  });

  const results = [];

  for (const customer of customers) {
    const rangePayments = customer.monthlyPayments.filter(p => {
      // A payment belongs to the date range if its month/year overlaps
      const pStart = new Date(p.year, p.month - 1, 1);
      const pEnd = new Date(p.year, p.month, 0, 23, 59, 59);
      // If payment month overlaps with the selected date range at all
      return pStart <= endDate && pEnd >= startDate;
    });

    const totalNetPayment = rangePayments.reduce((sum, p) => sum + p.netPayment, 0);

    const existingPayment = rangePayments.length > 0 ? {
      ...rangePayments[rangePayments.length - 1],
      netPayment: totalNetPayment
    } : null;
    
    let unpaidKilos = 0;
    let rangeKilos = 0;
    
    for (const c of customer.teaCollections) {
      if (!c.monthlyPaid) {
        unpaidKilos += (c.kilosValidated as number);
      }
      if (c.collectionDate >= startDate && c.collectionDate <= endDate) {
        rangeKilos += (c.kilosValidated as number);
      }
    }

    const unpaidCredit = customer.creditPurchases.reduce((sum, p) => sum + p.totalCost, 0);

    const isPending = unpaidKilos > 0 || unpaidCredit > 0;

    const totalKilos = rangeKilos;
    const totalPendingCredit = unpaidCredit;

    // Only include customers that have collections in range, pending credits, a payment, or pending past collections
    if (totalKilos > 0 || totalPendingCredit > 0 || existingPayment || isPending) {
      results.push({
        customerId: customer.id,
        customerName: customer.name,
        customerPhone: customer.phone,
        customerId_display: customer.customerId,
        totalKilos,
        totalPendingCredit,
        pendingCreditCount: customer.creditPurchases.length,
        payment: isPending ? null : existingPayment,
      });
    }
  }

  return NextResponse.json(results);
}

