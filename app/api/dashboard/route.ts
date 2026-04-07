import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

  try {
    const [todayCollections, monthlyCollections, totalCustomers, activeDrivers, recentCollections] = await Promise.all([
      prisma.teaCollection.aggregate({
        _sum: { kilosValidated: true, kilosByDriver: true },
        where: { collectionDate: { gte: today, lt: tomorrow } },
      }),
      prisma.teaCollection.aggregate({
        _sum: { kilosValidated: true, kilosByDriver: true },
        where: { collectionDate: { gte: firstOfMonth } },
      }),
      prisma.customer.count({ where: { active: true } }),
      prisma.driver.count({ where: { active: true } }),
      prisma.teaCollection.findMany({
        take: 10,
        orderBy: { collectionDate: 'desc' },
        include: { customer: true, driver: true },
      }),
    ]);

    return NextResponse.json({
      todayCollection: todayCollections._sum.kilosValidated || todayCollections._sum.kilosByDriver || 0,
      monthlyCollection: monthlyCollections._sum.kilosValidated || monthlyCollections._sum.kilosByDriver || 0,
      totalCustomers,
      activeDrivers,
      recentCollections,
    });
  } catch (error) {
    return NextResponse.json({
      todayCollection: 0, monthlyCollection: 0, totalCustomers: 0, activeDrivers: 0, recentCollections: [],
    });
  }
}
