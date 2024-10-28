import React, { useState, useEffect, useCallback } from 'react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MoreHorizontal } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { getSavedFormatsFromSupabase } from '@/app/lib/database';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

interface ColumnMenuProps {
  columnName: string;
  onSetFormatting: (prompt: string, example: string, scope: 'one' | 'ten' | 'all' | 'selected', model: string, contextColumn?: string) => void;
  savedFormats: SavedFormat[];
  onSaveFormat: (name: string, prompt: string, example: string, model: string) => void;
  currentModel: string;
  models: string[];
  onModelChange: (model: string) => void;
  columns: string[];
}

interface SavedFormat {
  name: string;
  prompt: string;
  example: string;
  model: string;
}

export function ColumnMenu({ 
  columnName, 
  onSetFormatting, 
  savedFormats: initialSavedFormats, 
  onSaveFormat,
  currentModel,
  models,
  onModelChange,
  columns
}: ColumnMenuProps) {
  const [prompt, setPrompt] = useState('');
  const [example, setExample] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
  const [newFormatName, setNewFormatName] = useState('');
  const [savedFormats, setSavedFormats] = useState<SavedFormat[]>(initialSavedFormats);
  const [scope, setScope] = useState<'one' | 'ten' | 'all' | 'selected'>('one');
  const [contextColumn, setContextColumn] = useState<string | null>(null);

  // Add this useEffect to fetch saved formats when the component mounts
  useEffect(() => {
    const fetchFormats = async () => {
      try {
        const formats = await getSavedFormatsFromSupabase();
        setSavedFormats(formats);
      } catch (error) {
        console.error('Error fetching saved formats:', error);
      }
    };

    fetchFormats();
  }, []); // Run once when component mounts

  // Update the existing useEffect to only run when initialSavedFormats changes
  useEffect(() => {
    if (initialSavedFormats?.length > 0) {
      setSavedFormats(initialSavedFormats);
    }
  }, [initialSavedFormats]);

  const handleFormatChange = useCallback((formatName: string | null) => {
    setSelectedFormat(formatName);
    if (formatName === 'new') {
      setPrompt('');
      setExample('');
      onModelChange('gpt-4o-mini'); // Set default to gpt-4o-mini
    } else if (formatName) {
      const format = savedFormats.find(f => f.name === formatName);
      if (format) {
        setPrompt(format.prompt);
        setExample(format.example);
        onModelChange(format.model);
      }
    }
  }, [savedFormats, onModelChange]);

  const handleSaveFormat = useCallback(() => {
    setIsSaveDialogOpen(true);
  }, []);

  const handleSaveFormatConfirm = useCallback(async () => {
    if (newFormatName) {
      try {
        setIsLoading(true);
        setError(null);
        await onSaveFormat(newFormatName, prompt, example, currentModel);
        setSelectedFormat(newFormatName);
        setIsSaveDialogOpen(false);
        setNewFormatName('');
      } catch (error) {
        console.error('Error saving format:', error);
        setError('Failed to save format. Please try again later.');
      } finally {
        setIsLoading(false);
      }
    } else {
      setError('Please enter a name for the format');
    }
  }, [newFormatName, prompt, example, currentModel, onSaveFormat]);

  const handleContextColumnChange = useCallback((value: string) => {
    setContextColumn(value === 'none' ? null : value);
  }, []);

  const handleApply = useCallback(() => {
    onSetFormatting(prompt, example, scope, currentModel, contextColumn || undefined);
    setIsOpen(false);
  }, [prompt, example, scope, currentModel, contextColumn, onSetFormatting]);

  const handleApplyFormatting = useCallback((newScope: 'one' | 'ten' | 'all' | 'selected') => {
    setScope(newScope);
    handleApply();
  }, [handleApply]);

  return (
    <>
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-8 w-8 p-0">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56 max-h-[80vh] overflow-y-auto" align="end">
          <DropdownMenuLabel>Format Column: {columnName}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuLabel>Select Format</DropdownMenuLabel>
          <Select value={selectedFormat || ''} onValueChange={handleFormatChange}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder={savedFormats.length === 0 ? "Loading formats..." : "Select a format"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="new">New Format</SelectItem>
              {savedFormats.map((format) => (
                <SelectItem key={format.name} value={format.name}>
                  {format.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {error && <div className="text-red-500 text-sm mt-2">{error}</div>}
          <DropdownMenuSeparator />
          {(selectedFormat === 'new' || !selectedFormat) && (
            <>
              <div className="px-2 py-1">
                <Input
                  placeholder="Enter prompt"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                />
              </div>
              <div className="px-2 py-1">
                <Input
                  placeholder="Enter example"
                  value={example}
                  onChange={(e) => setExample(e.target.value)}
                />
              </div>
              <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                <Button onClick={handleSaveFormat} className="w-full">
                  Save Format
                </Button>
              </DropdownMenuItem>
            </>
          )}
          {selectedFormat && selectedFormat !== 'new' && (
            <>
              <DropdownMenuLabel>Prompt</DropdownMenuLabel>
              <div className="px-2 py-1 max-h-20 overflow-y-auto">{prompt}</div>
              <DropdownMenuLabel>Example</DropdownMenuLabel>
              <div className="px-2 py-1 max-h-20 overflow-y-auto">{example}</div>
            </>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuLabel>OpenAI Model</DropdownMenuLabel>
          <div className="px-2 py-1">
            <Select value={currentModel} onValueChange={onModelChange}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a model" />
              </SelectTrigger>
              <SelectContent>
                {models.map((model) => (
                  <SelectItem key={model} value={model}>{model}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuLabel>Context Column</DropdownMenuLabel>
          <div className="px-2 py-1">
            <Select value={contextColumn || 'none'} onValueChange={handleContextColumnChange}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select context column" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {columns.filter(col => col !== columnName).map((col) => (
                  <SelectItem key={col} value={col}>{col}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              Apply
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem onSelect={() => handleApplyFormatting('one')}>
                One row
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => handleApplyFormatting('ten')}>
                Ten rows
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => handleApplyFormatting('selected')}>
                Selected rows
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => handleApplyFormatting('all')}>
                All rows
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={isSaveDialogOpen} onOpenChange={setIsSaveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Format</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="format-name">Format Name</Label>
            <Input
              id="format-name"
              placeholder="Enter format name"
              value={newFormatName}
              onChange={(e) => setNewFormatName(e.target.value)}
            />
          </div>
          {error && <div className="text-red-500 text-sm mb-4">{error}</div>}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSaveDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveFormatConfirm} disabled={isLoading}>
              {isLoading ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
