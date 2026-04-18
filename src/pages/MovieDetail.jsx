import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  ArrowLeft, Eye, EyeOff, Search, RefreshCw, Trash2, Star, Clock,
  FolderOpen, Activity, Download, MoreHorizontal, CheckCircle2, XCircle,
  AlertTriangle, Film
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import StatusBadge from '@/components/shared/StatusBadge';
import EmptyState from '@/components/shared/EmptyState';
import InteractiveSearchDrawer from '@/components/search/InteractiveSearchDrawer';
import DeleteMovieDialog from '@/components/movies/DeleteMovieDialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { format, isValid } from 'date-fns';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';

const EVENT_DESCRIPTIONS = {
  grabbed: (e) => `Grabbed ${e.source_info || 'release'}`,
  imported: (e) => `Imported to library${e.details ? ': ' + e.details : ''}`,
  import_failed: (e) => `Import failed${e.error_details ? ': ' + e.error_details : ''}`,
  searched: () => 'Automatic search triggered',
  upgraded: (e) => `Upgraded quality${e.details ? ': ' + e.details : ''}`,
  deleted: () => 'File deleted from disk',
  approved: (e) => `Request approved${e.user_email ? ' by ' + e.user_email : ''}`,
  declined: (e) => `Request declined${e.details ? ': ' + e.details : ''}`,
  renamed: () => 'File renamed',
  blocklisted: (e) => `Release blocklisted${e.source_info ? ': ' + e.source_info : ''}`,
  metadata_refreshed: () => 'Metadata refreshed',
  manual_import: (e) => `Manually imported${e.details ? ': ' + e.details : ''}`,
  download_failed: (e) => `Download failed${e.error_details ? ': ' + e.error_details : ''}`,
  download_completed: () => 'Download completed',
  download_started: () => 'Download started',
  quality_changed: (e) => `Quality changed${e.details ? ': ' + e.details : ''}`,
};

