import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

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
  const { customerId, driverId, lorryId, kilosByDriver, waterScore, collectionDate } = body;

  if (!customerId || !kilosByDriver || !collectionDate) {
    return NextResponse.json({ error: 'Customer, kilos, and date are required' }, { status: 400 });
  }

  const date = new Date(collectionDate);
  const collection = await prisma.teaCollection.create({
    data: {
      customerId,
      driverId: driverId || null,
      lorryId: lorryId || null,
      kilosByDriver: parseFloat(kilosByDriver),
      waterScore: parseInt(waterScore) || 0,
      collectionDate: date,
      month: date.getMonth() + 1,
      year: date.getFullYear(),
    },
  });
  return NextResponse.json(collection, { status: 201 });
}
