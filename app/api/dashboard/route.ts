import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { Prisma } from '@prisma/client';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const month = parseInt(searchParams.get('month') || String(new Date().getMonth() + 1));
  const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()));

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  try {
    // Net kilos = kilosValidated, or (gross - water - packaging) for old rows without it.
    // Summed in the database instead of downloading every collection row.
    const sumNetKilos = async (where: Prisma.TeaCollectionWhereInput) => {
      const [validated, legacy] = await Promise.all([
        prisma.teaCollection.aggregate({
          _sum: { kilosValidated: true },
          where: { ...where, kilosValidated: { not: null } },
        }),
        prisma.teaCollection.aggregate({
          _sum: { kilosByDriver: true, waterDeduction: true, packagingDeduction: true },
          where: { ...where, kilosValidated: null },
        }),
      ]);
      const total = (validated._sum.kilosValidated || 0)
        + (legacy._sum.kilosByDriver || 0) - (legacy._sum.waterDeduction || 0) - (legacy._sum.packagingDeduction || 0);
      return Math.round(total * 100) / 100;
    };

    const [
      todayKilos,
      monthlyKilos,
      totalCustomers,
      activeDrivers,
      recentCollections,
      totalCreditPurchases,
      settledCredits,
      unsettledCredits,
      monthlyPayments,
    ] = await Promise.all([
      // Today's net kilos
      sumNetKilos({ collectionDate: { gte: today, lt: tomorrow } }),
      // Monthly net kilos
      sumNetKilos({ month, year }),
      prisma.customer.count({ where: { active: true } }),
      prisma.driver.count({ where: { active: true } }),
      // Recent collections for selected month
      prisma.teaCollection.findMany({
        take: 10,
        orderBy: { collectionDate: 'desc' },
        where: { month, year },
        include: { customer: true, driver: true },
      }),
      // Total credit purchases for selected month
      prisma.creditPurchase.aggregate({
        _sum: { totalCost: true },
        _count: true,
        where: { month, year },
      }),
      // Settled credits for selected month
      prisma.creditPurchase.aggregate({
        _sum: { totalCost: true },
        _count: true,
        where: { month, year, settled: true },
      }),
      // Unsettled credits (all pending — any month up to selected)
      prisma.creditPurchase.aggregate({
        _sum: { totalCost: true },
        _count: true,
        where: {
          settled: false,
          OR: [
            { year: { lt: year } },
            { year, month: { lte: month } },
          ],
        },
      }),
      // Monthly payment summary
      prisma.monthlyPayment.aggregate({
        _sum: { netPayment: true, grossPayment: true },
        _count: true,
        where: { month, year },
      }),
    ]);

    return NextResponse.json({
      todayCollection: todayKilos,
      monthlyCollection: monthlyKilos,
      totalCustomers,
      activeDrivers,
      recentCollections,
      totalCreditPurchases: totalCreditPurchases._sum.totalCost || 0,
      totalCreditCount: totalCreditPurchases._count || 0,
      settledCreditAmount: settledCredits._sum.totalCost || 0,
      settledCreditCount: settledCredits._count || 0,
      unsettledCreditAmount: unsettledCredits._sum.totalCost || 0,
      unsettledCreditCount: unsettledCredits._count || 0,
      totalPayments: monthlyPayments._sum.netPayment || 0,
      totalGrossPayments: monthlyPayments._sum.grossPayment || 0,
      paymentCount: monthlyPayments._count || 0,
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    return NextResponse.json({
      todayCollection: 0, monthlyCollection: 0, totalCustomers: 0, activeDrivers: 0,
      recentCollections: [], totalCreditPurchases: 0, totalCreditCount: 0,
      settledCreditAmount: 0, settledCreditCount: 0, unsettledCreditAmount: 0,
      unsettledCreditCount: 0, totalPayments: 0, totalGrossPayments: 0, paymentCount: 0,
    });
  }
}
