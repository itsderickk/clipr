import { NextResponse } from 'next/server';
import { getUser } from '@/lib/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getUser();
  return NextResponse.json({ user });
}
