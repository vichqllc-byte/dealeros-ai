import { NextResponse } from 'next/server';
import { db } from '@/lib/db/client';

// Readiness probe: can this instance actually serve real traffic right
// now (i.e. is the database reachable)? Distinct from /api/health/live.
export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: 'ok', database: true });
  } catch {
    return NextResponse.json({ status: 'error', database: false }, { status: 503 });
  }
}
