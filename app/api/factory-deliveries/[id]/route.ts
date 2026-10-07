import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { DELIVERY_INCLUDE, deliveryCommissionRate, parseDeliveryInput } from '@/lib/factoryDeliveries';

async function load(id: string) {
  return prisma.factoryDelivery.findUnique({ where: { id: parseInt(id) }, include: DELIVERY_INCLUDE });
}

// PUT: fix a delivery's details (not allowed once its delivery commission is paid)
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const existing = await load(id);
  if (!existing) return NextResponse.json({ error: 'Delivery not found' }, { status: 404 });
  if (existing.driverCommission?.paid) {
    return NextResponse.json({ error: "The driver's delivery commission for this is already paid, so it can't be changed" }, { status: 409 });
  }

  const parsed = await parseDeliveryInput(await req.json());
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  // Keep the original commission rate; if it becomes "our lorry" now, use today's rate
  const commissionPerKg = parsed.data.transport === 'ours'
    ? (existing.transport === 'ours' ? existing.commissionPerKg : await deliveryCommissionRate())
    : null;

  const delivery = await prisma.factoryDelivery.update({
    where: { id: existing.id },
    // Taken out of any unpaid commission; recalculating the commission picks it up again
    data: { ...parsed.data, commissionPerKg, driverCommissionId: null },
    include: DELIVERY_INCLUDE,
  });
  return NextResponse.json(delivery);
}

// DELETE: remove a delivery entered by mistake (only before its card is recorded and commission paid)
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const existing = await load(id);
  if (!existing) return NextResponse.json({ error: 'Delivery not found' }, { status: 404 });
  if (existing.cardReceivedKg != null) {
    return NextResponse.json({ error: 'This delivery already has a factory card, so it cannot be deleted' }, { status: 409 });
  }
  if (existing.driverCommission?.paid) {
    return NextResponse.json({ error: "The driver's delivery commission for this is already paid" }, { status: 409 });
  }
  await prisma.factoryDelivery.delete({ where: { id: existing.id } });
  return NextResponse.json({ success: true });
}
