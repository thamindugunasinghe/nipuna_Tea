import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const collection = await prisma.teaCollection.update({
    where: { id: parseInt(id) },
    data: { kilosValidated: body.kilosValidated },
  });
  return NextResponse.json(collection);
}
