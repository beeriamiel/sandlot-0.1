'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Layout from './Layout';
import { extractAndStoreEvent } from '../lib/extractor';
import { saveEventsToDatabase } from '../lib/database';
import { extractEventUrl } from '../lib/urlExtractor';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Upload, ChevronDown, X, Box } from "lucide-react"; // Added Box icon as a placeholder logo
import { getTablesFromSupabase } from '../lib/database';
import { ResizableHeader } from './ResizableHeader';

type EventRow = {
  url: string;
  status: 'not_started' | 'in_progress' | 'done' | 'sent_to_db' | 'failed';
  data: any;
  markdown: string;
  checked: boolean;
};

type ExtractedUrl = {
  originalUrl: string;
  extractedUrl: string;
  status: 'Uploaded' | 'Extracted' | 'Sent to EDE' | 'Failed';
};

interface Filter {
  column: string;
  operation: 'equal' | 'not_equal' | 'contains' | 'not_contains' | 'greater' | 'less' | 'empty' | 'not_empty';
  value: string;
}

function renderCellContent(content: any): string {
  if (content === null || content === undefined) {
    return '';
  }
  if (typeof content === 'string' || typeof content === 'number') {
    return content.toString();
  }
  if (Array.isArray(content)) {
    return content.map(item => renderCellContent(item)).join(', ');
  }
  if (typeof content === 'object') {
    return JSON.stringify(content);
  }
  return '';
}

const ROWS_PER_PAGE = 50;

