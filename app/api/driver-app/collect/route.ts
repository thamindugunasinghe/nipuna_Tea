import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { sendCollectionSms } from '@/lib/sms';

// GET: Get collections by driver for today
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const driverId = parseInt(searchParams.get('driverId') || '0');
  const date = searchParams.get('date') || new Date().toISOString().split('T')[0];

  if (!driverId) {
    return NextResponse.json({ error: 'driverId is required' }, { status: 400 });
  }

  const dateStart = new Date(date);
  dateStart.setHours(0, 0, 0, 0);
  const dateEnd = new Date(date);
  dateEnd.setHours(23, 59, 59, 999);

  const collections = await prisma.teaCollection.findMany({
    where: {
      driverId,
      collectionDate: { gte: dateStart, lte: dateEnd },
    },
    include: { customer: true, lorry: true },
    orderBy: { createdAt: 'desc' },
  });

  const totalKilos = collections.reduce((sum, c) => sum + c.kilosByDriver, 0);

  return NextResponse.json({
    collections,
    totalKilos,
    count: collections.length,
  });
}

// POST: Record a tea collection
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { driverId, lorryId, customerId, kilosByDriver, waterDeduction, packagingDeduction } = body;

  if (!driverId || !customerId || !kilosByDriver) {
    return NextResponse.json({ error: 'driverId, customerId, and kilosByDriver are required' }, { status: 400 });
  }

  const kilos = parseFloat(kilosByDriver);
  if (isNaN(kilos) || kilos <= 0) {
    return NextResponse.json({ error: 'Invalid kilos value' }, { status: 400 });
  }

  const waterDed = parseFloat(waterDeduction) || 0;
  const packDed = parseFloat(packagingDeduction) || 0;
  const totalDeduction = waterDed + packDed;

  if (waterDed < 0 || packDed < 0 || totalDeduction >= kilos) {
    return NextResponse.json({ error: 'Deductions must be >= 0 and less than kilos / අඩු කිරීම් 0 ට වැඩි සහ කිලෝ වලට වඩා අඩු විය යුතුය' }, { status: 400 });
  }

  const netKilos = Math.round((kilos - totalDeduction) * 100) / 100;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Check driver has active session
  const session = await prisma.driverSession.findUnique({
    where: { driverId_sessionDate: { driverId, sessionDate: today } },
  });

  if (!session || !session.isActive) {
    return NextResponse.json({ error: 'Please start your operation first / කරුණාකර පළමුව මෙහෙයුම ආරම්භ කරන්න' }, { status: 400 });
  }

  // Create tea collection with kilosValidated calculated immediately
  const collection = await prisma.teaCollection.create({
    data: {
      customerId,
      driverId,
      lorryId: lorryId || null,
      kilosByDriver: kilos,
      waterDeduction: waterDed,
      packagingDeduction: packDed,
      kilosValidated: netKilos,
      collectionDate: today,
      month: today.getMonth() + 1,
      year: today.getFullYear(),
    },
    include: { customer: true },
  });

  // Update session counters (use net kilos after deduction)
  await prisma.driverSession.update({
    where: { id: session.id },
    data: {
      collectionsCount: { increment: 1 },
      totalKilos: { increment: netKilos },
    },
  });

  console.log(`[COLLECT] Driver ${driverId} collected ${kilos}kg (deduction: ${totalDeduction}kg, net: ${netKilos}kg) from customer ${customerId}`);

  // Send SMS notification (async, non-blocking)
  if (collection.customer?.phone) {
    const today = new Date();
    sendCollectionSms(
      collection.customer.name,
      collection.customer.phone,
      kilos,
      totalDeduction,
      netKilos,
      today.toISOString().split('T')[0]
    ).catch(err => console.error('[SMS] Driver collection SMS error:', err));
  }

  return NextResponse.json({ collection }, { status: 201 });
}
