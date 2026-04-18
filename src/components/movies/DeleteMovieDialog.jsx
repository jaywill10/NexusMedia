import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { AlertTriangle } from 'lucide-react';

export default function DeleteMovieDialog({ movie, onConfirm, onClose }) {
  const [mode, setMode] = useState('unmonitor');

  const options = [
    { value: 'unmonitor', label: 'Delete file and keep record (unmonitor)', description: 'Removes the file from disk, keeps the movie entry. Sets to unmonitored.' },
    { value: 'delete_all', label: 'Delete file and remove from app', description: 'Permanently removes the file from disk AND the database record.' },
    { value: 'keep_file', label: 'Remove from app (keep file)', description: 'Removes the database record. The file on disk is untouched.' },
  ];

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-yellow-400" />
            Delete "{movie?.title}"?
          </DialogTitle>
        </DialogHeader>
        <RadioGroup value={mode} onValueChange={setMode} className="space-y-3 py-2">
          {options.map(opt => (
            <div key={opt.value} className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${mode === opt.value ? 'border-primary bg-primary/5' : 'border-border hover:border-border/80'}`}
              onClick={() => setMode(opt.value)}>
              <RadioGroupItem value={opt.value} id={opt.value} className="mt-0.5" />
              <div>
                <Label htmlFor={opt.value} className="text-sm font-medium cursor-pointer">{opt.label}</Label>
                <p className="text-xs text-muted-foreground mt-0.5">{opt.description}</p>
              </div>
            </div>
          ))}
        </RadioGroup>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" variant="destructive" onClick={() => onConfirm(mode)}>
            Confirm Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}