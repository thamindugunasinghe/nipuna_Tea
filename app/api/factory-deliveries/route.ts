import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { parseDay } from '@/lib/billing';
import { DELIVERY_INCLUDE, deliveryCommissionRate, parseDeliveryInput } from '@/lib/factoryDeliveries';

// GET ?date=2026-10-04[&factoryId=1] — deliveries for a day (optionally one factory)
// GET ?pendingCards=1 — all deliveries still waiting for their factory card
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  if (searchParams.get('pendingCards') === '1') {
    const deliveries = await prisma.factoryDelivery.findMany({
      where: { cardReceivedKg: null },
      include: DELIVERY_INCLUDE,
      orderBy: [{ deliveryDate: 'asc' }, { id: 'asc' }],
    });
    return NextResponse.json(deliveries);
  }

  const date = parseDay(searchParams.get('date'));
  if (!date) return NextResponse.json({ error: 'date is required (YYYY-MM-DD)' }, { status: 400 });
  const factoryId = parseInt(searchParams.get('factoryId') || '') || undefined;

  const deliveries = await prisma.factoryDelivery.findMany({
    where: { deliveryDate: date, ...(factoryId ? { factoryId } : {}) },
    include: DELIVERY_INCLUDE,
    orderBy: { id: 'asc' },
  });
  return NextResponse.json(deliveries);
}

// POST: record tea handed over to a factory
export async function POST(req: NextRequest) {
  const parsed = await parseDeliveryInput(await req.json());
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  // Our lorry: driver earns delivery commission at today's rate (kept on the record)
  const commissionPerKg = parsed.data.transport === 'ours' ? await deliveryCommissionRate() : null;

  const delivery = await prisma.factoryDelivery.create({
    data: { ...parsed.data, commissionPerKg },
    include: DELIVERY_INCLUDE,
  });
  return NextResponse.json(delivery, { status: 201 });
}
