'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Layout from './Layout';
import { ColumnMenu } from './ColumnMenu';
import { saveEventsToDatabase, getDataFromSupabase, getSavedFormatsFromSupabase, saveFormatToSupabase, checkAuthStatus, getTablesFromSupabase, testSupabaseConnection } from '../lib/database';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Upload, ChevronDown, X } from "lucide-react";
import { JsonView, allExpanded, darkStyles } from 'react-json-view-lite';
import { formatCell } from '../lib/formatting';
import { ScrollArea } from "@/components/ui/scroll-area";
import { ResizableHeader } from './ResizableHeader';

type DataRow = {
  id: number;
  checked: boolean;
  [key: string]: string | boolean | number; // This needs to come after the specific properties
};

interface ColumnFormatting {
  prompt: string;
  example: string;
  scope: 'one' | 'ten' | 'all' | 'selected';  // Added 'selected' here
  model: string;
  contextColumn?: string;
}

interface SavedFormat {
  name: string;
  prompt: string;
  example: string;
  model: string;
}

interface Filter {
  column: string;
  operation: 'equal' | 'not_equal' | 'contains' | 'not_contains' | 'greater' | 'less' | 'empty' | 'not_empty';
  value: string;
}

interface DataFormatterProps {
  initialData?: DataRow[];
}

const ROWS_PER_PAGE = 50;

// Update the UpdatedRow interface
interface UpdatedRow extends DataRow {
  [key: string]: string | boolean | number;
}

