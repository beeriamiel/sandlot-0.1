import { NextApiRequest, NextApiResponse } from 'next';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { content, prompt, example, model, contextContent } = req.body;

  try {
    let userContent = `Format the following content according to this prompt: "${prompt}". Here's an example: "${example}". Content to format: "${content}"`;
    
    if (contextContent) {
      userContent += ` Additional context: "${contextContent}"`;
    }

    const response = await openai.chat.completions.create({
      model: model,
      messages: [
        { role: "system", content: "You are a helpful assistant that formats data according to given instructions." },
        { role: "user", content: userContent }
      ],
    });

    const formattedContent = response.choices[0].message.content || content;
    res.status(200).json({ formattedContent });
  } catch (error) {
    console.error('Error formatting cell:', error);
    res.status(500).json({ error: 'Failed to format cell' });
  }
}
