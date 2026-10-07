import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { cleanDeductionTypes } from '@/lib/factoryChecks';

// GET: factories (?all=1 includes inactive)
export async function GET(req: NextRequest) {
  const all = new URL(req.url).searchParams.get('all') === '1';
  const factories = await prisma.factory.findMany({
    where: all ? {} : { active: true },
    orderBy: { name: 'asc' },
  });
  return NextResponse.json(factories);
}

// POST: { name, deductionTypes: ["Water", "Crates", ...] }
export async function POST(req: NextRequest) {
  const body = await req.json();
  const name = String(body.name ?? '').trim();
  if (!name) return NextResponse.json({ error: 'Factory name is required' }, { status: 400 });
  const deductionTypes = cleanDeductionTypes(body.deductionTypes ?? []);
  if (!deductionTypes) return NextResponse.json({ error: 'Invalid deduction list' }, { status: 400 });

  try {
    const factory = await prisma.factory.create({ data: { name, deductionTypes } });
    return NextResponse.json(factory, { status: 201 });
  } catch (error: any) {
    if (error.code === 'P2002') return NextResponse.json({ error: 'A factory with this name already exists' }, { status: 400 });
    return NextResponse.json({ error: 'Failed to create factory' }, { status: 500 });
  }
}
