import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const customer = await prisma.customer.findUnique({
    where: { id: parseInt(id) },
    include: {
      creditPurchases: { orderBy: { purchaseDate: 'desc' } },
      teaCollections: { orderBy: { collectionDate: 'desc' }, include: { driver: true } },
      monthlyPayments: { orderBy: [{ year: 'desc' }, { month: 'desc' }] },
    },
  });
  if (!customer) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(customer);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const customer = await prisma.customer.update({
    where: { id: parseInt(id) },
    data: {
      name: body.name,
      nic: body.nic || null,
      phone: body.phone || null,
      address: body.address || null,
      type: body.type,
    },
  });
  return NextResponse.json(customer);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.customer.update({ where: { id: parseInt(id) }, data: { active: false } });
  return NextResponse.json({ success: true });
}
