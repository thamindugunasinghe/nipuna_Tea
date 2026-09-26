import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { sendCollectionSms } from '@/lib/sms';

export async function GET() {
  const collections = await prisma.teaCollection.findMany({
    orderBy: { collectionDate: 'desc' },
    include: { customer: true, driver: true, lorry: true },
    take: 200,
  });
  return NextResponse.json(collections);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { customerId, driverId, lorryId, kilosByDriver, waterDeduction, packagingDeduction, collectionDate } = body;

  if (!customerId || !kilosByDriver || !collectionDate) {
    return NextResponse.json({ error: 'Customer, kilos, and date are required' }, { status: 400 });
  }

  const kilos = parseFloat(kilosByDriver);
  const waterDed = parseFloat(waterDeduction) || 0;
  const packDed = parseFloat(packagingDeduction) || 0;
  const netKilos = Math.round((kilos - waterDed - packDed) * 100) / 100;

  const date = new Date(collectionDate);
  const collection = await prisma.teaCollection.create({
    data: {
      customerId,
      driverId: driverId || null,
      lorryId: lorryId || null,
      kilosByDriver: kilos,
      waterDeduction: waterDed,
      packagingDeduction: packDed,
      kilosValidated: netKilos,
      collectionDate: date,
      month: date.getMonth() + 1,
      year: date.getFullYear(),
    },
    include: { customer: true },
  });

  // Send SMS notification (async, non-blocking)
  if (collection.customer?.phone) {
    sendCollectionSms(
      collection.customer.name,
      collection.customer.phone,
      kilos,
      waterDed + packDed,
      netKilos,
      date.toISOString().split('T')[0]
    ).catch(err => console.error('[SMS] Collection SMS error:', err));
  }

  return NextResponse.json(collection, { status: 201 });
}
