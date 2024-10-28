import type { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';
import { isAxiosError } from 'axios';

function validateAndCorrectUrl(url: string): string {
  try {
    const parsedUrl = new URL(url);
    const hostnameParts = parsedUrl.hostname.split('.');
    if (hostnameParts.length < 2) {
      parsedUrl.hostname = `www.${parsedUrl.hostname}`;
    }
    return parsedUrl.toString();
  } catch (error) {
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return validateAndCorrectUrl(`https://${url}`);
    }
    return url;
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  console.log('Firecrawl API Key:', process.env.FIRECRAWL_API_KEY ? 'Set' : 'Not set');

  if (req.method === 'POST') {
    console.log('Received POST request:', req.body);
    try {
      let { url, schema, prompt } = req.body;
      if (!url || !schema || !prompt) {
        throw new Error('URL, schema, and prompt are required');
      }

      url = validateAndCorrectUrl(url);
      console.log('Validated URL:', url);

      console.log('Attempting to connect to Firecrawl API...');
      
      const firecrawlResponse = await axios.post('https://api.firecrawl.dev/v1/scrape', {
        url,
        formats: ["markdown", "extract"],
        extract: {
          schema: JSON.parse(schema),
          prompt
        }
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.FIRECRAWL_API_KEY}`
        },
        timeout: 55000
      });

      console.log('Firecrawl API response received');
      console.log('Firecrawl API response status:', firecrawlResponse.status);
      console.log('Firecrawl API response data:', JSON.stringify(firecrawlResponse.data, null, 2));

      let extractedData, markdown;

      if (firecrawlResponse.data && firecrawlResponse.data.data) {
        extractedData = firecrawlResponse.data.data.extract;
        markdown = firecrawlResponse.data.data.markdown;
      } else if (firecrawlResponse.data && firecrawlResponse.data.extract) {
        extractedData = firecrawlResponse.data.extract;
        markdown = firecrawlResponse.data.markdown || '';
      } else {
        throw new Error('Unexpected response structure from Firecrawl API');
      }

      res.status(200).json({ 
        data: extractedData,
        markdown: markdown
      });
    } catch (error: any) {
      console.error('Error in API handler:', error);
      let errorMessage = 'Failed to extract data';
      let errorDetails: any = {};

      if (isAxiosError(error)) {
        console.error('Axios error:', error.message);
        console.error('Axios error code:', error.code);
        console.error('Axios error response:', error.response?.data);

        if (error.code === 'ECONNABORTED') {
          errorMessage = 'Request to Firecrawl API timed out';
        } else if (error.response) {
          errorMessage = `Firecrawl API error: ${error.response.status} ${error.response.statusText}`;
          if (error.response.status === 500) {
            errorMessage += ' (Possible JSON parsing error)';
          }
        }
        errorDetails = {
          code: error.code,
          message: error.message,
          response: error.response?.data
        };
      } else if (error instanceof Error) {
        errorMessage = error.message;
        errorDetails = {
          name: error.name,
          stack: error.stack
        };
      }

      res.status(200).json({ 
        error: errorMessage,
        details: errorDetails
      });
    }
  } else {
    res.setHeader('Allow', ['POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  }
}
