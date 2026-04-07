import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
  const purchases = await prisma.creditPurchase.findMany({
    orderBy: { purchaseDate: 'desc' },
    include: { customer: true, fertiliser: true },
    take: 200,
  });
  return NextResponse.json(purchases);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { customerId, itemType, fertiliserId, description, quantity, unitPrice, totalCost, purchaseDate } = body;

  if (!customerId || !itemType || !unitPrice) {
    return NextResponse.json({ error: 'Required fields missing' }, { status: 400 });
  }

  const date = new Date(purchaseDate || new Date());
  const purchase = await prisma.creditPurchase.create({
    data: {
      customerId,
      itemType,
      fertiliserId: fertiliserId || null,
      description: description || null,
      quantity: quantity || 1,
      unitPrice: parseFloat(unitPrice),
      totalCost: totalCost || (quantity || 1) * parseFloat(unitPrice),
      purchaseDate: date,
      month: date.getMonth() + 1,
      year: date.getFullYear(),
    },
  });
  return NextResponse.json(purchase, { status: 201 });
}
