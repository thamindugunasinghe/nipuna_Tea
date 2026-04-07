import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
  const drivers = await prisma.driver.findMany({
    where: { active: true },
    orderBy: { name: 'asc' },
    include: { lorry: true },
  });
  return NextResponse.json(drivers);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  if (!body.name) return NextResponse.json({ error: 'Name required' }, { status: 400 });
  const driver = await prisma.driver.create({
    data: {
      name: body.name,
      phone: body.phone || null,
      nic: body.nic || null,
      lorryId: body.lorryId || null,
    },
  });
  return NextResponse.json(driver, { status: 201 });
}
