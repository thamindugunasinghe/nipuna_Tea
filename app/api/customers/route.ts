import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const search = searchParams.get('search')?.trim();

  const where: any = { active: true };

  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { customerId: { contains: search, mode: 'insensitive' } },
      { nic: { contains: search } },
    ];
  }

  const customers = await prisma.customer.findMany({
    where,
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
    // Auto-generate customer ID (NTC-XXXX format)
    const lastCustomer = await prisma.customer.findFirst({
      orderBy: { id: 'desc' },
      select: { id: true },
    });
    const nextNum = (lastCustomer?.id || 0) + 1;
    const customerId = `NTC-${String(nextNum).padStart(4, '0')}`;

    const customer = await prisma.customer.create({
      data: {
        customerId,
        name,
        nic: nic || null,
        phone: phone || null,
        address: address || null,
        type: type || 'regular',
      },
    });
    return NextResponse.json(customer, { status: 201 });
  } catch (error: any) {
    if (error.code === 'P2002') return NextResponse.json({ error: 'NIC already exists' }, { status: 400 });
    return NextResponse.json({ error: 'Failed to create customer' }, { status: 500 });
  }
}

