import OpenAI from 'openai';

function getOpenAIInstance() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not set in environment variables');
  }

  return new OpenAI({
    apiKey: apiKey,
    dangerouslyAllowBrowser: true, // Add this line to allow browser usage
    timeout: 30000,
    maxRetries: 3,
  });
}

export async function formatCell(
  value: string,
  prompt: string,
  example: string,
  model: string,
  contextValue?: string
): Promise<string> {
  try {
    if (!value || value.trim() === '') {
      return value;
    }

    const response = await fetch('/api/openai', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        value,
        prompt,
        example,
        model,
        contextValue
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to format text');
    }

    const data = await response.json();
    return data.formattedValue;
  } catch (error) {
    console.error('Error in formatCell:', error);
    return value;
  }
}
