import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// GET: Get all drivers with active sessions today
export async function GET() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const sessions = await prisma.driverSession.findMany({
    where: {
      sessionDate: { gte: today, lt: tomorrow },
    },
    include: {
      driver: {
        select: { id: true, name: true, phone: true },
      },
      lorry: {
        select: { id: true, lorryNumber: true },
      },
    },
    orderBy: { startedAt: 'desc' },
  });

  const onlineDrivers = sessions.map(s => ({
    sessionId: s.id,
    driverId: s.driver.id,
    driverName: s.driver.name,
    driverPhone: s.driver.phone,
    lorryId: s.lorry?.id || null,
    lorryNumber: s.lorry?.lorryNumber || null,
    isActive: s.isActive,
    startedAt: s.startedAt,
    stoppedAt: s.stoppedAt,
    collectionsCount: s.collectionsCount,
    totalKilos: s.totalKilos,
  }));

  const activeCount = onlineDrivers.filter(d => d.isActive).length;

  return NextResponse.json({
    drivers: onlineDrivers,
    activeCount,
    totalCount: onlineDrivers.length,
  });
}
