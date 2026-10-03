import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getDriverId, unauthorizedDriver } from '@/lib/driverAuth';

// GET: List active customers for driver app
export async function GET(req: NextRequest) {
  if (!getDriverId(req)) return unauthorizedDriver();

  const customers = await prisma.customer.findMany({
    where: { active: true },
    orderBy: { name: 'asc' },
    select: {
      id: true,
      customerId: true,
      name: true,
      phone: true,
      type: true,
    },
  });
  return NextResponse.json(customers);
}
