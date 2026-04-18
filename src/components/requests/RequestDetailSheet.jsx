import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import StatusBadge from '@/components/shared/StatusBadge';
import { Film, Tv, CheckCircle2, Circle, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';

const STATUS_TIMELINE = ['submitted', 'approved', 'processing', 'available'];
const STATUS_LABELS = { submitted: 'Submitted', approved: 'Approved', processing: 'Processing', available: 'Available', declined: 'Declined', failed: 'Failed' };

const EVENT_LABELS = {
  requested: 'Requested', approved: 'Approved', declined: 'Declined', searched: 'Searched',
  grabbed: 'Grabbed', download_started: 'Download Started', download_completed: 'Download Completed',
  download_failed: 'Download Failed', imported: 'Imported', import_failed: 'Import Failed',
  renamed: 'Renamed', deleted: 'Deleted', upgraded: 'Upgraded',
};

export default function RequestDetailSheet({ request, open, onClose, onApprove, onDecline }) {
  const { data: history = [] } = useQuery({
    queryKey: ['request-history', request?.title],
    queryFn: () => base44.entities.HistoryEvent.filter({ media_title: request.title }, '-created_date', 20),
    enabled: !!request?.title,
    initialData: [],
  });

  if (!request) return null;

  const currentStatusIdx = STATUS_TIMELINE.indexOf(request.status);
  const isDeclined = request.status === 'declined' || request.status === 'failed';

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent side="right" className="w-full max-w-xl overflow-y-auto p-0">
        {/* Hero */}
        <div className="relative">
          {request.backdrop_url && (
            <div className="h-32 overflow-hidden">
              <img src={request.backdrop_url} alt="" className="w-full h-full object-cover opacity-40" />
              <div className="absolute inset-0 bg-gradient-to-b from-transparent to-card" />
            </div>
          )}
          <div className="p-5 flex gap-4">
            <div className="w-16 h-24 rounded-lg bg-secondary overflow-hidden shrink-0 -mt-8 border-2 border-card shadow-lg">
              {request.poster_url
                ? <img src={request.poster_url} alt="" className="w-full h-full object-cover" />
                : <div className="w-full h-full flex items-center justify-center">
                    {request.media_type === 'movie' ? <Film className="w-6 h-6 text-muted-foreground" /> : <Tv className="w-6 h-6 text-muted-foreground" />}
                  </div>
              }
            </div>
            <div className="flex-1 min-w-0 mt-1">
              <h2 className="font-bold text-lg leading-tight truncate">{request.title}</h2>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {request.year && <span className="text-sm text-muted-foreground">{request.year}</span>}
                <Badge variant="outline" className="text-[10px] capitalize">{request.media_type}</Badge>
                <StatusBadge status={request.status} />
              </div>
            </div>
          </div>
        </div>

        <div className="px-5 pb-5 space-y-5">
          {/* Status Timeline */}
          <Card className="p-4">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase mb-3">Status Timeline</h3>
            {isDeclined ? (
              <div className="flex items-center gap-2 text-sm text-red-400">
                <CheckCircle2 className="w-4 h-4" />
                <span className="font-medium">{STATUS_LABELS[request.status] || request.status}</span>
              </div>
            ) : (
              <div className="flex items-center gap-1">
                {STATUS_TIMELINE.map((s, i) => (
                  <React.Fragment key={s}>
                    <div className="flex flex-col items-center gap-1">
                      {i <= currentStatusIdx
                        ? <CheckCircle2 className="w-4 h-4 text-primary" />
                        : <Circle className="w-4 h-4 text-muted-foreground/30" />
                      }
                      <span className={`text-[9px] text-center ${i <= currentStatusIdx ? 'text-primary' : 'text-muted-foreground/40'}`}>{STATUS_LABELS[s]}</span>
                    </div>
                    {i < STATUS_TIMELINE.length - 1 && (
                      <div className={`flex-1 h-px mb-4 ${i < currentStatusIdx ? 'bg-primary' : 'bg-border'}`} />
                    )}
                  </React.Fragment>
                ))}
              </div>
            )}
          </Card>

          {/* Metadata */}
          <Card className="p-4">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase mb-3">Details</h3>
            <div className="space-y-2">
              {[
                ['Requested By', request.requested_by || request.created_by],
                ['Approved By', request.approved_by],
                ['Requested', request.created_date ? format(new Date(request.created_date), 'MMM d, yyyy HH:mm') : null],
                ['Approved', request.approved_date ? format(new Date(request.approved_date), 'MMM d, yyyy HH:mm') : null],
                ['Declined', request.declined_date ? format(new Date(request.declined_date), 'MMM d, yyyy HH:mm') : null],
                ['Decline Reason', request.decline_reason],
                ['Auto Search', request.auto_search ? 'Yes' : 'No'],
                ['Notes', request.notes],
                ['Admin Notes', request.admin_notes],
              ].filter(([, v]) => v).map(([label, value]) => (
                <div key={label} className="flex justify-between gap-4 text-sm">
                  <span className="text-muted-foreground shrink-0">{label}</span>
                  <span className="text-right text-xs font-medium truncate max-w-[200px]">{value}</span>
                </div>
              ))}
            </div>
          </Card>

          {/* Season grid (TV only) */}
          {request.media_type === 'series' && (
            <Card className="p-4">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase mb-3">Seasons</h3>
              {request.requested_seasons?.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {request.requested_seasons.map(s => {
                    const fulfilled = request.fulfilled_seasons?.includes(s);
                    return (
                      <div key={s} className={`w-10 h-10 rounded-lg flex items-center justify-center text-sm font-semibold border ${fulfilled ? 'bg-green-500/20 border-green-500/40 text-green-400' : 'bg-secondary border-border text-muted-foreground'}`}>
                        S{s}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">All seasons requested</p>
              )}
            </Card>
          )}

          {/* History */}
          {history.length > 0 && (
            <Card className="p-4">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase mb-3">History</h3>
              <div className="space-y-2">
                {history.map(e => (
                  <div key={e.id} className="flex items-center gap-2 text-sm">
                    <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${e.success === false ? 'bg-red-400' : 'bg-green-400'}`} />
                    <span className="flex-1 text-xs">{EVENT_LABELS[e.event_type] || e.event_type?.replace(/_/g, ' ')}</span>
                    {e.quality && <span className="text-[10px] text-muted-foreground">{e.quality}</span>}
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {e.created_date ? format(new Date(e.created_date), 'MMM d HH:mm') : ''}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Actions */}
          {(request.status === 'pending_approval' || request.status === 'submitted') && (
            <div className="flex gap-2">
              <Button className="flex-1" onClick={() => { onApprove(request); onClose(); }}>
                <CheckCircle2 className="w-4 h-4 mr-2" /> Approve
              </Button>
              <Button variant="outline" className="flex-1 text-red-400 border-red-500/30 hover:bg-red-500/10" onClick={() => { onDecline(request); onClose(); }}>
                Decline
              </Button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}