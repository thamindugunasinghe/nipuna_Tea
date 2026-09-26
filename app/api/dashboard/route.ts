import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const month = parseInt(searchParams.get('month') || String(new Date().getMonth() + 1));
  const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()));

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  try {
    const [
      todayCollections,
      monthlyCollections,
      totalCustomers,
      activeDrivers,
      recentCollections,
      totalCreditPurchases,
      settledCredits,
      unsettledCredits,
      monthlyPayments,
    ] = await Promise.all([
      // Fetch raw collections to correctly calculate net kilos
      prisma.teaCollection.findMany({
        select: { kilosValidated: true, kilosByDriver: true, waterDeduction: true, packagingDeduction: true },
        where: { collectionDate: { gte: today, lt: tomorrow } },
      }),
      // Monthly collection
      prisma.teaCollection.findMany({
        select: { kilosValidated: true, kilosByDriver: true, waterDeduction: true, packagingDeduction: true },
        where: { month, year },
      }),
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

    const calcNet = (c: any) => c.kilosValidated ?? (c.kilosByDriver - (c.waterDeduction || 0) - (c.packagingDeduction || 0));
    
    const todayKilos = todayCollections.reduce((sum, c) => sum + calcNet(c), 0);
    const monthlyKilos = monthlyCollections.reduce((sum, c) => sum + calcNet(c), 0);

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
