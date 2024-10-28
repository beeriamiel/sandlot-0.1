import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET() {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .order('created_at', { ascending: false });
  
  if (error) {
    return NextResponse.json({ error: 'Error fetching events' }, { status: 500 });
  }
  
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const { url } = await request.json();
  
  // Implement your event extraction logic here
  // For now, we'll just add a dummy event
  const newEvent = {
    name: 'Dummy Event',
    date: new Date().toISOString(),
    location: 'Dummy Location'
  };

  const { data, error } = await supabase
    .from('events')
    .insert([newEvent]);

  if (error) {
    return NextResponse.json({ error: 'Error adding event' }, { status: 500 });
  }

  return NextResponse.json(data);
}