import { NextResponse } from 'next/server';
import { supabase } from '../../lib/database';
import { formatCell } from '../../lib/formatting';

// Define an interface for the filter object
interface Filter {
  column: string;
  operation: string;
  value: string | number | boolean;
}

export async function POST(request: Request) {
  const { table, column, formatting, filters, selectedIds } = await request.json();
  const { scope } = formatting;

  try {
    console.log('Starting format request:', { table, column, scope, formatting });
    
    // First, select the required columns
    let query = supabase.from(table).select(`id, ${column}, ${formatting.contextColumn || column}`);
    
    // Apply any existing filters
    if (Array.isArray(filters)) {
      filters.forEach((filter: Filter) => {
        if (filter.column && filter.operation && filter.value !== undefined) {
          query = query.filter(filter.column, filter.operation, filter.value);
        }
      });
    }

    // Handle scope-based filtering
    switch (scope) {
      case 'one':
        query = query.limit(1);
        break;
      case 'ten':
        query = query.limit(10);
        break;
      case 'selected':
        // Filter by selected IDs instead of checked column
        if (selectedIds && selectedIds.length > 0) {
          query = query.in('id', selectedIds);
        }
        break;
      // 'all' case doesn't need any limit
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching data:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data || data.length === 0) {
      return NextResponse.json({ error: 'No rows found to format' }, { status: 404 });
    }

    console.log(`Found ${data.length} rows to process`);

    const updatedRows = [];
    for (const row of data) {
      try {
        console.log(`Processing row ${row.id}:`, {
          currentValue: row[column],
          contextValue: row[formatting.contextColumn]
        });
        
        const formattedValue = await formatCell(
          row[column],
          formatting.prompt,
          formatting.example,
          formatting.model,
          formatting.contextColumn ? row[formatting.contextColumn] : undefined
        );
        
        console.log('Formatted value for row', row.id, ':', formattedValue);

        if (formattedValue && formattedValue !== row[column]) {
          const { error: updateError } = await supabase
            .from(table)
            .update({ [column]: formattedValue })
            .eq('id', row.id);

          if (updateError) {
            console.error('Error updating row:', updateError);
            continue;
          }

          updatedRows.push({
            id: row.id,
            [column]: formattedValue,
            previousValue: row[column]
          });
          
          console.log(`Successfully updated row ${row.id}`);
        } else {
          console.log(`No changes needed for row ${row.id}`);
        }
        
      } catch (error) {
        console.error(`Error processing row ${row.id}:`, error);
      }
    }

    return NextResponse.json({ 
      success: true,
      processedRows: data.length,
      updatedRows: updatedRows,
      message: updatedRows.length === 0 ? 'No rows were updated' : 'Rows updated successfully'
    });
  } catch (error) {
    console.error('Error in format route:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