function HistoryTab({ history }) {
  if (history.length === 0) {
    return <EmptyState icon={Activity} title="No history" description="No events recorded for this movie" />;
  }

  // Group by date
  const grouped = history.reduce((acc, event) => {
    const date = event.created_date ? format(new Date(event.created_date), 'MMMM d, yyyy') : 'Unknown';
    if (!acc[date]) acc[date] = [];
    acc[date].push(event);
    return acc;
  }, {});

  return (
    <Card>
      <div className="divide-y divide-border">
        {Object.entries(grouped).map(([date, events]) => (
          <React.Fragment key={date}>
            <div className="px-4 py-2 bg-secondary/40">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{date}</p>
            </div>
            {events.map(event => {
              const desc = EVENT_DESCRIPTIONS[event.event_type];
              return (
                <div key={event.id} className={`flex items-start gap-3 px-4 py-3 ${event.success === false ? 'bg-red-500/5' : ''}`}>
                  {event.success === false
                    ? <XCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                    : <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0 mt-0.5" />
                  }
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${event.success === false ? 'text-red-400' : ''}`}>
                      {desc ? desc(event) : event.event_type?.replace(/_/g, ' ')}
                    </p>
                    {['grabbed','blocklisted','download_failed'].includes(event.event_type) && event.source_info && (
                      <p className="text-[10px] font-mono text-muted-foreground/70 mt-0.5 truncate">{event.source_info}</p>
                    )}
                    {event.error_details && (
                      <p className="text-xs text-red-400 mt-0.5">{event.error_details}</p>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {event.created_date && isValid(new Date(event.created_date)) ? format(new Date(event.created_date), 'HH:mm') : ''}
                  </span>
                </div>
              );
            })}
          </React.Fragment>
        ))}
      </div>
    </Card>
  );
}

export default function MovieDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchOpen, setSearchOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [manualImportOpen, setManualImportOpen] = useState(false);
  const [manualImportPath, setManualImportPath] = useState('');

  const { data: movie, isLoading } = useQuery({
    queryKey: ['movie', id],
    queryFn: async () => {
      const movies = await base44.entities.Movie.filter({ id });
      return movies[0];
    },
  });

  const { data: history = [] } = useQuery({
    queryKey: ['movie-history', id],
    queryFn: () => base44.entities.HistoryEvent.filter({ media_id: id }, '-created_date', 100),
    initialData: [],
    enabled: !!id,
  });

  const updateMutation = useMutation({
    mutationFn: (data) => base44.entities.Movie.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['movie', id] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (mode) => {
      if (mode === 'unmonitor') {
        await base44.entities.Movie.update(id, { monitored: false, file_path: null, library_status: 'missing' });
      } else if (mode === 'delete_all') {
        await base44.entities.Movie.delete(id);
      } else {
        await base44.entities.Movie.update(id, { file_path: null, library_status: 'missing' });
      }
      await base44.entities.HistoryEvent.create({
        event_type: 'deleted',
        media_type: 'movie',
        media_id: id,
        media_title: movie?.title,
        details: `Delete mode: ${mode}`,
        success: true,
      });
    },
    onSuccess: (_, mode) => {
      queryClient.invalidateQueries({ queryKey: ['movies'] });
      if (mode === 'delete_all') navigate('/movies');
      else { queryClient.invalidateQueries({ queryKey: ['movie', id] }); toast.success('Done'); }
      setDeleteOpen(false);
    },
  });

  const handleRefreshMetadata = async () => {
    await updateMutation.mutateAsync({ added_date: new Date().toISOString() });
    await base44.entities.HistoryEvent.create({
      event_type: 'metadata_refreshed',
      media_type: 'movie',
      media_id: id,
      media_title: movie?.title,
      success: true,
    });
    queryClient.invalidateQueries({ queryKey: ['movie-history', id] });
    toast.success('Metadata refreshed');
  };

  if (isLoading || !movie) {
    return <div className="flex items-center justify-center py-20"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div>
      <Button variant="ghost" size="sm" onClick={() => navigate('/movies')} className="mb-4 gap-1.5">
        <ArrowLeft className="w-4 h-4" /> Movies
      </Button>

      {/* Hero */}
      <div className="relative rounded-xl overflow-hidden mb-6">
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/80 to-transparent z-10" />
        {movie.backdrop_url && (
          <img src={movie.backdrop_url} alt="" className="w-full h-64 object-cover opacity-30" />
        )}
        {!movie.backdrop_url && <div className="w-full h-64 bg-secondary" />}

        <div className="absolute inset-0 z-20 flex items-end p-6">
          <div className="flex gap-6">
            <div className="w-32 h-48 rounded-lg bg-secondary overflow-hidden shrink-0 shadow-xl">
              {movie.poster_url ? (
                <img src={movie.poster_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center"><Film className="w-8 h-8 text-muted-foreground" /></div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <StatusBadge status={movie.library_status || 'missing'} />
                <Badge variant="outline" className={`text-[10px] ${movie.monitored ? 'text-green-400 border-green-500/30' : 'text-slate-400'}`}>
                  {movie.monitored ? 'Monitored' : 'Unmonitored'}
                </Badge>
              </div>

              <h1 className="text-3xl font-bold">{movie.title}</h1>

              <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                {movie.year && <span>{movie.year}</span>}
                {movie.runtime > 0 && <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {movie.runtime}m</span>}
                {movie.rating > 0 && <span className="flex items-center gap-1"><Star className="w-3 h-3 text-yellow-400 fill-yellow-400" /> {movie.rating?.toFixed(1)}</span>}
                {movie.certification && <span>{movie.certification}</span>}
              </div>

              {movie.genres?.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {movie.genres.map(g => <Badge key={g} variant="secondary" className="text-[10px]">{g}</Badge>)}
                </div>
              )}

              <div className="flex items-center gap-2 mt-4">
                <Button size="sm" className="gap-1.5" onClick={() => setSearchOpen(true)}>
                  <Search className="w-3 h-3" /> Search
                </Button>
                <Button size="sm" variant="outline" onClick={() => {
                  updateMutation.mutate({ monitored: !movie.monitored });
                  toast.success(movie.monitored ? 'Unmonitored' : 'Monitored');
                }}>
                  {movie.monitored ? <EyeOff className="w-3 h-3 mr-1" /> : <Eye className="w-3 h-3 mr-1" />}
                  {movie.monitored ? 'Unmonitor' : 'Monitor'}
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" variant="outline"><MoreHorizontal className="w-4 h-4" /></Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onClick={handleRefreshMetadata}><RefreshCw className="w-4 h-4 mr-2" /> Refresh Metadata</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => { setManualImportPath(''); setManualImportOpen(true); }}><FolderOpen className="w-4 h-4 mr-2" /> Manual Import</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setSearchOpen(true)}><Download className="w-4 h-4 mr-2" /> Interactive Search</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-destructive" onClick={() => setDeleteOpen(true)}>
                      <Trash2 className="w-4 h-4 mr-2" /> Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <TabsList className="bg-secondary mb-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="files">Files</TabsTrigger>
          <TabsTrigger value="history">History ({history.length})</TabsTrigger>
          <TabsTrigger value="search">Search</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              {/* Synopsis */}
              <Card className="p-5">
                <h3 className="font-semibold mb-3">Synopsis</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{movie.overview || 'No overview available.'}</p>
              </Card>

              {/* Metadata grid */}
              <Card className="p-5">
                <h3 className="font-semibold mb-3">Details</h3>
                <div className="grid grid-cols-2 gap-4">
                  {[
                    ['Studio', movie.studio],
                    ['Original Language', movie.original_language?.toUpperCase()],
                    ['Certification', movie.certification],
                    ['Genres', movie.genres?.join(', ')],
                    ['Collection', movie.collection_name],
                    ['Theatrical Release', movie.theatrical_release_date],
                    ['Digital Release', movie.digital_release_date],
                    ['Physical Release', movie.physical_release_date],
                    ['TMDB ID', movie.tmdb_id],
                    ['IMDB ID', movie.imdb_id],
                  ].filter(([, v]) => v).map(([label, value]) => (
                    <div key={label}>
                      <p className="text-xs text-muted-foreground">{label}</p>
                      <p className="text-sm font-medium mt-0.5 truncate">{value}</p>
                    </div>
                  ))}
                </div>
              </Card>

              {/* Cast placeholder */}
              <Card className="p-5">
                <h3 className="font-semibold mb-3">Cast & Crew</h3>
                <div className="flex gap-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="text-center w-16 shrink-0">
                      <Skeleton className="w-14 h-14 rounded-full mx-auto" />
                      <Skeleton className="h-3 w-12 mx-auto mt-2" />
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-3">Cast data not available</p>
              </Card>

              {/* Similar movies */}
              <Card className="p-5">
                <h3 className="font-semibold mb-3">Similar Movies</h3>
                <Button asChild variant="outline" size="sm" className="gap-1.5">
                  <Link to={`/discover?q=${encodeURIComponent(movie.title)}`}>
                    <Search className="w-3 h-3" /> Discover Similar
                  </Link>
                </Button>
              </Card>
            </div>

            {/* Right column — file info */}
            <div className="space-y-4">
              <Card className="p-4 space-y-3">
                <h3 className="font-semibold text-sm">File Info</h3>
                {[
                  ['Quality', movie.quality],
                  ['Source', movie.source],
                  ['Resolution', movie.resolution],
                  ['Video Codec', movie.video_codec],
                  ['Audio Codec', movie.audio_codec],
                  ['HDR Format', movie.hdr_format],
                  ['Size', movie.file_size ? `${(movie.file_size / 1073741824).toFixed(2)} GB` : null],
                  ['Added', movie.added_date && isValid(new Date(movie.added_date)) ? format(new Date(movie.added_date), 'MMM d, yyyy') : null],
                ].filter(([, v]) => v).map(([label, value]) => (
                  <div key={label} className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{label}</span>
                    <span className="text-right max-w-[200px] truncate font-mono text-xs">{value}</span>
                  </div>
                ))}
                {movie.file_path && (
                  <div className="pt-2 border-t border-border">
                    <p className="text-xs text-muted-foreground">File Path</p>
                    <p className="text-xs font-mono mt-1 break-all">{movie.file_path}</p>
                  </div>
                )}
                {!movie.file_path && !movie.quality && (
                  <p className="text-xs text-muted-foreground">No file in library</p>
                )}
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="files">
          {movie.file_path ? (
            <Card className="p-4 space-y-3">
              {[
                ['Path', movie.file_path],
                ['Size', movie.file_size ? `${(movie.file_size / 1073741824).toFixed(2)} GB` : '—'],
                ['Quality', movie.quality || '—'],
                ['Video Codec', movie.video_codec || '—'],
                ['Audio Codec', movie.audio_codec || '—'],
                ['Resolution', movie.resolution || '—'],
              ].map(([label, val]) => (
                <div key={label} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-mono text-xs">{val}</span>
                </div>
              ))}
            </Card>
          ) : (
            <EmptyState icon={FolderOpen} title="No files" description="This movie has no files in the library" />
          )}
        </TabsContent>

        <TabsContent value="history">
          <HistoryTab history={history} />
        </TabsContent>

        <TabsContent value="search">
          <div className="text-center py-8">
            <Button onClick={() => setSearchOpen(true)} className="gap-1.5">
              <Search className="w-4 h-4" /> Open Interactive Search
            </Button>
          </div>
        </TabsContent>
      </Tabs>

      <InteractiveSearchDrawer open={searchOpen} onClose={() => setSearchOpen(false)} media={movie} mediaType="movie" />
      {deleteOpen && <DeleteMovieDialog movie={movie} onClose={() => setDeleteOpen(false)} onConfirm={(mode) => deleteMutation.mutate(mode)} />}

      <Dialog open={manualImportOpen} onOpenChange={setManualImportOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Manual Import — {movie?.title}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Label>File Path</Label>
            <Input
              value={manualImportPath}
              onChange={e => setManualImportPath(e.target.value)}
              placeholder="/media/movies/Oppenheimer.2023.BluRay.mkv"
              className="font-mono text-sm bg-secondary border-0"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setManualImportOpen(false)}>Cancel</Button>
            <Button onClick={async () => {
              if (!manualImportPath.trim()) { toast.error('Enter a file path'); return; }
              await updateMutation.mutateAsync({ file_path: manualImportPath, library_status: 'available' });
              await base44.entities.HistoryEvent.create({
                event_type: 'manual_import', media_type: 'movie', media_id: id,
                media_title: movie?.title, source_info: manualImportPath, success: true,
              });
              queryClient.invalidateQueries({ queryKey: ['movie-history', id] });
              toast.success('File imported successfully');
              setManualImportOpen(false);
            }}>Assign & Import</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}