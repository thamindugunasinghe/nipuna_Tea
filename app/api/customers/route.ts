import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
  const customers = await prisma.customer.findMany({
    where: { active: true },
    orderBy: { name: 'asc' },
    include: {
      _count: { select: { teaCollections: true, creditPurchases: true } },
    },
  });
  return NextResponse.json(customers);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, nic, phone, address, type } = body;
  if (!name) return NextResponse.json({ error: 'Name is required' }, { status: 400 });

  try {
    const customer = await prisma.customer.create({
      data: { name, nic: nic || null, phone: phone || null, address: address || null, type: type || 'regular' },
    });
    return NextResponse.json(customer, { status: 201 });
  } catch (error: any) {
    if (error.code === 'P2002') return NextResponse.json({ error: 'NIC already exists' }, { status: 400 });
    return NextResponse.json({ error: 'Failed to create customer' }, { status: 500 });
  }
}
