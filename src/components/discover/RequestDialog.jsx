import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/AuthContext';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import StatusBadge from '@/components/shared/StatusBadge';
import { Film, Tv, Star, Calendar, Clock, Send } from 'lucide-react';
import { toast } from 'sonner';

export default function RequestDialog({ item, onClose, existingMovies = [], existingSeries = [], requests = [] }) {
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();
  const [notes, setNotes] = useState('');
  const [selectedSeasons, setSelectedSeasons] = useState([]);
  const [profileId, setProfileId] = useState('');
  const [rootFolderId, setRootFolderId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { data: profiles = [] } = useQuery({
    queryKey: ['quality-profiles'],
    queryFn: () => base44.entities.QualityProfile.list(),
    initialData: [],
  });

  const { data: rootFolders = [] } = useQuery({
    queryKey: ['root-folders'],
    queryFn: () => base44.entities.RootFolder.list(),
    initialData: [],
  });

  const existingRequest = requests.find(r => r.title === item.title && r.media_type === item.media_type);
  const isMovie = item.media_type === 'movie';
  const totalSeasons = item.total_seasons || 1;

  const toggleSeason = (num) => {
    setSelectedSeasons(prev =>
      prev.includes(num) ? prev.filter(n => n !== num) : [...prev, num]
    );
  };

  const selectAllSeasons = () => {
    const all = Array.from({ length: totalSeasons }, (_, i) => i + 1);
    setSelectedSeasons(selectedSeasons.length === totalSeasons ? [] : all);
  };

  const handleSubmit = async () => {
    setSubmitting(true);

    // 1. Create the linked Movie or Series entity
    let linkedId = null;
    if (isMovie) {
      const existing = existingMovies.find(m => m.tmdb_id === item.tmdb_id);
      if (existing) {
        linkedId = existing.id;
      } else {
        const created = await base44.entities.Movie.create({
          title: item.title,
          tmdb_id: item.tmdb_id,
          year: item.year,
          overview: item.overview || '',
          poster_url: item.poster_url || '',
          backdrop_url: item.backdrop_url || '',
          genres: item.genres || [],
          rating: item.rating,
          monitored: true,
          library_status: 'missing',
        });
        linkedId = created.id;
      }
    } else {
      const existing = existingSeries.find(s => s.tmdb_id === item.tmdb_id);
      if (existing) {
        linkedId = existing.id;
      } else {
        const created = await base44.entities.Series.create({
          title: item.title,
          tmdb_id: item.tmdb_id,
          year: item.year,
          overview: item.overview || '',
          poster_url: item.poster_url || '',
          backdrop_url: item.backdrop_url || '',
          genres: item.genres || [],
          rating: item.rating,
          network: item.network || '',
          total_seasons: item.total_seasons || 0,
          monitored: true,
        });
        linkedId = created.id;
      }
    }

    // 2. Create the Request entity
    const seasons = selectedSeasons.length > 0 ? selectedSeasons : Array.from({ length: totalSeasons }, (_, i) => i + 1);
    const requestData = {
      title: item.title,
      media_type: item.media_type,
      tmdb_id: item.tmdb_id,
      year: item.year,
      poster_url: item.poster_url || '',
      backdrop_url: item.backdrop_url || '',
      status: 'pending_approval',
      requested_by: currentUser?.email || '',
      notes,
      quality_profile_id: profileId || undefined,
      root_folder_id: rootFolderId || undefined,
      auto_search: true,
      ...(isMovie ? { linked_movie_id: linkedId } : { linked_series_id: linkedId, requested_seasons: seasons }),
    };

    await base44.entities.Request.create(requestData);

    // 3. Log history event
    await base44.entities.HistoryEvent.create({
      event_type: 'requested',
      media_type: item.media_type,
      media_id: linkedId,
      media_title: item.title,
      user_email: currentUser?.email || '',
      success: true,
    });

    queryClient.invalidateQueries({ queryKey: ['all-requests'] });
    queryClient.invalidateQueries({ queryKey: ['all-requests-discover'] });
    queryClient.invalidateQueries({ queryKey: ['requests'] });
    queryClient.invalidateQueries({ queryKey: ['movies'] });
    queryClient.invalidateQueries({ queryKey: ['series'] });
    toast.success(`Request submitted for ${item.title}`);
    setSubmitting(false);
    onClose();
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isMovie ? <Film className="w-4 h-4" /> : <Tv className="w-4 h-4" />}
            Request {item.title}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Media info */}
          <div className="flex gap-4">
            <div className="w-20 h-28 rounded bg-secondary flex items-center justify-center shrink-0">
              {item.poster_url ? (
                <img src={item.poster_url} alt="" className="w-full h-full object-cover rounded" />
              ) : isMovie ? (
                <Film className="w-6 h-6 text-muted-foreground" />
              ) : (
                <Tv className="w-6 h-6 text-muted-foreground" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold">{item.title}</h3>
              <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                {item.year && <span>{item.year}</span>}
                {item.rating > 0 && (
                  <span className="flex items-center gap-0.5">
                    <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                    {item.rating?.toFixed(1)}
                  </span>
                )}
                {item.runtime && <span>{item.runtime}m</span>}
              </div>
              {item.genres && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {item.genres.slice(0, 4).map(g => (
                    <Badge key={g} variant="secondary" className="text-[10px]">{g}</Badge>
                  ))}
                </div>
              )}
              {existingRequest && (
                <div className="mt-2">
                  <StatusBadge status={existingRequest.status} />
                </div>
              )}
              <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{item.overview}</p>
            </div>
          </div>

          {/* Season selection for TV */}
          {!isMovie && totalSeasons > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-sm">Select Seasons</Label>
                <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={selectAllSeasons}>
                  {selectedSeasons.length === totalSeasons ? 'Deselect All' : 'Select All'}
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {Array.from({ length: totalSeasons }, (_, i) => i + 1).map(num => (
                  <button
                    key={num}
                    onClick={() => toggleSeason(num)}
                    className={`w-10 h-10 rounded-md text-sm font-medium transition-colors ${
                      selectedSeasons.includes(num)
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                    }`}
                  >
                    {num}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Options */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Quality Profile</Label>
              <Select value={profileId} onValueChange={setProfileId}>
                <SelectTrigger className="h-9 mt-1">
                  <SelectValue placeholder="Default" />
                </SelectTrigger>
                <SelectContent>
                  {profiles.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Root Folder</Label>
              <Select value={rootFolderId} onValueChange={setRootFolderId}>
                <SelectTrigger className="h-9 mt-1">
                  <SelectValue placeholder="Default" />
                </SelectTrigger>
                <SelectContent>
                  {rootFolders.map(f => (
                    <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label className="text-xs">Notes (optional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any notes for the admin..."
              className="mt-1 h-20 resize-none"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={submitting || !!existingRequest} className="gap-2">
            <Send className="w-4 h-4" />
            {existingRequest ? 'Already Requested' : 'Submit Request'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}