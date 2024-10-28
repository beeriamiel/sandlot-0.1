import { NextResponse } from 'next/server';
import { getTablesFromSupabase } from '../../lib/database';

export async function GET() {
  try {
    const tables = await getTablesFromSupabase();
    return NextResponse.json(tables);
  } catch (error) {
    console.error('Error fetching tables:', error);
    return NextResponse.json({ error: 'Failed to fetch tables' }, { status: 500 });
  }
}