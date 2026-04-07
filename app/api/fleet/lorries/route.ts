import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
  const lorries = await prisma.lorry.findMany({
    where: { active: true },
    orderBy: { lorryNumber: 'asc' },
    include: { drivers: { where: { active: true } } },
  });
  return NextResponse.json(lorries);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  if (!body.lorryNumber) return NextResponse.json({ error: 'Lorry number required' }, { status: 400 });
  try {
    const lorry = await prisma.lorry.create({
      data: { lorryNumber: body.lorryNumber, capacity: body.capacity || null },
    });
    return NextResponse.json(lorry, { status: 201 });
  } catch (error: any) {
    if (error.code === 'P2002') return NextResponse.json({ error: 'Lorry number exists' }, { status: 400 });
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
