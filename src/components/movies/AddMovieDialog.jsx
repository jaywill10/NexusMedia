import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, Film, Check } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export default function AddMovieDialog({ onClose }) {
  const queryClient = useQueryClient();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState(null);
  const [monitored, setMonitored] = useState(true);
  const [autoSearch, setAutoSearch] = useState(true);
  const [profileId, setProfileId] = useState('');
  const [rootFolderId, setRootFolderId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { data: profiles = [] } = useQuery({ queryKey: ['quality-profiles'], queryFn: () => base44.entities.QualityProfile.list(), initialData: [] });
  const { data: rootFolders = [] } = useQuery({ queryKey: ['root-folders'], queryFn: () => base44.entities.RootFolder.list(), initialData: [] });

  const handleSearch = async () => {
    if (!query.trim()) return;
    setSearching(true);
    setSelected(null);
    setResults(null);
    const res = await base44.integrations.Core.InvokeLLM({
      prompt: `Search TMDB for movies matching "${query}". Return up to 6 results.`,
      add_context_from_internet: true,
      response_json_schema: {
        type: 'object',
        properties: {
          results: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                title: { type: 'string' },
                year: { type: 'number' },
                tmdb_id: { type: 'string' },
                overview: { type: 'string' },
                poster_url: { type: 'string' },
                rating: { type: 'number' },
                genres: { type: 'array', items: { type: 'string' } },
              }
            }
          }
        }
      }
    });
    setResults(res.results || []);
    setSearching(false);
  };

  const handleSubmit = async () => {
    if (!selected) return;
    setSubmitting(true);
    await base44.entities.Movie.create({
      title: selected.title,
      year: selected.year,
      tmdb_id: selected.tmdb_id,
      overview: selected.overview,
      poster_url: selected.poster_url,
      rating: selected.rating,
      genres: selected.genres,
      monitored,
      library_status: 'missing',
      quality_profile_id: profileId || undefined,
      root_folder_id: rootFolderId || undefined,
      added_date: new Date().toISOString(),
    });
    queryClient.invalidateQueries({ queryKey: ['movies'] });
    toast.success(`Added: ${selected.title}`);
    setSubmitting(false);
    onClose();
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Movie</DialogTitle>
        </DialogHeader>

        {/* Search bar */}
        <div className="flex gap-2">
          <Input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search for a movie..."
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            autoFocus
          />
          <Button onClick={handleSearch} disabled={searching || !query.trim()} className="shrink-0 gap-1.5">
            <Search className="w-4 h-4" />
            {searching ? 'Searching...' : 'Search'}
          </Button>
        </div>

        {/* Search results */}
        {searching && (
          <div className="grid grid-cols-3 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i}>
                <Skeleton className="aspect-[2/3] rounded-lg w-full" />
                <Skeleton className="h-4 w-3/4 mt-2" />
              </div>
            ))}
          </div>
        )}

        {results && !searching && results.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-6">No results found. Try a different title.</p>
        )}

        {results && !searching && results.length > 0 && (
          <div className="grid grid-cols-3 gap-3">
            {results.map((r, i) => (
              <button
                key={i}
                onClick={() => setSelected(r)}
                className={cn(
                  'relative rounded-lg overflow-hidden text-left transition-all ring-2',
                  selected?.tmdb_id === r.tmdb_id ? 'ring-primary' : 'ring-transparent hover:ring-primary/50'
                )}
              >
                <div className="aspect-[2/3] bg-secondary">
                  {r.poster_url
                    ? <img src={r.poster_url} alt={r.title} className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center"><Film className="w-8 h-8 text-muted-foreground" /></div>
                  }
                </div>
                {selected?.tmdb_id === r.tmdb_id && (
                  <div className="absolute top-2 right-2 bg-primary rounded-full p-0.5">
                    <Check className="w-3 h-3 text-primary-foreground" />
                  </div>
                )}
                <div className="p-2">
                  <p className="text-xs font-medium truncate">{r.title}</p>
                  <p className="text-[11px] text-muted-foreground">{r.year}</p>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Config (shown once a result is selected) */}
        {selected && (
          <div className="border-t border-border pt-4 space-y-3">
            <p className="text-sm font-medium">Configure: <span className="text-primary">{selected.title}</span></p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Quality Profile</Label>
                <Select value={profileId} onValueChange={setProfileId}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Default" /></SelectTrigger>
                  <SelectContent>{profiles.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Root Folder</Label>
                <Select value={rootFolderId} onValueChange={setRootFolderId}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Default" /></SelectTrigger>
                  <SelectContent>{rootFolders.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex gap-6">
              <div className="flex items-center justify-between flex-1">
                <Label className="text-sm">Monitored</Label>
                <Switch checked={monitored} onCheckedChange={setMonitored} />
              </div>
              <div className="flex items-center justify-between flex-1">
                <Label className="text-sm">Search on add</Label>
                <Switch checked={autoSearch} onCheckedChange={setAutoSearch} />
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={submitting || !selected}>
            {submitting ? 'Adding...' : 'Add Movie'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}