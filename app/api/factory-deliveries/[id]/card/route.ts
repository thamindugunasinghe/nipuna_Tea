import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { round2 } from '@/lib/billing';
import { DELIVERY_INCLUDE } from '@/lib/factoryDeliveries';

// PUT: record (or correct) the factory card for a delivery
// { receivedKg: 955, deductions: { "Water": 10, "Crates": 5 } }
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();

  const delivery = await prisma.factoryDelivery.findUnique({ where: { id: parseInt(id) } });
  if (!delivery) return NextResponse.json({ error: 'Delivery not found' }, { status: 404 });

  const receivedKg = Number(body.receivedKg);
  if (!Number.isFinite(receivedKg) || receivedKg <= 0) {
    return NextResponse.json({ error: 'Weight received at factory must be more than 0' }, { status: 400 });
  }

  const deductions: Record<string, number> = {};
  if (body.deductions && typeof body.deductions === 'object') {
    for (const [name, value] of Object.entries(body.deductions)) {
      if (value === '' || value === null || value === undefined) continue;
      const kg = Number(value);
      if (!Number.isFinite(kg) || kg < 0) {
        return NextResponse.json({ error: `${name}: deduction must be 0 or more` }, { status: 400 });
      }
      deductions[String(name).slice(0, 40)] = round2(kg);
    }
  }

  const totalDeduction = round2(Object.values(deductions).reduce((s, v) => s + v, 0));
  if (totalDeduction > receivedKg) {
    return NextResponse.json({ error: 'Deductions are more than the weight received' }, { status: 400 });
  }

  const updated = await prisma.factoryDelivery.update({
    where: { id: delivery.id },
    data: {
      cardReceivedKg: round2(receivedKg),
      cardDeductions: deductions,
      cardTotalDeduction: totalDeduction,
      cardAcceptedKg: round2(receivedKg - totalDeduction),
      cardEnteredAt: new Date(),
    },
    include: DELIVERY_INCLUDE,
  });
  return NextResponse.json(updated);
}
