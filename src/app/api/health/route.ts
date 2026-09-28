import { NextResponse } from 'next/server';

export function GET(): NextResponse {
  return NextResponse.json({ status: 'ok', service: 'atelier-api', timestamp: new Date().toISOString() });
}
