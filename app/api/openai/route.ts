import { NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

export async function POST(request: Request) {
  try {
    const { value, prompt, example, model, contextValue } = await request.json();

    const modelMap: { [key: string]: string } = {
      'gpt-4o-mini': 'gpt-4-1106-preview',
      'gpt-3.5-turbo': 'gpt-3.5-turbo-1106'
    };

    const openaiModel = modelMap[model] || 'gpt-3.5-turbo-1106';

    console.log('Processing OpenAI request:', {
      valueLength: value?.length,
      hasPrompt: !!prompt,
      hasExample: !!example,
      model: openaiModel,
      hasContext: !!contextValue
    });

    const messages = [
      {
        role: 'system',
        content: `${prompt}\n\nExample:\nInput: ${example}`
      },
      {
        role: 'user',
        content: contextValue 
          ? `Format this text (with context):\nText: ${value}\nContext: ${contextValue}`
          : `Format this text:\n${value}`
      }
    ];

    // Add retry logic for API calls
    let retries = 3;
    let lastError;

    while (retries > 0) {
      try {
        const completion = await openai.chat.completions.create({
          model: openaiModel,
          messages: messages as any[],
          temperature: 0.3,
          max_tokens: 150,
          presence_penalty: 0,
          frequency_penalty: 0
        });

        if (!completion.choices?.[0]?.message?.content) {
          throw new Error('No content in OpenAI response');
        }

        console.log('OpenAI response received successfully');
        
        return NextResponse.json({ 
          formattedValue: completion.choices[0].message.content.trim() 
        });
      } catch (error: any) {
        lastError = error;
        retries--;
        if (retries > 0) {
          // Wait before retrying (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, (3 - retries) * 1000));
          continue;
        }
        break;
      }
    }

    console.error('OpenAI API Error after retries:', lastError);
    return NextResponse.json({ 
      error: lastError?.message || 'Failed to format text' 
    }, { 
      status: 500 
    });
  } catch (error: any) {
    console.error('OpenAI API Error:', error);
    return NextResponse.json({ 
      error: error.message || 'Failed to format text' 
    }, { 
      status: 500 
    });
  }
}
