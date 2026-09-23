import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// GET: Fetch validation history (all past validations)
export async function GET() {
  const validations = await prisma.lorryValidation.findMany({
    orderBy: { validationDate: 'desc' },
    include: { lorry: true },
    take: 100,
  });
  return NextResponse.json(validations);
}
