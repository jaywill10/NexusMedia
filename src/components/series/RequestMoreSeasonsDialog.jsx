import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, Plus } from 'lucide-react';
import StatusBadge from '@/components/shared/StatusBadge';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

export default function RequestMoreSeasonsDialog({ series, currentUser, onClose }) {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState([]);

  const { data: seasons = [] } = useQuery({
    queryKey: ['seasons', series?.id],
    queryFn: () => base44.entities.Season.filter({ series_id: series?.id }, 'season_number'),
    enabled: !!series?.id,
    initialData: [],
  });

  const { data: existingRequests = [] } = useQuery({
    queryKey: ['requests'],
    queryFn: () => base44.entities.Request.filter({ linked_series_id: series?.id }),
    enabled: !!series?.id,
    initialData: [],
  });

  const alreadyRequestedSeasons = existingRequests.flatMap(r => r.requested_seasons || []);
  const totalSeasons = series?.total_seasons || seasons.length || 4;
  const allSeasonNums = Array.from({ length: totalSeasons }, (_, i) => i + 1);

  const toggle = (num) => {
    if (alreadyRequestedSeasons.includes(num)) return;
    setSelected(s => s.includes(num) ? s.filter(n => n !== num) : [...s, num]);
  };

  const mutation = useMutation({
    mutationFn: async () => {
      await base44.entities.Request.create({
        title: series.title,
        media_type: 'series',
        tmdb_id: series.tmdb_id,
        linked_series_id: series.id,
        poster_url: series.poster_url,
        year: series.year,
        status: 'submitted',
        requested_by: currentUser?.email || 'user',
        requested_seasons: selected,
      });
      // Update monitored_seasons on the series
      const existingMonitored = series.monitored_seasons || [];
      const merged = [...new Set([...existingMonitored, ...selected])];
      await base44.entities.Series.update(series.id, { monitored_seasons: merged });
      await base44.entities.HistoryEvent.create({
        event_type: 'requested',
        media_type: 'series',
        media_id: series.id,
        media_title: series.title,
        details: `Requested seasons: ${selected.join(', ')}`,
        user_email: currentUser?.email,
        success: true,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requests'] });
      queryClient.invalidateQueries({ queryKey: ['series', series.id] });
      toast.success(`Season request submitted for ${series.title}`);
      onClose();
    },
  });

  const getSeasonInfo = (num) => {
    const season = seasons.find(s => s.season_number === num);
    const alreadyReq = alreadyRequestedSeasons.includes(num);
    return { season, alreadyReq };
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Request More Seasons — {series?.title}</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">Select additional seasons to request. Already-requested seasons are locked.</p>
        <div className="grid grid-cols-4 gap-2 py-2">
          {allSeasonNums.map(num => {
            const { season, alreadyReq } = getSeasonInfo(num);
            const isSelected = selected.includes(num);
            return (
              <div
                key={num}
                className={cn(
                  "rounded-lg border p-3 text-center cursor-pointer transition-all",
                  alreadyReq ? "border-green-500/30 bg-green-500/10 opacity-60 cursor-not-allowed" : isSelected ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"
                )}
                onClick={() => toggle(num)}
              >
                <div className="text-[10px] text-muted-foreground mb-0.5">
                  {alreadyReq ? '✓ Req' : 'S'}
                </div>
                <div className="text-xl font-bold">{num}</div>
                {season && <div className="text-[9px] text-muted-foreground mt-0.5 capitalize">{season.status}</div>}
              </div>
            );
          })}
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={() => mutation.mutate()} disabled={selected.length === 0 || mutation.isPending} className="gap-1.5">
            <Plus className="w-4 h-4" /> Request {selected.length > 0 ? `Season${selected.length > 1 ? 's' : ''} ${selected.join(', ')}` : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}