export default function DataFormatter({ initialData = [] }: DataFormatterProps) {
  const [data, setData] = useState<DataRow[]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [filters, setFilters] = useState<Filter[]>([]);
  const [columnFormatting, setColumnFormatting] = useState<Record<string, ColumnFormatting>>({});
  const [isFormatting, setIsFormatting] = useState(false);
  const [dataSource, setDataSource] = useState<'csv' | 'supabase' | 'eventSpreadsheet' | null>(null);
  const [allChecked, setAllChecked] = useState(false);
  const [tables, setTables] = useState<string[]>([]);
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [fileUploadError, setFileUploadError] = useState<string | null>(null);

  const [savedFormats, setSavedFormats] = useState<SavedFormat[]>([]);
  const [currentModel, setCurrentModel] = useState<Record<string, string>>({});
  const models = ['gpt-3.5-turbo', 'gpt-4o-mini']; // Updated model list

  const [selectedColumn, setSelectedColumn] = useState<string>('');
  const [selectedOperation, setSelectedOperation] = useState<Filter['operation']>('equal');
  const [filterValue, setFilterValue] = useState<string>('');
  const [lastTableFetch, setLastTableFetch] = useState(0);

  const [editingCell, setEditingCell] = useState<{ rowIndex: number; columnName: string } | null>(null);
  const [columnWidths, setColumnWidths] = useState<{[key: string]: number}>({});

  const [isLoadingTables, setIsLoadingTables] = useState(false);

  // Add this to your state declarations
  const [formattingCells, setFormattingCells] = useState<Set<string>>(new Set());

  // Add new state for tracking check all scope
  const [checkAllScope, setCheckAllScope] = useState<'page' | 'all'>('page');

  // Add this new function after the component declaration but before other functions
  const toggleAllRowsInDatabase = async (checked: boolean) => {
    if (!selectedTable) return;
    
    try {
      // Fetch all row IDs from the database
      const { data: allIds } = await getDataFromSupabase(
        selectedTable, 
        1, 
        Number.MAX_SAFE_INTEGER, 
        filters,
        true // Add this parameter to your getDataFromSupabase function to only fetch IDs
      );
      
      if (!Array.isArray(allIds)) return;
      
      // Update the data state with all rows checked/unchecked
      setData(prevData => {
        const idSet = new Set(allIds.map(row => row.id));
        return prevData.map(row => ({
          ...row,
          checked: idSet.has(row.id) ? checked : row.checked
        }));
      });
      
      // Update totalChecked count
      setTotalChecked(checked ? allIds.length : 0);
    } catch (error) {
      console.error('Error toggling all rows:', error);
      alert('Failed to toggle all rows. Please try again.');
    }
  };

  // Add this new state
  const [totalChecked, setTotalChecked] = useState(0);

  // Add this function
  const fetchSavedFormats = useCallback(async () => {
    try {
      const formats = await getSavedFormatsFromSupabase();
      setSavedFormats(formats);
    } catch (error) {
      console.error('Error fetching saved formats:', error);
      alert('Failed to fetch saved formats. Please try again later.');
    }
  }, []);

  // Add this function
  const handleSetFormatting = (
    columnName: string, 
    prompt: string, 
    example: string, 
    scope: 'one' | 'ten' | 'all' | 'selected',  // Updated type here
    model: string, 
    contextColumn?: string
  ) => {
    setColumnFormatting(prevState => ({
      ...prevState,
      [columnName]: { prompt, example, scope, model, contextColumn }
    }));
    setCurrentModel(prevState => ({ ...prevState, [columnName]: model }));
  };

  // Add this function
  const handleSaveFormat = useCallback(async (name: string, prompt: string, example: string, model: string) => {
    try {
      await saveFormatToSupabase({ name, prompt, example, model });
      alert('Format saved successfully!');
      await fetchSavedFormats();
    } catch (error) {
      console.error('Error saving format:', error);
      alert('Failed to save format. Check console for details.');
    }
  }, [fetchSavedFormats]);

  // Keep this as the only initialization useEffect
  useEffect(() => {
    const initializeSupabase = async () => {
      try {
        console.log('Starting Supabase initialization...');
        setIsLoadingTables(true);
        
        // Test connection
        const isConnected = await testSupabaseConnection();
        console.log('Connection test result:', isConnected);
        
        if (!isConnected) {
          console.error('Failed to connect to Supabase');
          alert('Failed to connect to Supabase. Please check your configuration.');
          return;
        }

        // If connected, fetch tables
        const fetchedTables = await getTablesFromSupabase();
        console.log('Initial tables fetch:', fetchedTables);
        
        if (Array.isArray(fetchedTables)) {
          const tableNames = fetchedTables.map((table: { table_name: string }) => table.table_name);
          console.log('Setting tables in state:', tableNames);
          setTables(tableNames);
        } else {
          console.error('Unexpected tables data format:', fetchedTables);
        }

        // Initialize other data if needed
        if (initialData.length > 0) {
          setData(initialData.map(row => ({ ...row, checked: false })));
          setDataSource('eventSpreadsheet');
        }
      } catch (error) {
        console.error('Initialization error:', error);
        alert('Failed to initialize the application. Please check the console for details.');
      } finally {
        setIsLoadingTables(false);
      }
    };

    initializeSupabase();
  }, []); // Run once on component mount

  useEffect(() => {
    if (selectedTable && dataSource !== 'supabase') {
      fetchPagedData();
    }
  }, [selectedTable, currentPage, filters, dataSource]);

  const fetchPagedData = useCallback(async () => {
    if (!selectedTable) return;

    try {
      const { data: fetchedData, totalRows: total } = await getDataFromSupabase(selectedTable, currentPage, ROWS_PER_PAGE, filters);
      if (Array.isArray(fetchedData)) {
        setData(fetchedData.map((row: DataRow) => ({ 
          ...row, 
          checked: allChecked // Maintain checked state based on allChecked
        })));
        setTotalRows(total || 0);
      } else {
        console.error('Fetched data is not an array:', fetchedData);
        setData([]);
        setTotalRows(0);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      alert('Failed to fetch data. Please try again.');
    }
  }, [selectedTable, currentPage, filters, allChecked]); // Add allChecked to dependencies

  const runFormatting = async () => {
    setIsFormatting(true);
    try {
      for (const [columnName, formatting] of Object.entries(columnFormatting)) {
        const { prompt, example, scope, model, contextColumn } = formatting;
        console.log('Starting formatting for column:', columnName, {
          scope,
          model,
          contextColumn
        });

        // Get the rows to format based on scope
        let rowsToFormat: DataRow[] = [];
        switch (scope) {
          case 'one':
            rowsToFormat = data.slice(0, 1);
            break;
          case 'ten':
            rowsToFormat = data.slice(0, 10);
            break;
          case 'selected':
            rowsToFormat = data.filter(row => row.checked);
            if (rowsToFormat.length === 0) {
              alert('Please select at least one row to format');
              setIsFormatting(false);
              return;
            }
            break;
          case 'all':
            rowsToFormat = data;
            break;
        }

        console.log(`Processing ${rowsToFormat.length} rows`);

        // Process rows sequentially to avoid rate limits
        const updatedRows: UpdatedRow[] = [];
        
        for (const row of rowsToFormat) {
          try {
            console.log(`Processing row ${row.id}`);
            const currentValue = String(row[columnName] || '');
            
            // Add the row to formattingCells
            const cellKey = `${row.id}-${columnName}`;
            setFormattingCells(prev => new Set(prev).add(cellKey));

            const formattedValue = await formatCell(
              currentValue,
              prompt,
              example,
              model,
              contextColumn ? String(row[contextColumn] || '') : undefined
            );

            // Remove the row from formattingCells
            setFormattingCells(prev => {
              const next = new Set(prev);
              next.delete(cellKey);
              return next;
            });

            if (formattedValue && formattedValue !== currentValue) {
              const updatedRow: UpdatedRow = {
                ...row,
                id: row.id,
                checked: row.checked,
                [columnName]: formattedValue
              };
              updatedRows.push(updatedRow);

              // Update the UI immediately after each row is processed
              setData(prevData => {
                const newData = [...prevData];
                const index = newData.findIndex(r => r.id === row.id);
                if (index !== -1) {
                  newData[index] = updatedRow;
                }
                return newData;
              });
            }

            // Add a small delay between rows to avoid rate limits
            await new Promise(resolve => setTimeout(resolve, 500));

          } catch (error) {
            console.error(`Error formatting row ${row.id}:`, error);
          }
        }

        console.log(`Formatting completed for column: ${columnName}`);
        console.log(`Updated ${updatedRows.length} rows`);
      }
    } catch (error) {
      console.error('Error during formatting:', error);
      alert(`Formatting failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsFormatting(false);
      setFormattingCells(new Set()); // Clear any remaining formatting cells
    }
  };

  const downloadCSV = () => {
    // Implement CSV download logic
  };

  const sendToSupabase = async () => {
    if (!selectedTable) {
      alert('Please select a table first.');
      return;
    }
    try {
      await checkAuthStatus(); // Ensure user is authenticated
      const dataToSend = data
        .filter(row => row.checked)
        .map(({ checked, ...rest }) => {
          const cleanedRow: { [key: string]: any } = {};
          for (const key in rest) {
            if (Object.prototype.hasOwnProperty.call(rest, key) && key !== 'id') {
              cleanedRow[key] = rest[key];
            }
          }
          return cleanedRow;
        });
      await saveEventsToDatabase(selectedTable, dataToSend);
      alert(`Data successfully sent to Supabase table: ${selectedTable}!`);
    } catch (error) {
      console.error('Error sending data to Supabase:', error);
      alert('Failed to send data to Supabase. Check console for details.');
    }
  };

  const getFromSupabase = async () => {
    if (!selectedTable) {
      alert('Please select a table first.');
      return;
    }
    try {
      await checkAuthStatus(); // Ensure user is authenticated
      const { data: fetchedData, totalRows: total } = await getDataFromSupabase(selectedTable);
      if (Array.isArray(fetchedData) && fetchedData.length > 0) {
        const newData = fetchedData.map((row: DataRow) => ({ ...row, checked: false }));
        setData(newData);
        setDataSource('supabase');
        setCurrentPage(1);
        setTotalRows(total || newData.length);
        alert(`Data successfully fetched from Supabase table: ${selectedTable}`);
        if (newData.length > 10000) {
          alert('Warning: Large dataset detected. Performance may be affected.');
        }
      } else {
        alert('No data available from the selected table.');
      }
    } catch (error) {
      console.error('Error fetching data from Supabase:', error);
      alert(`Failed to fetch data from Supabase: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Update the toggleAllChecked function
  const toggleAllChecked = useCallback(async () => {
    const newAllChecked = !allChecked;
    setAllChecked(newAllChecked);

    if (checkAllScope === 'page') {
      // Only update current page
      const startIndex = (currentPage - 1) * ROWS_PER_PAGE;
      const endIndex = startIndex + ROWS_PER_PAGE;
      
      setData(prevData => prevData.map((row, index) => ({
        ...row,
        checked: index >= startIndex && index < endIndex ? newAllChecked : row.checked
      })));
      
      // Update totalChecked for current page
      setTotalChecked(prev => {
        const currentPageChecked = ROWS_PER_PAGE * (newAllChecked ? 1 : 0);
        const otherPagesChecked = prev - (ROWS_PER_PAGE * (allChecked ? 1 : 0));
        return Math.max(0, currentPageChecked + otherPagesChecked);
      });
    } else {
      // Update all pages
      await toggleAllRowsInDatabase(newAllChecked);
    }
  }, [allChecked, checkAllScope, currentPage, selectedTable, filters]);

  // Update the toggleRowChecked function
  const toggleRowChecked = (index: number) => {
    setData(prev => prev.map((row, i) => {
      if (i === index) {
        const newChecked = !row.checked;
        // Update totalChecked when individual row is toggled
        setTotalChecked(prev => prev + (newChecked ? 1 : -1));
        return { ...row, checked: newChecked };
      }
      return row;
    }));
  };

  const handleUploadClick = () => {
    const fileInput = document.getElementById('csv-upload') as HTMLInputElement;
    if (fileInput) {
      fileInput.click();
    }
  };

  const handleCellEdit = useCallback((rowIndex: number, columnName: string, value: string) => {
    setData(prevData => {
      const newData = [...prevData];
      newData[rowIndex] = { ...newData[rowIndex], [columnName]: value };
      return newData;
    });
    setEditingCell(null);
  }, []);

  const renderCellContent = useCallback((value: any, rowIndex: number, columnName: string) => {
    const cellKey = `${rowIndex}-${columnName}`;
    const isFormatting = formattingCells.has(cellKey);

    if (isFormatting) {
      return <div className="animate-pulse">Formatting...</div>;
    }

    if (editingCell?.rowIndex === rowIndex && editingCell?.columnName === columnName) {
      return (
        <Input
          autoFocus
          defaultValue={String(value)}
          onBlur={(e) => handleCellEdit(rowIndex, columnName, e.target.value)}
          onKeyPress={(e) => {
            if (e.key === 'Enter') {
              handleCellEdit(rowIndex, columnName, (e.target as HTMLInputElement).value);
            }
          }}
        />
      );
    }

    if (typeof value === 'object' && value !== null) {
      return (
        <div onClick={() => setEditingCell({ rowIndex, columnName })}>
          <JsonView 
            data={value} 
            style={darkStyles}
            shouldExpandNode={allExpanded} 
          />
        </div>
      );
    }

    return (
      <div 
        onClick={() => setEditingCell({ rowIndex, columnName })}
        className="cursor-pointer hover:bg-gray-100 p-1 rounded"
      >
        <ScrollArea className="h-[100px] w-full">
          {String(value)}
        </ScrollArea>
      </div>
    );
  }, [editingCell, formattingCells]);

  const addFilter = () => {
    if (selectedColumn && selectedOperation) {
      setFilters([...filters, { column: selectedColumn, operation: selectedOperation, value: filterValue }]);
      setSelectedColumn('');
      setSelectedOperation('equal');
      setFilterValue('');
    }
  };

  const removeFilter = (index: number) => {
    setFilters(filters.filter((_, i) => i !== index));
  };

  const clearFilters = () => {
    setFilters([]);
  };

  const applyFilters = useCallback((data: DataRow[]) => {
    return data.filter(row => {
      return filters.every(filter => {
        const cellValue = String(row[filter.column]);
        switch (filter.operation) {
          case 'equal':
            return cellValue === filter.value;
          case 'not_equal':
            return cellValue !== filter.value;
          case 'contains':
            return cellValue.includes(filter.value);
          case 'not_contains':
            return !cellValue.includes(filter.value);
          case 'greater':
            return parseFloat(cellValue) > parseFloat(filter.value);
          case 'less':
            return parseFloat(cellValue) < parseFloat(filter.value);
          case 'empty':
            return cellValue === '' || cellValue === null || cellValue === undefined;
          case 'not_empty':
            return cellValue !== '' && cellValue !== null && cellValue !== undefined;
          default:
            return true;
        }
      });
    });
  }, [filters]);

  const filteredData = useMemo(() => applyFilters(data), [data, filters]);

  const handleColumnResize = useCallback((columnName: string, width: number) => {
    setColumnWidths(prev => ({ ...prev, [columnName]: width }));
  }, []);

  // Add this function back
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    setFileUploadError(null);
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const content = e.target?.result as string;
          const rows = content.split('\n').map(row => row.split(','));
          const headers = rows[0];
          const dataRows = rows.slice(1).map((row, index) => {
            const dataRow: DataRow = {
              id: index + 1,
              checked: false
            };
            headers.forEach((header, idx) => {
              const value = row[idx]?.trim() || '';
              dataRow[header.trim()] = value;
            });
            return dataRow;
          });
          setData(dataRows);
          setTotalRows(dataRows.length);
          setDataSource('csv');
          setCurrentPage(1);
          if (dataRows.length > 10000) {
            alert('Warning: Large dataset detected. Performance may be affected.');
          }
        } catch (error) {
          console.error("Error processing file:", error);
          setFileUploadError("Error processing file. Please check the console for details.");
        }
      };
      reader.onerror = (error) => {
        console.error("Error reading file:", error);
        setFileUploadError("Error reading file. Please try again.");
      };
      reader.readAsText(file);
    } else {
      setFileUploadError("No file selected. Please choose a CSV file.");
    }
  };

  // Save state to localStorage whenever it changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('dataFormatterRows', JSON.stringify(data));
      localStorage.setItem('dataFormatterColumnWidths', JSON.stringify(columnWidths));
      localStorage.setItem('dataFormatterFilters', JSON.stringify(filters));
      localStorage.setItem('dataFormatterColumnFormatting', JSON.stringify(columnFormatting));
      localStorage.setItem('dataFormatterCurrentPage', currentPage.toString());
    }
  }, [data, columnWidths, filters, columnFormatting, currentPage]);

  // Add clear functionality
  const clearAll = () => {
    setData([]);
    setFilters([]);
    setColumnFormatting({});
    setCurrentPage(1);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('dataFormatterRows');
      localStorage.removeItem('dataFormatterColumnWidths');
      localStorage.removeItem('dataFormatterFilters');
      localStorage.removeItem('dataFormatterColumnFormatting');
      localStorage.removeItem('dataFormatterCurrentPage');
    }
  };

  // Add this useEffect to handle client-side initialization
  useEffect(() => {
    // Only run on client-side after initial render
    const savedData = localStorage.getItem('dataFormatterRows');
    const savedPage = localStorage.getItem('dataFormatterCurrentPage');
    const savedFilters = localStorage.getItem('dataFormatterFilters');
    const savedFormatting = localStorage.getItem('dataFormatterColumnFormatting');

    if (savedData) setData(JSON.parse(savedData));
    if (savedPage) setCurrentPage(parseInt(savedPage, 10));
    if (savedFilters) setFilters(JSON.parse(savedFilters));
    if (savedFormatting) setColumnFormatting(JSON.parse(savedFormatting));
  }, []); // Empty dependency array means this runs once after mount

  // Update the pagination section to handle undefined totalRows
  const totalPages = Math.max(1, Math.ceil(totalRows / ROWS_PER_PAGE));

  // Add this effect to update allChecked state based on totalChecked
  useEffect(() => {
    if (dataSource === 'supabase') {
      setAllChecked(totalChecked === totalRows);
    } else {
      setAllChecked(totalChecked === data.length);
    }
  }, [totalChecked, totalRows, data.length, dataSource]);

  return (
    <Layout>
      <Card>
        <CardHeader>
          <CardTitle>Data Formatter</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 mb-6 justify-between">
            <div className="flex gap-4">
              <Button 
                onClick={runFormatting} 
                disabled={isFormatting || Object.keys(columnFormatting).length === 0}
              >
                {isFormatting ? 'Formatting...' : 'Run Formatting'}
              </Button>
            </div>
            
            {/* Add a progress indicator */}
            {isFormatting && (
              <div className="text-sm text-gray-500">
                Formatting in progress... This may take a while for large datasets.
              </div>
            )}

            <div className="flex gap-4">
              <Select 
                value={selectedTable || ''} 
                onValueChange={setSelectedTable}
                disabled={isLoadingTables}
              >
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder={isLoadingTables ? "Loading tables..." : "Select Table"} />
                </SelectTrigger>
                <SelectContent>
                  {isLoadingTables ? (
                    <SelectItem value="loading" disabled>
                      Loading tables...
                    </SelectItem>
                  ) : tables.length > 0 ? (
                    tables.map((table: string) => (
                      <SelectItem key={table} value={table}>
                        {table}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="no-tables" disabled>
                      No tables available
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button className="w-[150px]">
                    Actions <ChevronDown className="ml-2 h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onSelect={handleUploadClick}>
                    <Upload className="mr-2 h-4 w-4" /> Upload CSV
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={getFromSupabase}>
                    Get data from Supabase
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={downloadCSV}>
                    Download CSV
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={sendToSupabase}>
                    Send to Supabase
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <Input 
            id="csv-upload"
            type="file" 
            accept=".csv" 
            onChange={handleFileUpload} 
            className="hidden"
          />

          {fileUploadError && (
            <p className="text-red-500 text-sm mb-4">{fileUploadError}</p>
          )}

          {/* Add Filter UI */}
          <Card className="mb-4">
            <CardContent className="flex flex-wrap items-center gap-4 p-4">
              <Select value={selectedColumn} onValueChange={setSelectedColumn}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Select column" />
                </SelectTrigger>
                <SelectContent>
                  {Object.keys(data[0] || {}).map((column) => (
                    <SelectItem key={column} value={column}>
                      {column}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={selectedOperation} onValueChange={(value) => setSelectedOperation(value as Filter['operation'])}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Select operation" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="equal">Equal to</SelectItem>
                  <SelectItem value="not_equal">Not equal to</SelectItem>
                  <SelectItem value="contains">Contains</SelectItem>
                  <SelectItem value="not_contains">Does not contain</SelectItem>
                  <SelectItem value="greater">Greater than</SelectItem>
                  <SelectItem value="less">Less than</SelectItem>
                  <SelectItem value="empty">Is empty</SelectItem>
                  <SelectItem value="not_empty">Is not empty</SelectItem>
                </SelectContent>
              </Select>

              <Input
                type="text"
                placeholder="Filter value"
                value={filterValue}
                onChange={(e) => setFilterValue(e.target.value)}
                className="w-[200px]"
              />

              <Button onClick={addFilter}>Add Filter</Button>
              <Button variant="outline" onClick={clearFilters}>Clear Filters</Button>
            </CardContent>
          </Card>

          {/* Display active filters */}
          <div className="flex flex-wrap gap-2 mb-4">
            {filters.map((filter, index) => (
              <Badge key={index} variant="secondary" className="px-2 py-1">
                {`${filter.column} ${filter.operation} ${filter.value}`}
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-2 h-4 w-4 p-0"
                  onClick={() => removeFilter(index)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </Badge>
            ))}
          </div>

          {/* Display filtered data count */}
          <div className="mb-2">
            <Badge variant="secondary">
              Showing {filteredData.length} of {data.length} rows
            </Badge>
          </div>

          {filteredData.length > 0 && (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <ResizableHeader width={columnWidths['checkbox'] || 50} onResize={(width) => handleColumnResize('checkbox', width)}>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          checked={allChecked}
                          onCheckedChange={toggleAllChecked}
                        />
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <ChevronDown className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent>
                            <DropdownMenuItem onClick={() => setCheckAllScope('page')}>
                              {checkAllScope === 'page' && '✓ '}Check Current Page
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setCheckAllScope('all')}>
                              {checkAllScope === 'all' && '✓ '}Check All Pages
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </ResizableHeader>
                    {Object.keys(filteredData[0]).filter(key => key !== 'checked').map((header) => (
                      <ResizableHeader key={header} width={columnWidths[header] || 200} onResize={(width) => handleColumnResize(header, width)}>
                        <div className="flex items-center justify-between">
                          <span>{header}</span>
                          <ColumnMenu
                            columnName={header}
                            onSetFormatting={(prompt, example, scope, model, contextColumn) => 
                              handleSetFormatting(header, prompt, example, scope, model, contextColumn)
                            }
                            savedFormats={savedFormats}
                            onSaveFormat={handleSaveFormat}
                            currentModel={currentModel[header] || 'gpt-3.5-turbo'}
                            models={models}
                            onModelChange={(model) => setCurrentModel(prev => ({ ...prev, [header]: model }))}
                            columns={Object.keys(data[0] || {})}
                          />
                        </div>
                      </ResizableHeader>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((row, index) => (
                    <TableRow key={index}>
                      <TableCell className="w-[50px] px-2 py-3">
                        <Checkbox
                          checked={row.checked}
                          onCheckedChange={() => toggleRowChecked((currentPage - 1) * ROWS_PER_PAGE + index)}
                        />
                      </TableCell>
                      {Object.entries(row).filter(([key]) => key !== 'checked').map(([key, value]) => (
                        <TableCell key={key} className="px-4 py-3" style={{ width: `${columnWidths[key] || 200}px` }}>
                          {renderCellContent(value, (currentPage - 1) * ROWS_PER_PAGE + index, key)}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Pagination controls */}
          <div className="flex justify-center items-center space-x-2 mt-4">
            <Button 
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} 
              disabled={currentPage <= 1}
              variant="outline"
            >
              Previous
            </Button>
            <span className="py-2">
              Page {currentPage} of {totalPages}
            </span>
            <Button 
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} 
              disabled={currentPage >= totalPages}
              variant="outline"
            >
              Next
            </Button>
          </div>
        </CardContent>
      </Card>
    </Layout>
  );
}
