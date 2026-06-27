import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// GET: List active customers for driver app
export async function GET() {
  const customers = await prisma.customer.findMany({
    where: { active: true },
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      phone: true,
      type: true,
    },
  });
  return NextResponse.json(customers);
}
