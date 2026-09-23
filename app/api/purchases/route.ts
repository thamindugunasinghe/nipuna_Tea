import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { sendCreditPurchaseSms, sendCashAdvanceSms } from '@/lib/sms';

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

  // Only regular customers can make credit purchases
  const customer = await prisma.customer.findUnique({ where: { id: customerId } });
  if (customer?.type === 'non-regular') {
    return NextResponse.json({ error: 'Non-regular customers cannot make credit purchases' }, { status: 400 });
  }

  const date = new Date(purchaseDate || new Date());
  const computedTotal = totalCost || (quantity || 1) * parseFloat(unitPrice);

  const purchase = await prisma.creditPurchase.create({
    data: {
      customerId,
      itemType,
      fertiliserId: fertiliserId || null,
      description: description || null,
      quantity: quantity || 1,
      unitPrice: parseFloat(unitPrice),
      totalCost: computedTotal,
      purchaseDate: date,
      month: date.getMonth() + 1,
      year: date.getFullYear(),
    },
    include: { customer: true },
  });

  // Send SMS notification (async, non-blocking)
  if (purchase.customer?.phone) {
    const dateStr = date.toISOString().split('T')[0];
    if (itemType === 'cash_advance') {
      sendCashAdvanceSms(
        purchase.customer.name,
        purchase.customer.phone,
        computedTotal,
        dateStr
      ).catch(err => console.error('[SMS] Cash advance SMS error:', err));
    } else {
      sendCreditPurchaseSms(
        purchase.customer.name,
        purchase.customer.phone,
        itemType,
        description || '',
        computedTotal,
        dateStr
      ).catch(err => console.error('[SMS] Credit purchase SMS error:', err));
    }
  }

  return NextResponse.json(purchase, { status: 201 });
}

