'use client'

import React, { useState, useCallback, useEffect } from 'react';
import Layout from "./Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { extractEventUrl } from '../lib/urlExtractor';
import { ResizableHeader } from './ResizableHeader';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function URLExtractor() {
  // Initialize state from localStorage if available
  const [urls, setUrls] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      const savedUrls = localStorage.getItem('urlExtractorUrls');
      return savedUrls ? JSON.parse(savedUrls) : [];
    }
    return [];
  });

  const [extractedUrls, setExtractedUrls] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      const savedExtractedUrls = localStorage.getItem('urlExtractorExtractedUrls');
      return savedExtractedUrls ? JSON.parse(savedExtractedUrls) : [];
    }
    return [];
  });

  const [isExtracting, setIsExtracting] = useState(false);
  const [columnWidths, setColumnWidths] = useState<{[key: string]: number}>(() => {
    if (typeof window !== 'undefined') {
      const savedWidths = localStorage.getItem('urlExtractorColumnWidths');
      return savedWidths ? JSON.parse(savedWidths) : {
        originalUrl: 300,
        extractedUrl: 300,
      };
    }
    return {
      originalUrl: 300,
      extractedUrl: 300,
    };
  });

  // Save to localStorage whenever state changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('urlExtractorUrls', JSON.stringify(urls));
      localStorage.setItem('urlExtractorExtractedUrls', JSON.stringify(extractedUrls));
      localStorage.setItem('urlExtractorColumnWidths', JSON.stringify(columnWidths));
    }
  }, [urls, extractedUrls, columnWidths]);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        const newUrls = content.split('\n').filter(url => url.trim() !== '');
        setUrls(newUrls);
        setExtractedUrls([]); // Reset extracted URLs when new file is uploaded
      };
      reader.readAsText(file);
    }
  };

  const extractUrls = async () => {
    setIsExtracting(true);
    const extracted = await Promise.all(urls.map(url => extractEventUrl(url)));
    setExtractedUrls(extracted);
    setIsExtracting(false);
  };

  const handleColumnResize = useCallback((columnName: string, width: number) => {
    setColumnWidths(prev => ({ ...prev, [columnName]: width }));
  }, []);

  // Add clear functionality
  const handleClear = () => {
    setUrls([]);
    setExtractedUrls([]);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('urlExtractorUrls');
      localStorage.removeItem('urlExtractorExtractedUrls');
    }
  };

  return (
    <Layout>
      <Card>
        <CardHeader>
          <CardTitle>URL Extractor</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <Input type="file" accept=".csv" onChange={handleFileUpload} />
            <Button onClick={handleClear} variant="destructive">
              Clear All
            </Button>
          </div>
          <Button onClick={extractUrls} disabled={isExtracting || urls.length === 0}>
            {isExtracting ? 'Extracting...' : 'Extract URLs'}
          </Button>
          {extractedUrls.length > 0 && (
            <Table>
              <TableHeader>
                <TableRow>
                  <ResizableHeader width={columnWidths['originalUrl']} onResize={(width) => handleColumnResize('originalUrl', width)}>
                    Original URL
                  </ResizableHeader>
                  <ResizableHeader width={columnWidths['extractedUrl']} onResize={(width) => handleColumnResize('extractedUrl', width)}>
                    Extracted URL
                  </ResizableHeader>
                </TableRow>
              </TableHeader>
              <TableBody>
                {extractedUrls.map((url, index) => (
                  <TableRow key={index}>
                    <TableCell style={{ width: `${columnWidths['originalUrl']}px` }}>{urls[index]}</TableCell>
                    <TableCell style={{ width: `${columnWidths['extractedUrl']}px` }}>{url}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </Layout>
  );
}
