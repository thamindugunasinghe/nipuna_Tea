import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getDriverId, unauthorizedDriver } from '@/lib/driverAuth';

// GET: Get today's session for a driver
export async function GET(req: NextRequest) {
  const driverId = getDriverId(req);
  if (!driverId) return unauthorizedDriver();

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const session = await prisma.driverSession.findUnique({
    where: { driverId_sessionDate: { driverId, sessionDate: today } },
    include: { lorry: true, driver: true },
  });

  return NextResponse.json({ session });
}

// POST: Start daily operation
export async function POST(req: NextRequest) {
  const driverId = getDriverId(req);
  if (!driverId) return unauthorizedDriver();

  const body = await req.json();

  // The driver chooses the lorry when starting operation.
  // (Older app versions don't send it: fall back to the lorry that used to be assigned to the driver.)
  let lorryId = parseInt(body.lorryId) || null;
  if (!lorryId) {
    const driver = await prisma.driver.findUnique({ where: { id: driverId }, select: { lorryId: true } });
    lorryId = driver?.lorryId ?? null;
  }
  if (!lorryId) {
    return NextResponse.json({ error: 'Please choose your lorry / කරුණාකර ලොරිය තෝරන්න' }, { status: 400 });
  }
  const lorry = await prisma.lorry.findFirst({ where: { id: lorryId, active: true } });
  if (!lorry) {
    return NextResponse.json({ error: 'Lorry not found / ලොරිය හමු නොවීය' }, { status: 400 });
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Check if session already exists
  const existing = await prisma.driverSession.findUnique({
    where: { driverId_sessionDate: { driverId, sessionDate: today } },
  });

  if (existing) {
    if (existing.isActive) {
      return NextResponse.json({ error: 'Operation already started today / අද මෙහෙයුම දැනටමත් ආරම්භ කර ඇත' }, { status: 400 });
    }
    // Re-activate stopped session (with the lorry chosen now)
    const session = await prisma.driverSession.update({
      where: { id: existing.id },
      data: { isActive: true, stoppedAt: null, lorryId },
      include: { lorry: true, driver: true },
    });
    return NextResponse.json({ session });
  }

  // Create new session
  const session = await prisma.driverSession.create({
    data: {
      driverId,
      lorryId,
      sessionDate: today,
      isActive: true,
    },
    include: { lorry: true, driver: true },
  });

  console.log(`[SESSION] Driver ${driverId} started operation with lorry ${lorry.lorryNumber}`);
  return NextResponse.json({ session }, { status: 201 });
}

// PATCH: Stop daily operation
export async function PATCH(req: NextRequest) {
  const driverId = getDriverId(req);
  if (!driverId) return unauthorizedDriver();

  const body = await req.json();
  const { sessionId } = body;

  if (!sessionId) {
    return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });
  }

  // Drivers can only stop their own session
  const owned = await prisma.driverSession.findFirst({ where: { id: sessionId, driverId }, select: { id: true } });
  if (!owned) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  const session = await prisma.driverSession.update({
    where: { id: sessionId },
    data: {
      isActive: false,
      stoppedAt: new Date(),
    },
    include: { lorry: true, driver: true },
  });

  console.log(`[SESSION] Driver ${session.driverId} stopped operation. Collections: ${session.collectionsCount}, Kilos: ${session.totalKilos}`);
  return NextResponse.json({ session });
}
