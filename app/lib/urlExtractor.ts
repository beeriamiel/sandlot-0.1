import FirecrawlApp from 'firecrawl';

function getFirecrawlApp() {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) {
    throw new Error('FIRECRAWL_API_KEY is not set in environment variables');
  }
  return new FirecrawlApp({ apiKey });
}

async function scrapeUrl(url: string) {
  const app = getFirecrawlApp();
  try {
    const scrapeResult = await app.scrapeUrl(url, {
      formats: ['markdown', 'extract'],
      extract: {
        prompt: "Extract key information from this page."
      }
    });

    if (!scrapeResult.success) {
      console.error(`Scraping failed for ${url}: ${scrapeResult.error}`);
      return null;
    }

    return 'data' in scrapeResult ? scrapeResult.data : scrapeResult;
  } catch (error) {
    console.error(`Error scraping ${url}:`, error);
    return null;
  }
}

export async function extractEventUrl(url: string): Promise<string> {
  try {
    const scrapedData = await scrapeUrl(url);
    if (!scrapedData) {
      throw new Error('Failed to scrape URL');
    }

    if (typeof scrapedData === 'object' && 'extract' in scrapedData) {
      const extractedUrl = (scrapedData.extract as any)?.url;
      if (extractedUrl && typeof extractedUrl === 'string') {
        return extractedUrl;
      }
    }

    console.log(`No URL found in extracted data for ${url}, returning original URL`);
    return url;
  } catch (error) {
    console.error(`Error extracting event URL for ${url}:`, error);
    return url;
  }
}