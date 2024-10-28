import { z } from 'zod';
import axios, { isAxiosError } from 'axios';

function cleanValue(value: unknown): any {
  if (typeof value === 'string') {
    const cleaned = value.trim().toLowerCase();
    return cleaned === 'n/a' || cleaned === '' ? null : value.trim();
  }
  if (typeof value === 'number') return value;
  if (Array.isArray(value)) {
    return value.map(cleanValue).filter(item => item !== null);
  }
  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, cleanValue(v)])
    );
  }
  return value;
}

export async function extractAndStoreData(url: string, schema: string, prompt: string): Promise<{ data: any; markdown: string }> {
  console.log('Extracting data for URL:', url);
  try {
    const response = await axios.post('/api/extract', { url, schema, prompt }, {
      timeout: 60000
    });
    
    console.log('Raw API response:', response.data);

    if (response.data.error) {
      throw new Error(`API Error: ${response.data.error}\nDetails: ${JSON.stringify(response.data.details)}`);
    }

    if (!response.data.data || !response.data.markdown) {
      throw new Error('Incomplete data received from API');
    }

    const cleanedData = cleanValue(response.data.data);
    
    console.log('Cleaned data:', cleanedData);
    return {
      data: cleanedData,
      markdown: response.data.markdown
    };
  } catch (error) {
    console.error('Error extracting data:', error);
    if (isAxiosError(error)) {
      console.error('Axios error details:', error.response?.data);
      if (error.code === 'ECONNABORTED') {
        throw new Error('Request to API timed out. Please try again.');
      }
      throw new Error(error.response?.data?.error || 'Failed to extract data');
    }
    throw error;
  }
}
