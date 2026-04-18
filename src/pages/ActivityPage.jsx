import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Activity, Search, Film, Tv } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import PageHeader from '@/components/shared/PageHeader';
import StatusBadge from '@/components/shared/StatusBadge';
import EmptyState from '@/components/shared/EmptyState';
import { format } from 'date-fns';

const eventTypes = [
  'all', 'requested', 'approved', 'declined', 'searched', 'grabbed',
  'download_started', 'download_completed', 'download_failed',
  'imported', 'import_failed', 'renamed', 'deleted', 'upgraded', 'blocklisted',
  'manual_import', 'metadata_refreshed',
];

export default function ActivityPage() {
  const [typeFilter, setTypeFilter] = useState('all');
  const [mediaTypeFilter, setMediaTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');

  const { data: events = [] } = useQuery({
    queryKey: ['history-events', typeFilter],
    queryFn: async () => {
      if (typeFilter !== 'all') {
        return base44.entities.HistoryEvent.filter({ event_type: typeFilter }, '-created_date', 200);
      }
      return base44.entities.HistoryEvent.list('-created_date', 200);
    },
    initialData: [],
  });

  const filtered = events.filter(e => {
    if (search && !e.media_title?.toLowerCase().includes(search.toLowerCase())) return false;
    if (mediaTypeFilter !== 'all' && e.media_type !== mediaTypeFilter) return false;
    if (statusFilter === 'successful' && e.success === false) return false;
    if (statusFilter === 'failed' && e.success !== false) return false;
    return true;
  });

  return (
    <div>
      <PageHeader title="Activity" description="Complete history of all events" />

      <div className="flex items-center gap-3 mb-2 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Filter activity..." className="pl-9 h-9 bg-secondary border-0" />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-44 h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            {eventTypes.map(t => (
              <SelectItem key={t} value={t}>{t === 'all' ? 'All Events' : t.replace(/_/g, ' ')}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={mediaTypeFilter} onValueChange={setMediaTypeFilter}>
          <SelectTrigger className="w-36 h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Media</SelectItem>
            <SelectItem value="movie">Movies</SelectItem>
            <SelectItem value="series">Series</SelectItem>
            <SelectItem value="episode">Episodes</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-32 h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="successful">Successful</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <p className="text-xs text-muted-foreground mb-4">
        Showing {filtered.length} of {events.length} events
      </p>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Event</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Details</TableHead>
              <TableHead>Quality</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6}>
                  <EmptyState icon={Activity} title="No activity" description="Events will appear here as actions occur" />
                </TableCell>
              </TableRow>
            ) : (
              filtered.map(event => (
                 <TableRow key={event.id}>
                   <TableCell>
                     <div className="flex items-center gap-2">
                       {event.media_type === 'movie'
                         ? <Film className="w-4 h-4 text-blue-400 shrink-0" />
                         : (event.media_type === 'series' || event.media_type === 'episode')
                         ? <Tv className="w-4 h-4 text-purple-400 shrink-0" />
                         : <Activity className="w-4 h-4 text-muted-foreground shrink-0" />
                       }
                       <StatusBadge status={event.success === false ? 'failed' : event.event_type === 'approved' ? 'approved' : event.event_type === 'declined' ? 'declined' : 'available'} className="capitalize" />
                       <span className="text-xs">{event.event_type?.replace(/_/g, ' ')}</span>
                     </div>
                   </TableCell>
                  <TableCell className="font-medium text-sm">{event.media_title}</TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{event.details || event.source_info || '—'}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{event.quality || '—'}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{event.user_email || '—'}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {event.created_date ? format(new Date(event.created_date), 'MMM d, HH:mm') : '—'}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}