export default function EventSpreadsheet() {
  const [rows, setRows] = useState<EventRow[]>(() => {
    if (typeof window !== 'undefined') {
      const savedRows = localStorage.getItem('eventSpreadsheetRows');
      return savedRows ? JSON.parse(savedRows) : [];
    }
    return [];
  });

  const [allChecked, setAllChecked] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('eventSpreadsheetAllChecked') === 'true';
    }
    return false;
  });

  const [isExtracting, setIsExtracting] = useState(false);
  const [extractedUrls, setExtractedUrls] = useState<ExtractedUrl[]>(() => {
    if (typeof window !== 'undefined') {
      const savedUrls = localStorage.getItem('eventSpreadsheetExtractedUrls');
      return savedUrls ? JSON.parse(savedUrls) : [];
    }
    return [];
  });

  const [currentPage, setCurrentPage] = useState(() => {
    if (typeof window !== 'undefined') {
      return parseInt(localStorage.getItem('eventSpreadsheetCurrentPage') || '1', 10);
    }
    return 1;
  });

  const [dataFormatterData, setDataFormatterData] = useState<any[]>(() => {
    if (typeof window !== 'undefined') {
      const savedData = localStorage.getItem('eventSpreadsheetDataFormatterData');
      return savedData ? JSON.parse(savedData) : [];
    }
    return [];
  });

  const [tables, setTables] = useState<string[]>([]);

  const [filters, setFilters] = useState<Filter[]>(() => {
    if (typeof window !== 'undefined') {
      const savedFilters = localStorage.getItem('eventSpreadsheetFilters');
      return savedFilters ? JSON.parse(savedFilters) : [];
    }
    return [];
  });

  const [selectedColumn, setSelectedColumn] = useState<string>('');
  const [selectedOperation, setSelectedOperation] = useState<Filter['operation']>('equal');
  const [filterValue, setFilterValue] = useState<string>('');
  const [columnWidths, setColumnWidths] = useState<{[key: string]: number}>(() => {
    if (typeof window !== 'undefined') {
      const savedWidths = localStorage.getItem('eventSpreadsheetColumnWidths');
      return savedWidths ? JSON.parse(savedWidths) : {};
    }
    return {};
  });

  // Save state to localStorage whenever it changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('eventSpreadsheetRows', JSON.stringify(rows));
      localStorage.setItem('eventSpreadsheetAllChecked', allChecked.toString());
      localStorage.setItem('eventSpreadsheetExtractedUrls', JSON.stringify(extractedUrls));
      localStorage.setItem('eventSpreadsheetCurrentPage', currentPage.toString());
      localStorage.setItem('eventSpreadsheetColumnWidths', JSON.stringify(columnWidths));
      localStorage.setItem('eventSpreadsheetFilters', JSON.stringify(filters));
    }
  }, [rows, allChecked, extractedUrls, currentPage, columnWidths, filters]);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        const lines = content.split('\n').filter(line => line.trim() !== '');
        const urls = lines.map(line => {
          const columns = line.split(',');
          return columns.find(col => col.trim() !== '') || '';
        }).filter(url => url !== '');
        setRows(urls.map(url => ({ 
          url, 
          status: 'not_started', 
          data: null, 
          markdown: '', 
          checked: false 
        })));
        setCurrentPage(1);
      };
      reader.readAsText(file);
    }
  };

  const extractData = async () => {
    setIsExtracting(true);
    const checkedRows = rows.filter(row => row.checked && row.status === 'not_started');
    for (let i = 0; i < checkedRows.length; i++) {
      try {
        const extractedData = await extractAndStoreEvent(checkedRows[i].url);
        setRows(prevRows => {
          const newRows = prevRows.map(row => 
            row.url === checkedRows[i].url 
              ? { 
                  ...row, 
                  status: 'done' as const, 
                  data: extractedData.event, 
                  markdown: extractedData.markdown 
                } 
              : row
          );
          if (typeof window !== 'undefined') {
            localStorage.setItem('eventSpreadsheetRows', JSON.stringify(newRows));
          }
          return newRows;
        });
      } catch (error) {
        console.error(`Error extracting data for ${checkedRows[i].url}:`, error);
        setRows(prevRows => {
          const newRows = prevRows.map(row => 
            row.url === checkedRows[i].url 
              ? { 
                  ...row, 
                  status: 'failed' as const, 
                  data: { error: 'Extraction failed' } 
                } 
              : row
          );
          if (typeof window !== 'undefined') {
            localStorage.setItem('eventSpreadsheetRows', JSON.stringify(newRows));
          }
          return newRows;
        });
      }
    }
    setIsExtracting(false);
  };

  const saveCheckedRows = async () => {
    const checkedRows = rows.filter(row => row.checked && row.status === 'done');
    if (checkedRows.length > 0) {
      try {
        await saveEventsToDatabase('events', checkedRows.map(row => ({...row.data, url: row.url})));
        setRows(prevRows => prevRows.map(row => 
          row.checked && row.status === 'done' ? { ...row, status: 'sent_to_db' } : row
        ));
        alert('Selected events saved to database successfully!');
      } catch (error) {
        console.error('Error saving events:', error);
        alert('Failed to save events to database.');
      }
    }
  };

  const toggleRowChecked = (index: number) => {
    const globalIndex = (currentPage - 1) * ROWS_PER_PAGE + index;
    setRows(prevRows => prevRows.map((row, i) => 
      i === globalIndex ? { ...row, checked: !row.checked } : row
    ));
  };

  const toggleAllChecked = () => {
    const newAllChecked = !allChecked;
    setAllChecked(newAllChecked);
    setRows(prevRows => prevRows.map(row => ({ ...row, checked: newAllChecked })));
  };

  const clearAll = () => {
    setRows([]);
    setAllChecked(false);
    setCurrentPage(1);
    setFilters([]);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('eventSpreadsheetRows');
      localStorage.removeItem('eventSpreadsheetAllChecked');
      localStorage.removeItem('eventSpreadsheetCurrentPage');
      localStorage.removeItem('eventSpreadsheetFilters');
    }
  };

  const pushAllToSupabase = async () => {
    const rowsToPush = rows.filter(row => row.checked && row.status === 'done');
    if (rowsToPush.length === 0) {
      alert('No checked rows with "Done Extracting" status to push to Supabase.');
      return;
    }

    try {
      const eventsToSave = rowsToPush.map(row => ({
        ...row.data,
        url: row.url,
        event_markdown: row.markdown,
      }));

      await saveEventsToDatabase('events', eventsToSave);
      
      setRows(prevRows => prevRows.map(row => 
        row.checked && row.status === 'done' ? { ...row, status: 'sent_to_db' } : row
      ));

      alert(`${rowsToPush.length} checked and extracted row(s) have been pushed to Supabase successfully!`);
    } catch (error) {
      console.error('Error pushing data to Supabase:', error);
      alert('Failed to push some or all data to Supabase. Please check the console for more details.');
    }
  };

  const downloadCSV = () => {
    const extractedRows = rows.filter(row => row.status === 'done' || row.status === 'sent_to_db');
    if (extractedRows.length === 0) {
      alert('No extracted data to download.');
      return;
    }

    const headers = [
      'URL', 'Name', 'Description', 'Start Date', 'End Date', 'City', 'State', 'Country',
      'Attendee Count', 'Topics', 'Event Type', 'Attendee Title', 'Logo URL',
      'Sponsorship Options', 'Agenda', 'Audience Insights', 'Sponsors',
      'Hosting Company', 'Ticket Cost', 'Contact Email'
    ];

    const csvContent = [
      headers.join(','),
      ...extractedRows.map(row => [
        row.url,
        row.data.name,
        `"${(row.data.description || '').replace(/"/g, '""')}"`,
        row.data.start_date,
        row.data.end_date,
        row.data.city,
        row.data.state,
        row.data.country,
        row.data.attendee_count,
        `"${(row.data.topics || []).join(', ')}"`,
        row.data.event_type,
        row.data.attendee_title,
        row.data.logo_url,
        `"${JSON.stringify(row.data.sponsorship_options).replace(/"/g, '""')}"`,
        `"${JSON.stringify(row.data.agenda).replace(/"/g, '""')}"`,
        `"${JSON.stringify(row.data.audience_insights).replace(/"/g, '""')}"`,
        `"${JSON.stringify(row.data.sponsors).replace(/"/g, '""')}"`,
        `"${JSON.stringify(row.data.hosting_company).replace(/"/g, '""')}"`,
        row.data.ticket_cost,
        row.data.contact_email
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', 'extracted_events.csv');
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleUrlFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        const urls = content.split('\n').filter(url => url.trim() !== '');
        setExtractedUrls(urls.map(url => ({ originalUrl: url, extractedUrl: '', status: 'Uploaded' })));
      };
      reader.readAsText(file);
    }
  };

  const extractUrls = async () => {
    setIsExtracting(true);
    const updatedUrls = [...extractedUrls];
    for (let i = 0; i < updatedUrls.length; i++) {
      if (updatedUrls[i].status === 'Uploaded') {
        try {
          const extractedUrl = await extractEventUrl(updatedUrls[i].originalUrl);
          updatedUrls[i] = { ...updatedUrls[i], extractedUrl, status: 'Extracted' };
        } catch (error) {
          console.error(`Failed to extract URL for ${updatedUrls[i].originalUrl}:`, error);
          updatedUrls[i] = { ...updatedUrls[i], extractedUrl: '', status: 'Failed' };
        }
      }
    }
    setExtractedUrls(updatedUrls);
    setIsExtracting(false);
  };

  const checkedNotStartedCount = rows.filter(row => row.checked && row.status === 'not_started').length;

  const sendToDataFormatter = () => {
    const extractedData = rows
      .filter(row => row.status === 'done' || row.status === 'sent_to_db')
      .map(row => ({
        url: row.url,
        ...row.data
      }));

    if (extractedData.length === 0) {
      alert('No extracted data to send to Data Formatter.');
      return;
    }

    // Save the data to localStorage
    localStorage.setItem('dataFormatterData', JSON.stringify(extractedData));
    
    // Redirect to the Data Formatter page
    window.location.href = '/data-formatter';
  };

  const fetchTables = async () => {
    try {
      const fetchedTables = await getTablesFromSupabase();
      if (Array.isArray(fetchedTables)) {
        setTables(fetchedTables);
      } else {
        console.error('Unexpected response format:', fetchedTables);
        setTables([]);
      }
    } catch (error) {
      console.error('Error fetching tables:', error);
      setTables([]);
      if (error instanceof Error) {
        alert(`Failed to fetch tables: ${error.message}`);
      } else {
        alert('Failed to fetch tables. Check console for details.');
      }
    }
  };

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

  const applyFilters = (data: EventRow[]) => {
    return data.filter(row => {
      return filters.every(filter => {
        let cellValue: string;
        if (filter.column === 'url' || filter.column === 'status') {
          cellValue = String(row[filter.column]);
        } else if (filter.column === 'data' || filter.column === 'markdown') {
          cellValue = JSON.stringify(row[filter.column]);
        } else {
          cellValue = String(row.data?.[filter.column] || '');
        }

        switch (filter.operation) {
          case 'equal':
            return cellValue === filter.value;
          case 'not_equal':
            return cellValue !== filter.value;
          case 'contains':
            return cellValue.toLowerCase().includes(filter.value.toLowerCase());
          case 'not_contains':
            return !cellValue.toLowerCase().includes(filter.value.toLowerCase());
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
  };

  const filteredRows = useMemo(() => applyFilters(rows), [rows, filters]);

  const handleColumnResize = useCallback((columnName: string, width: number) => {
    setColumnWidths(prev => ({ ...prev, [columnName]: width }));
  }, []);

  return (
    <Layout>
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Event Spreadsheet</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4 mb-6 justify-between">
              <div className="flex gap-4">
                <Button 
                  onClick={extractData} 
                  disabled={isExtracting || checkedNotStartedCount === 0}
                >
                  {isExtracting ? 'Extracting...' : `Extract Data (${checkedNotStartedCount})`}
                </Button>
                
                <Button onClick={clearAll} variant="destructive">Clear All</Button>
              </div>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button className="w-[150px]">
                    Actions <ChevronDown className="ml-2 h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem>
                    <label htmlFor="csv-upload" className="flex items-center w-full cursor-pointer">
                      <Upload className="mr-2 h-4 w-4" /> Upload CSV
                    </label>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={downloadCSV}>
                    Download CSV
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={pushAllToSupabase}>
                    Push to Supabase
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={sendToDataFormatter}>
                    Send to Data Formatter
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            
            <Input 
              type="file" 
              accept=".csv" 
              onChange={handleFileUpload} 
              className="hidden" 
              id="csv-upload"
            />
            
            {/* Add Filter UI */}
            <Card className="mb-4">
              <CardContent className="flex flex-wrap items-center gap-4 p-4">
                <Select value={selectedColumn} onValueChange={setSelectedColumn}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Select column" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.keys(rows[0] || {}).map((column) => (
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

            {/* Display filtered rows count */}
            <div className="mb-2">
              <Badge variant="secondary">
                Showing {filteredRows.length} of {rows.length} rows
              </Badge>
            </div>

            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <ResizableHeader width={columnWidths['checkbox'] || 50} onResize={(width) => handleColumnResize('checkbox', width)}>
                      <Checkbox
                        checked={allChecked}
                        onCheckedChange={toggleAllChecked}
                      />
                    </ResizableHeader>
                    <ResizableHeader width={columnWidths['status'] || 100} onResize={(width) => handleColumnResize('status', width)}>
                      Status
                    </ResizableHeader>
                    <ResizableHeader width={columnWidths['url'] || 200} onResize={(width) => handleColumnResize('url', width)}>
                      URL
                    </ResizableHeader>
                    <ResizableHeader width={columnWidths['name'] || 200} onResize={(width) => handleColumnResize('name', width)}>
                      Name
                    </ResizableHeader>
                    <ResizableHeader width={columnWidths['description'] || 300} onResize={(width) => handleColumnResize('description', width)}>
                      Description
                    </ResizableHeader>
                    <ResizableHeader width={columnWidths['start_date'] || 150} onResize={(width) => handleColumnResize('start_date', width)}>
                      Start Date
                    </ResizableHeader>
                    <ResizableHeader width={columnWidths['end_date'] || 150} onResize={(width) => handleColumnResize('end_date', width)}>
                      End Date
                    </ResizableHeader>
                    {/* Add other headers here */}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRows.slice((currentPage - 1) * ROWS_PER_PAGE, currentPage * ROWS_PER_PAGE).map((row, index) => (
                    <TableRow key={index}>
                      <TableCell style={{ width: `${columnWidths['checkbox'] || 50}px` }}>
                        <Checkbox
                          checked={row.checked}
                          onCheckedChange={() => toggleRowChecked(index)}
                        />
                      </TableCell>
                      <TableCell style={{ width: `${columnWidths['status'] || 100}px` }}>{row.status}</TableCell>
                      <TableCell style={{ width: `${columnWidths['url'] || 200}px` }}>{row.url}</TableCell>
                      <TableCell style={{ width: `${columnWidths['name'] || 200}px` }}>{renderCellContent(row.data?.name)}</TableCell>
                      <TableCell style={{ width: `${columnWidths['description'] || 300}px` }}>{renderCellContent(row.data?.description)}</TableCell>
                      <TableCell style={{ width: `${columnWidths['start_date'] || 150}px` }}>{renderCellContent(row.data?.start_date)}</TableCell>
                      <TableCell style={{ width: `${columnWidths['end_date'] || 150}px` }}>{renderCellContent(row.data?.end_date)}</TableCell>
                      {/* Add other table cells here */}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Pagination controls */}
            <div className="flex justify-center items-center space-x-2 mt-4">
              <Button 
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} 
                disabled={currentPage === 1}
                variant="outline"
              >
                Previous
              </Button>
              <span>
                Page {currentPage} of {Math.ceil(filteredRows.length / ROWS_PER_PAGE)}
              </span>
              <Button 
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, Math.ceil(filteredRows.length / ROWS_PER_PAGE)))} 
                disabled={currentPage === Math.ceil(filteredRows.length / ROWS_PER_PAGE)}
                variant="outline"
              >
                Next
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
