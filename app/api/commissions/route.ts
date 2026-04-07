import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const month = parseInt(searchParams.get('month') || String(new Date().getMonth() + 1));
  const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()));

  const commissions = await prisma.driverCommission.findMany({
    where: { month, year },
    include: { driver: true },
    orderBy: { commissionAmount: 'desc' },
  });
  return NextResponse.json(commissions);
}
