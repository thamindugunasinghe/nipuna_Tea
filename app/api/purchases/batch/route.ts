import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { sendCreditPurchaseSms } from '@/lib/sms';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { customerId, itemType, purchaseDate, items } = body;

  if (!customerId || !itemType || !items || !Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: 'Required fields missing' }, { status: 400 });
  }

  // Only regular customers can make credit purchases
  const customer = await prisma.customer.findUnique({ where: { id: customerId } });
  if (customer?.type === 'non-regular') {
    return NextResponse.json({ error: 'Non-regular customers cannot make credit purchases' }, { status: 400 });
  }

  const date = new Date(purchaseDate || new Date());
  const month = date.getMonth() + 1;
  const year = date.getFullYear();

  // Create all purchase records in a transaction
  const purchases = await prisma.$transaction(
    items.map((item: any) =>
      prisma.creditPurchase.create({
        data: {
          customerId,
          itemType,
          fertiliserId: item.fertiliserId || null,
          description: item.description || null,
          quantity: item.quantity || 1,
          unitPrice: parseFloat(item.unitPrice),
          totalCost: item.totalCost || (item.quantity || 1) * parseFloat(item.unitPrice),
          purchaseDate: date,
          month,
          year,
        },
        include: { customer: true },
      })
    )
  );

  // Send SMS for the batch (summarized)
  if (purchases.length > 0 && purchases[0].customer?.phone) {
    const totalAmount = purchases.reduce((sum: number, p: any) => sum + p.totalCost, 0);
    const descriptions = purchases.map((p: any) => p.description).filter(Boolean).join(', ');
    const dateStr = date.toISOString().split('T')[0];
    sendCreditPurchaseSms(
      purchases[0].customer.name,
      purchases[0].customer.phone,
      itemType,
      descriptions,
      totalAmount,
      dateStr
    ).catch(err => console.error('[SMS] Batch purchase SMS error:', err));
  }

  return NextResponse.json(purchases, { status: 201 });
}
