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
  const { lorryId } = body;

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
    // Re-activate stopped session
    const session = await prisma.driverSession.update({
      where: { id: existing.id },
      data: { isActive: true, stoppedAt: null },
      include: { lorry: true, driver: true },
    });
    return NextResponse.json({ session });
  }

  // Create new session
  const session = await prisma.driverSession.create({
    data: {
      driverId,
      lorryId: lorryId || null,
      sessionDate: today,
      isActive: true,
    },
    include: { lorry: true, driver: true },
  });

  console.log(`[SESSION] Driver ${driverId} started operation`);
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
