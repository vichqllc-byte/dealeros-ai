import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json({ message: 'Register route scaffolded' }, { status: 501 });
}
