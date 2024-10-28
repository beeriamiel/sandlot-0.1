import { NextResponse } from 'next/server';
import axios from 'axios';
import { isAxiosError } from 'axios';

// Add this function to validate and correct URLs
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

export async function POST(request: Request) {
  const body = await request.json();
  let { url } = body;

  if (!url) {
    return NextResponse.json({ error: 'URL is required' }, { status: 400 });
  }

  url = validateAndCorrectUrl(url);
  console.log('Validated URL:', url);

  try {
    const firecrawlResponse = await axios.post('https://api.firecrawl.dev/v1/scrape', {
      url,
      formats: ["markdown", "extract"],
      extract: {
        schema: {
          type: "object",
          properties: {
            name: { type: "string" },
            description: { type: "string" },
            start_date: { type: "string" },
            end_date: { type: "string" },
            city: { type: "string" },
            state: { type: "string" },
            country: { type: "string" },
            attendee_count: { type: "string" },
            topics: { type: "string" },
            event_type: { type: "string" },
            attendee_title: { type: "string" },
            logo_url: { type: "string" },
            sponsorship_options: { type: "string" },
            agenda: { type: "string" },
            audience_insights: { type: "string" },
            sponsors: { type: "string" },
            hosting_company: { type: "string" },
            ticket_cost: { type: "string" },
            contact_email: { type: "string" }
          },
          required: ["name"],
          additionalProperties: true
        },
        prompt: `Extract detailed event information. For each field, provide the information as a simple string. If a field contains multiple items, separate them with commas. If information is not available, use "N/A". Fields to extract:

          - name: Event name
          - description: Brief description of the event
          - start_date: Start date of the event, must be formatted as YYYY-MM-DD
          - end_date: End date of the event, must be formatted as YYYY-MM-DD
          - city: City where the event is held
          - state: Full state name where the event is held
          - country: Country where the event is held
          - attendee_count: Estimated number of attendees (use one of these: 0-100, 100-500, 500-1000, 1000-5000, 5000-10000, 10000+, or N/A if not specified)
          - topics: Main topics or themes of the conference (comma-separated)
          - event_type: Type of event (conference, workshop, or roundtable)
          - attendee_title: Titles of attendees (comma-separated, choose from: C-Suite, Director, Vice President, Manager, Engineer, Analyst, Researcher)
          - logo_url: URL of the event logo
          - sponsorship_options: Available sponsorship options (brief summary)
          - agenda: Brief summary of the event agenda or schedule
          - audience_insights: Brief description of attendee demographics
          - sponsors: List of sponsoring companies (comma-separated)
          - hosting_company: Name of the company or organization hosting the event
          - ticket_cost: Cost of attending the event
          - contact_email: Contact email for the event

          Provide as much accurate information as possible based on the event webpage. Do not invent or assume any information. If a piece of information is not available, use "N/A".`
      }
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.FIRECRAWL_API_KEY}`
      },
      timeout: 55000
    });

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

    const sanitizedData = Object.entries(extractedData).reduce((acc, [key, value]) => {
      acc[key] = value != null ? String(value) : 'N/A';
      return acc;
    }, {} as Record<string, string>);

    return NextResponse.json({ 
      event: sanitizedData,
      markdown: markdown
    });
  } catch (error: any) {
    console.error('Error in API handler:', error);
    let errorMessage = 'Failed to extract event';
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

    return NextResponse.json({ 
      error: errorMessage,
      details: errorDetails
    }, { status: 500 });
  }
}