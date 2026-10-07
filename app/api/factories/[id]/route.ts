import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { cleanDeductionTypes } from '@/lib/factoryChecks';

// PUT: { name?, deductionTypes?, active? }
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const data: { name?: string; deductionTypes?: string[]; active?: boolean } = {};

  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (!name) return NextResponse.json({ error: 'Factory name is required' }, { status: 400 });
    data.name = name;
  }
  if (body.deductionTypes !== undefined) {
    const types = cleanDeductionTypes(body.deductionTypes);
    if (!types) return NextResponse.json({ error: 'Invalid deduction list' }, { status: 400 });
    data.deductionTypes = types;
  }
  if (typeof body.active === 'boolean') data.active = body.active;

  try {
    const factory = await prisma.factory.update({ where: { id: parseInt(id) }, data });
    return NextResponse.json(factory);
  } catch (error: any) {
    if (error.code === 'P2002') return NextResponse.json({ error: 'A factory with this name already exists' }, { status: 400 });
    if (error.code === 'P2025') return NextResponse.json({ error: 'Factory not found' }, { status: 404 });
    return NextResponse.json({ error: 'Failed to update factory' }, { status: 500 });
  }
}
