import { createClient } from '@supabase/supabase-js'

// Define the SavedFormat interface
interface SavedFormat {
  name: string;
  prompt: string;
  example: string;
  model: string;
}

interface Filter {
  column: string;
  operation: string;
  value: string | number | boolean;
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(`Missing Supabase environment variables.`)
}

console.log('Supabase URL:', supabaseUrl);
console.log('Supabase Anon Key:', supabaseAnonKey.substring(0, 5) + '...');

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true // Changed to true to persist the session
  },
  db: {
    schema: 'public'
  }
})

// Add a cache for the auth status
let authStatusCache: {
  user: any;
  expiresAt: number;
} | null = null;

// Add a cache for saved formats
let savedFormatsCache: {
  formats: SavedFormat[];
  expiresAt: number;
} | null = null;

// Add a cache for table names
let tableNamesCache: {
  tables: string[];
  expiresAt: number;
} | null = null;

// Update the signIn function for email authentication
export const signIn = async (email: string) => {
  try {
    const { data, error } = await supabase.auth.signInWithOtp({
      email: email,
    })
    if (error) {
      if (error.message.includes('rate limit')) {
        throw new Error('RATE_LIMIT_ERROR');
      }
      throw error;
    }
    return data;
  } catch (error) {
    console.error('Error in signIn:', error);
    throw error;
  }
}

// Update signOut to clear the auth cache and saved formats cache
export const signOut = async () => {
  const { error } = await supabase.auth.signOut()
  authStatusCache = null; // Clear the auth cache on sign out
  savedFormatsCache = null; // Clear the saved formats cache on sign out
  if (error) throw error
}

export const getCurrentUser = async () => {
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function getDataFromSupabase(table: string, page = 1, pageSize = 50, filters: Filter[] = []) {
  let query = supabase
    .from(table)
    .select('*', { count: 'exact' })
    .range((page - 1) * pageSize, page * pageSize - 1);

  filters.forEach(filter => {
    query = query.filter(filter.column, filter.operation, filter.value);
  });

  const { data, error, count } = await query;

  if (error) throw error;
  return { data, totalRows: count };
}

export async function saveEventsToDatabase(table: string, events: any[]) {
  const { data, error } = await supabase
    .from(table)
    .upsert(events, { onConflict: 'url' });

  if (error) throw error;
  return data;
}

export async function getTablesFromSupabase() {
  try {
    console.log('Fetching tables...');
    const { data, error } = await supabase.rpc('get_tables');

    if (error) {
      console.error('Error fetching tables:', {
        error,
        message: error.message,
        details: error.details,
        hint: error.hint
      });
      throw error;
    }

    if (!data) {
      console.warn('No tables found in the database');
      return [];
    }

    console.log('Successfully fetched tables:', {
      tableCount: data.length,
      tables: data
    });
    
    return data;
  } catch (error) {
    console.error('Error in getTablesFromSupabase:', {
      error,
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    throw error;
  }
}

export async function saveDataToDatabase(table: string, data: any[]) {
  const { data: result, error } = await supabase
    .from(table)
    .upsert(data, { onConflict: 'url' });

  if (error) throw error;
  return result;
}

export async function getSavedFormatsFromSupabase(): Promise<SavedFormat[]> {
  // Check if we have a cached saved formats that hasn't expired
  if (savedFormatsCache && savedFormatsCache.expiresAt > Date.now()) {
    return savedFormatsCache.formats;
  }

  return retryOperation(async () => {
    try {
      await checkAuthStatus(); // This now uses the cached version if available
      const { data, error } = await supabase
        .from('saved_formats')
        .select('*');

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }

      if (!data) {
        console.warn('No saved formats found');
        return [];
      }

      // Cache the saved formats for 5 minutes
      savedFormatsCache = {
        formats: data as SavedFormat[],
        expiresAt: Date.now() + 5 * 60 * 1000
      };

      console.log(`Successfully fetched ${data.length} saved formats`);
      return data as SavedFormat[];
    } catch (error) {
      console.error('Error fetching saved formats:', error);
      if (error instanceof Error) {
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
      }
      throw error;
    }
  }, 3, 1000); // 3 retries, 1 second delay
}

export async function saveFormatToSupabase(format: {
  name: string;
  prompt: string;
  example: string;
  model: string;
}) {
  return retryOperation(async () => {
    try {
      const { data, error } = await supabase
        .from('saved_formats')
        .upsert(format, { 
          onConflict: 'name',
          ignoreDuplicates: false
        });

      if (error) throw error;

      return data;
    } catch (error) {
      console.error('Error in saveFormatToSupabase:', error);
      throw error;
    }
  });
}

export async function checkAuthStatus() {
  // Check if we have a cached auth status that hasn't expired
  if (authStatusCache && authStatusCache.expiresAt > Date.now()) {
    return authStatusCache.user;
  }

  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) {
    console.error('Error checking auth status:', error);
    throw error;
  }
  if (!session) {
    console.warn('User is not authenticated');
    throw new Error('User is not authenticated');
  }

  // Cache the auth status for 5 minutes
  authStatusCache = {
    user: session.user,
    expiresAt: Date.now() + 5 * 60 * 1000
  };

  console.log('User is authenticated:', session.user);
  return session.user;
}

async function retryOperation<T>(operation: () => Promise<T>, maxRetries = 3, delay = 1000): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  throw new Error('Max retries reached');
}

export async function testSupabaseConnection() {
  try {
    console.log('Testing Supabase connection...');
    console.log('Supabase URL:', supabaseUrl ? 'Set' : 'Not set');
    console.log('Supabase Anon Key:', supabaseAnonKey ? 'Set' : 'Not set');

    // Test if we can list available functions
    const { data: functions, error: functionError } = await supabase.rpc('get_tables');
    
    console.log('Available functions response:', { functions, functionError });

    if (functionError) {
      console.error('Function test failed:', functionError);
      return false;
    }

    console.log('Supabase connection successful:', {
      url: supabaseUrl,
      hasData: !!functions,
      functions: functions
    });
    
    return true;
  } catch (error) {
    console.error('Supabase connection test failed:', {
      error,
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    return false;
  }
}
