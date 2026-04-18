import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Check, X, User, Film, Tv } from 'lucide-react';
import { toast } from 'sonner';

export default function ApprovalModal({ request, onClose, currentUser }) {
  const queryClient = useQueryClient();
  const [qualityProfileId, setQualityProfileId] = useState(request?.quality_profile_id || '');
  const [rootFolderId, setRootFolderId] = useState(request?.root_folder_id || '');
  const [adminNotes, setAdminNotes] = useState(request?.admin_notes || '');
  const [autoSearch, setAutoSearch] = useState(request?.auto_search !== false);
  const [approvedSeasons, setApprovedSeasons] = useState(request?.requested_seasons || []);
  const [declineReason, setDeclineReason] = useState('');
  const [decliningMode, setDecliningMode] = useState(false);

  const { data: profiles = [] } = useQuery({ queryKey: ['quality-profiles'], queryFn: () => base44.entities.QualityProfile.list(), initialData: [] });
  const { data: rootFolders = [] } = useQuery({ queryKey: ['root-folders'], queryFn: () => base44.entities.RootFolder.list(), initialData: [] });
  const { data: tags = [] } = useQuery({ queryKey: ['tags'], queryFn: () => base44.entities.Tag.list(), initialData: [] });

  const approveMutation = useMutation({
    mutationFn: async () => {
      const approvedDate = new Date().toISOString();
      // Update request
      await base44.entities.Request.update(request.id, {
        status: 'approved',
        approved_by: currentUser?.email,
        approved_date: approvedDate,
        quality_profile_id: qualityProfileId,
        root_folder_id: rootFolderId,
        admin_notes: adminNotes,
        auto_search: autoSearch,
        fulfilled_seasons: request.media_type === 'series' ? approvedSeasons : undefined,
      });
      // Update linked entity
      if (request.linked_movie_id) {
        await base44.entities.Movie.update(request.linked_movie_id, {
          quality_profile_id: qualityProfileId,
          root_folder_id: rootFolderId,
          monitored: true,
        });
      } else if (request.linked_series_id) {
        await base44.entities.Series.update(request.linked_series_id, {
          quality_profile_id: qualityProfileId,
          root_folder_id: rootFolderId,
          monitored_seasons: approvedSeasons,
          monitored: true,
        });
      }
      // Log history
      await base44.entities.HistoryEvent.create({
        event_type: 'approved',
        media_type: request.media_type,
        media_id: request.linked_movie_id || request.linked_series_id,
        media_title: request.title,
        details: `Approved by ${currentUser?.email}. Quality: ${qualityProfileId || 'default'}. Auto-search: ${autoSearch}`,
        user_email: currentUser?.email,
        success: true,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requests'] });
      queryClient.invalidateQueries({ queryKey: ['movies'] });
      queryClient.invalidateQueries({ queryKey: ['series'] });
      toast.success(`Request approved: ${request.title}`);
      onClose();
    },
  });

  const declineMutation = useMutation({
    mutationFn: async () => {
      await base44.entities.Request.update(request.id, {
        status: 'declined',
        admin_notes: adminNotes,
        decline_reason: declineReason,
        declined_date: new Date().toISOString(),
      });
      await base44.entities.HistoryEvent.create({
        event_type: 'declined',
        media_type: request.media_type,
        media_title: request.title,
        details: `Declined by ${currentUser?.email}. Reason: ${declineReason}`,
        user_email: currentUser?.email,
        success: false,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requests'] });
      toast.info(`Request declined: ${request.title}`);
      onClose();
    },
  });

  const toggleSeason = (num) => {
    setApprovedSeasons(s => s.includes(num) ? s.filter(n => n !== num) : [...s, num]);
  };

  if (!request) return null;

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {request.media_type === 'movie' ? <Film className="w-4 h-4" /> : <Tv className="w-4 h-4" />}
            Review Request
          </DialogTitle>
        </DialogHeader>

        {/* Request info */}
        <div className="flex gap-3 p-3 bg-secondary rounded-lg">
          {request.poster_url && (
            <img src={request.poster_url} alt={request.title} className="w-12 h-18 object-cover rounded" style={{ height: '72px' }} />
          )}
          <div className="flex-1 min-w-0">
            <p className="font-semibold truncate">{request.title}</p>
            {request.year && <p className="text-xs text-muted-foreground">{request.year}</p>}
            <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
              <User className="w-3 h-3" /> {request.requested_by}
            </div>
            {request.notes && <p className="text-xs text-muted-foreground mt-1 italic">"{request.notes}"</p>}
          </div>
        </div>

        {/* Season selection for TV */}
        {request.media_type === 'series' && request.requested_seasons?.length > 0 && (
          <div>
            <Label className="text-xs mb-2 block">Requested Seasons</Label>
            <div className="flex flex-wrap gap-2">
              {request.requested_seasons.map(num => (
                <div key={num} className="flex items-center gap-1.5">
                  <Checkbox
                    id={`season-${num}`}
                    checked={approvedSeasons.includes(num)}
                    onCheckedChange={() => toggleSeason(num)}
                  />
                  <Label htmlFor={`season-${num}`} className="text-sm cursor-pointer">Season {num}</Label>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quality Profile */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs mb-1 block">Quality Profile</Label>
            <Select value={qualityProfileId} onValueChange={setQualityProfileId}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select profile..." /></SelectTrigger>
              <SelectContent>
                {profiles.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs mb-1 block">Root Folder</Label>
            <Select value={rootFolderId} onValueChange={setRootFolderId}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select folder..." /></SelectTrigger>
              <SelectContent>
                {rootFolders.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Auto search toggle */}
        <div className="flex items-center justify-between">
          <Label className="text-sm">Search immediately on approval</Label>
          <Switch checked={autoSearch} onCheckedChange={setAutoSearch} />
        </div>

        {/* Admin notes */}
        <div>
          <Label className="text-xs mb-1 block">Admin Notes</Label>
          <Textarea value={adminNotes} onChange={e => setAdminNotes(e.target.value)} className="h-16 text-xs resize-none" placeholder="Optional notes..." />
        </div>

        {/* Decline reason */}
        {decliningMode && (
          <div>
            <Label className="text-xs mb-1 block text-red-400">Decline Reason</Label>
            <Textarea value={declineReason} onChange={e => setDeclineReason(e.target.value)} className="h-16 text-xs resize-none border-red-500/40" placeholder="Explain why the request was declined..." />
          </div>
        )}

        <DialogFooter className="gap-2">
          {!decliningMode ? (
            <>
              <Button variant="outline" size="sm" className="text-red-400 border-red-500/40 hover:bg-red-500/10" onClick={() => setDecliningMode(true)}>
                <X className="w-4 h-4 mr-1.5" /> Decline
              </Button>
              <Button size="sm" onClick={() => approveMutation.mutate()} disabled={approveMutation.isPending} className="gap-1.5">
                <Check className="w-4 h-4" /> Approve
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" size="sm" onClick={() => setDecliningMode(false)}>Cancel</Button>
              <Button size="sm" variant="destructive" onClick={() => declineMutation.mutate()} disabled={declineMutation.isPending}>
                Confirm Decline
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}