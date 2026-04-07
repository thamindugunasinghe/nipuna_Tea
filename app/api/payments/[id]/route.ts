import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const payment = await prisma.monthlyPayment.update({
    where: { id: parseInt(id) },
    data: { paid: body.paid, paidAt: body.paid ? new Date() : null },
  });
  return NextResponse.json(payment);
}
