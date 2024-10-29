import { NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: Request) {
  try {
    const { value, prompt, example, model, contextValue } = await request.json();

    if (!value || value.trim() === '') {
      return NextResponse.json({ formattedValue: value });
    }

    const messages = [
      {
        role: 'system',
        content: `Format the following text according to these instructions: ${prompt}\nExample: ${example}${
          contextValue ? `\nContext: ${contextValue}` : ''
        }`,
      },
      {
        role: 'user',
        content: value,
      },
    ];

    const completion = await openai.chat.completions.create({
      model: model || 'gpt-3.5-turbo',
      messages,
      temperature: 0.3,
      max_tokens: 150,
    });

    const formattedValue = completion.choices[0]?.message?.content?.trim() || value;

    return NextResponse.json({ formattedValue });
  } catch (error) {
    console.error('OpenAI API error:', error);
    return NextResponse.json(
      { error: 'Failed to format text' },
      { status: 500 }
    );
  }
}
