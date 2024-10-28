import { NextResponse } from 'next/server';
import { extractEventUrl } from '../../lib/urlExtractor';

export async function POST(request: Request) {
  try {
    const { url } = await request.json();
    const extractedUrl = await extractEventUrl(url);
    return NextResponse.json({ extractedUrl });
  } catch (error) {
    console.error('Error in extractUrl API route:', error);
    return NextResponse.json({ error: 'Failed to extract URL' }, { status: 500 });
  }
}