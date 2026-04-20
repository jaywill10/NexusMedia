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
import { Search, Tv, Check } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export default function AddSeriesDialog({ onClose }) {
  const queryClient = useQueryClient();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState(null);
  const [monitored, setMonitored] = useState(true);
  const [monitorMode, setMonitorMode] = useState('all');
  const [seriesType, setSeriesType] = useState('standard');
  const [submitting, setSubmitting] = useState(false);

  const { data: profiles = [] } = useQuery({ queryKey: ['quality-profiles'], queryFn: () => base44.entities.QualityProfile.list(), initialData: [] });
  const { data: rootFolders = [] } = useQuery({ queryKey: ['root-folders'], queryFn: () => base44.entities.RootFolder.list(), initialData: [] });

  const handleSearch = async () => {
    if (!query.trim()) return;
    setSearching(true);
    setSelected(null);
    setResults(null);
    try {
      const res = await base44.tmdb.search({ q: query });
      setResults((res.series || []).slice(0, 6));
    } catch (err) {
      const needsKey = err?.data?.error === 'no_api_key' || err?.data?.error === 'invalid_api_key';
      toast.error(needsKey ? 'TMDB API key required — set one in Settings.' : (err?.data?.error || err.message || 'Search failed'));
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

  const handleSubmit = async () => {
    if (!selected) return;
    setSubmitting(true);
    await base44.entities.Series.create({
      title: selected.title,
      year: selected.year,
      tmdb_id: selected.tmdb_id,
      overview: selected.overview,
      poster_url: selected.poster_url,
      rating: selected.rating,
      genres: selected.genres,
      network: selected.network,
      series_status: selected.series_status || 'continuing',
      total_seasons: selected.total_seasons,
      monitored,
      monitor_mode: monitorMode,
      series_type: seriesType,
      added_date: new Date().toISOString(),
    });
    queryClient.invalidateQueries({ queryKey: ['series'] });
    toast.success(`Added: ${selected.title}`);
    setSubmitting(false);
    onClose();
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Series</DialogTitle>
        </DialogHeader>

        {/* Search bar */}
        <div className="flex gap-2">
          <Input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search for a series..."
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
                    : <div className="w-full h-full flex items-center justify-center"><Tv className="w-8 h-8 text-muted-foreground" /></div>
                  }
                </div>
                {selected?.tmdb_id === r.tmdb_id && (
                  <div className="absolute top-2 right-2 bg-primary rounded-full p-0.5">
                    <Check className="w-3 h-3 text-primary-foreground" />
                  </div>
                )}
                <div className="p-2">
                  <p className="text-xs font-medium truncate">{r.title}</p>
                  <p className="text-[11px] text-muted-foreground">{r.year}{r.network ? ` · ${r.network}` : ''}</p>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Config */}
        {selected && (
          <div className="border-t border-border pt-4 space-y-3">
            <p className="text-sm font-medium">Configure: <span className="text-primary">{selected.title}</span></p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Monitor Mode</Label>
                <Select value={monitorMode} onValueChange={setMonitorMode}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Episodes</SelectItem>
                    <SelectItem value="future">Future Only</SelectItem>
                    <SelectItem value="missing">Missing Only</SelectItem>
                    <SelectItem value="existing">Existing Only</SelectItem>
                    <SelectItem value="pilot">Pilot Only</SelectItem>
                    <SelectItem value="first_season">First Season</SelectItem>
                    <SelectItem value="none">None</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Series Type</Label>
                <Select value={seriesType} onValueChange={setSeriesType}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="standard">Standard</SelectItem>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="anime">Anime</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-sm">Monitored</Label>
              <Switch checked={monitored} onCheckedChange={setMonitored} />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={submitting || !selected}>
            {submitting ? 'Adding...' : 'Add Series'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}