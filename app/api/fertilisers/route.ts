import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
  const fertilisers = await prisma.fertiliser.findMany({ where: { active: true }, orderBy: { name: 'asc' } });
  return NextResponse.json(fertilisers);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  if (!body.name || !body.pricePerUnit) return NextResponse.json({ error: 'Name and price required' }, { status: 400 });
  const fertiliser = await prisma.fertiliser.create({
    data: { name: body.name, pricePerUnit: body.pricePerUnit, weightPerBag: body.weightPerBag || null },
  });
  return NextResponse.json(fertiliser, { status: 201 });
}
