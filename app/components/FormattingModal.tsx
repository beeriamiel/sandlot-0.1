import React, { useState, ChangeEvent } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

interface FormattingModalProps {
  columnName: string;
  onClose: () => void;
  onSetFormatting: (prompt: string, example: string, scope: 'one' | 'ten' | 'all') => void;
  open: boolean;
}

export function FormattingModal({ columnName, onClose, onSetFormatting, open }: FormattingModalProps) {
  const [prompt, setPrompt] = useState('');
  const [example, setExample] = useState('');
  const [scope, setScope] = useState<'one' | 'ten' | 'all'>('one');

  const handlePromptChange = (e: ChangeEvent<HTMLTextAreaElement>) => setPrompt(e.target.value);
  const handleExampleChange = (e: ChangeEvent<HTMLInputElement>) => setExample(e.target.value);
  const handleScopeChange = (value: string) => setScope(value as 'one' | 'ten' | 'all');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSetFormatting(prompt, example, scope);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Format Column: {columnName}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="prompt">Formatting Prompt:</Label>
              <Textarea
                id="prompt"
                value={prompt}
                onChange={handlePromptChange}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="example">Example:</Label>
              <Input
                id="example"
                type="text"
                value={example}
                onChange={handleExampleChange}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="scope">Apply to:</Label>
              <Select value={scope} onValueChange={handleScopeChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select scope" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="one">One row</SelectItem>
                  <SelectItem value="ten">10 rows</SelectItem>
                  <SelectItem value="all">All rows</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">Set Formatting</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}