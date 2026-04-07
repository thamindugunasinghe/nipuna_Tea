import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const month = parseInt(searchParams.get('month') || String(new Date().getMonth() + 1));
  const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()));

  const payments = await prisma.monthlyPayment.findMany({
    where: { month, year },
    include: { customer: true },
    orderBy: { netPayment: 'desc' },
  });
  return NextResponse.json(payments);
}
