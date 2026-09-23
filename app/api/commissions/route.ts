import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const startDateParam = searchParams.get('startDate');
  const endDateParam = searchParams.get('endDate');

  let month: number;
  let year: number;

  if (startDateParam && endDateParam) {
    const startDate = new Date(startDateParam);
    month = startDate.getMonth() + 1;
    year = startDate.getFullYear();
  } else {
    month = parseInt(searchParams.get('month') || String(new Date().getMonth() + 1));
    year = parseInt(searchParams.get('year') || String(new Date().getFullYear()));
  }

  const commissions = await prisma.driverCommission.findMany({
    where: { month, year },
    include: { driver: true },
    orderBy: { commissionAmount: 'desc' },
  });
  return NextResponse.json(commissions);
}

