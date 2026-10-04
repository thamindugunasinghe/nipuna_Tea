import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// Mark a commission as paid. Paid commissions are final (their tea can't be counted again).
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();

  if (body.paid !== true) {
    return NextResponse.json({ error: 'A paid commission cannot be changed back to unpaid' }, { status: 400 });
  }

  // Only flips an unpaid commission, so a double click does nothing extra
  const updated = await prisma.driverCommission.updateMany({
    where: { id: parseInt(id), paid: false },
    data: { paid: true, paidAt: new Date() },
  });
  if (updated.count === 0) {
    return NextResponse.json({ error: 'Commission not found or already paid' }, { status: 409 });
  }

  const commission = await prisma.driverCommission.findUnique({ where: { id: parseInt(id) } });
  return NextResponse.json(commission);
}
