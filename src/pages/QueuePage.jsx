import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { Download, RotateCcw, Trash2, Shield, FolderInput, MoreHorizontal, Pause, Play, Film, Tv } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import PageHeader from '@/components/shared/PageHeader';
import StatusBadge from '@/components/shared/StatusBadge';
import EmptyState from '@/components/shared/EmptyState';
import { toast } from 'sonner';

export default function QueuePage() {
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const statusParam = searchParams.get('status');

  const { data: queue = [] } = useQuery({
    queryKey: ['download-queue'],
    queryFn: () => base44.entities.DownloadQueueItem.list('-created_date', 100),
    initialData: [],
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.DownloadQueueItem.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['download-queue'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.DownloadQueueItem.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['download-queue'] }),
  });

  const active = queue.filter(q => ['downloading', 'queued', 'importing'].includes(q.status));
  const completed = queue.filter(q => q.status === 'imported' || q.status === 'completed');
  const failed = queue.filter(q => q.status === 'failed' || q.status === 'warning' || q.status === 'stalled');
  // If navigated from dashboard with ?status=failed, scroll indicator
  const highlightFailed = statusParam === 'failed';

  return (
    <div>
      <PageHeader title="Queue" description={`${active.length} active, ${failed.length} issues`}>
        {highlightFailed && failed.length > 0 && <span className="text-xs text-red-400 font-medium">{failed.length} failed items</span>}
      </PageHeader>

      {/* Active Downloads */}
      <h3 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wider">Active Downloads</h3>
      <Card className="mb-6">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Progress</TableHead>
              <TableHead>Quality</TableHead>
              <TableHead>Protocol</TableHead>
              <TableHead>Size</TableHead>
              <TableHead>ETA</TableHead>
              <TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {active.length === 0 ? (
              <TableRow><TableCell colSpan={8}><EmptyState icon={Download} title="Queue is empty" description="Downloads will appear here when releases are grabbed">
                <Button asChild variant="outline" size="sm"><Link to="/wanted">Go to Wanted</Link></Button>
              </EmptyState></TableCell></TableRow>
            ) : active.map(item => (
              <TableRow key={item.id}>
                <TableCell>
                  <div>
                    <div className="flex items-center gap-1.5">
                      {item.media_type === 'movie'
                        ? <Film className="w-3 h-3 text-blue-400 shrink-0" />
                        : <Tv className="w-3 h-3 text-purple-400 shrink-0" />
                      }
                      <p className="font-medium text-sm">{item.title}</p>
                    </div>
                    {item.release_name && (
                      <p className="text-[10px] text-muted-foreground font-mono truncate max-w-[220px] mt-0.5 pl-4">
                        {item.release_name}
                      </p>
                    )}
                  </div>
                </TableCell>
                <TableCell><StatusBadge status={item.status} /></TableCell>
                <TableCell>
                  <div className="flex items-center gap-2 min-w-[100px]">
                    <Progress value={item.progress || 0} className="h-1.5" />
                    <span className="text-xs text-muted-foreground">{item.progress || 0}%</span>
                  </div>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{item.quality || '—'}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-[10px]">{item.protocol || '—'}</Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {item.size ? `${(item.size / 1073741824).toFixed(1)} GB` : '—'}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{item.eta || '—'}</TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="w-4 h-4" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => updateMutation.mutate({ id: item.id, data: { status: item.status === 'paused' ? 'downloading' : 'paused' } })}>
                        {item.status === 'paused' ? <><Play className="w-4 h-4 mr-2" /> Resume</> : <><Pause className="w-4 h-4 mr-2" /> Pause</>}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => { updateMutation.mutate({ id: item.id, data: { status: 'queued' } }); toast.success('Retrying'); }}>
                        <RotateCcw className="w-4 h-4 mr-2" /> Retry
                      </DropdownMenuItem>
                      <DropdownMenuItem><FolderInput className="w-4 h-4 mr-2" /> Manual Import</DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => toast.success('Release blocklisted')}>
                        <Shield className="w-4 h-4 mr-2" /> Blocklist
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive" onClick={() => deleteMutation.mutate(item.id)}>
                        <Trash2 className="w-4 h-4 mr-2" /> Remove
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* Failed */}
      {failed.length > 0 && (
        <>
          <h3 className="text-sm font-semibold mb-3 text-red-400 uppercase tracking-wider">Issues ({failed.length})</h3>
          <Card className="mb-6 border-red-500/20">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Error</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {failed.map(item => (
                 <TableRow key={item.id}>
                   <TableCell>
                     <div>
                       <div className="flex items-center gap-1.5">
                         {item.media_type === 'movie'
                           ? <Film className="w-3 h-3 text-blue-400 shrink-0" />
                           : <Tv className="w-3 h-3 text-purple-400 shrink-0" />
                         }
                         <p className="font-medium text-sm">{item.title}</p>
                       </div>
                       {item.release_name && (
                         <p className="text-[10px] text-muted-foreground font-mono truncate max-w-[220px] mt-0.5 pl-4">
                           {item.release_name}
                         </p>
                       )}
                     </div>
                   </TableCell>
                    <TableCell><StatusBadge status={item.status} /></TableCell>
                    <TableCell className="text-sm text-red-400 max-w-[300px] truncate">{item.error_message || 'Unknown error'}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { updateMutation.mutate({ id: item.id, data: { status: 'queued', error_message: '' } }); toast.success('Retrying'); }}>
                        <RotateCcw className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </>
      )}
    </div>
  );
}