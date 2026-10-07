import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getDriverId, unauthorizedDriver } from '@/lib/driverAuth';

// GET: lorries the driver can choose from when starting operation
export async function GET(req: NextRequest) {
  if (!getDriverId(req)) return unauthorizedDriver();

  const lorries = await prisma.lorry.findMany({
    where: { active: true },
    select: { id: true, lorryNumber: true },
    orderBy: { lorryNumber: 'asc' },
  });
  return NextResponse.json(lorries);
}
