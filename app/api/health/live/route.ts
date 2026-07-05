import { NextResponse } from 'next/server';

// Liveness probe: process is up and able to handle a request at all - no
// DB dependency, so it stays healthy even if the database is briefly
// unreachable (that's what /api/health/ready is for).
export async function GET() {
  return NextResponse.json({ status: 'ok' });
}
