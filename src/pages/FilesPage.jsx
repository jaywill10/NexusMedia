import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import {
  FolderOpen, HardDrive, Film, AlertTriangle, Search, Upload,
  MoreHorizontal, Tv, RefreshCw, Trash2, Loader2, Pencil,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from '@/components/ui/alert-dialog';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle
} from '@/components/ui/sheet';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from '@/components/ui/select';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
import StatsCard from '@/components/shared/StatsCard';
import { toast } from 'sonner';

// Tiny path.basename substitute for the frontend
const path = {
  basename: (p) => (p || '').split('/').pop(),
};

function ManualImportSheet({ open, onClose, movies, series }) {
  const [scanPath, setScanPath] = useState('/downloads');
  const [scanning, setScanning] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [fileRows, setFileRows] = useState([]);
  const [importingId, setImportingId] = useState(null);
  const queryClient = useQueryClient();

  const handleScan = async () => {
    setScanning(true);
    setScanned(false);
    try {
      const res = await base44.imports.scan({ path: scanPath });
      setFileRows((res.files || []).map(f => ({
        ...f,
        status: 'pending',
        // auto-pick detected media type + match where available
        media_type: f.media_type || 'movie',
        media_id: f.match_id || null,
        import_mode: null, // uses server default when null
      })));
      setScanned(true);
      if (!res.files?.length) toast.warning(`No video files found in ${scanPath}`);
    } catch (err) {
      toast.error(err.message || 'Scan failed');
    } finally {
      setScanning(false);
    }
  };

  const updateRow = (id, key, val) => {
    setFileRows(prev => prev.map(r => r.id === id ? { ...r, [key]: val } : r));
  };

  const importRow = async (row) => {
    if (!row.media_id) { toast.error('Assign to a movie or series first'); return; }
    setImportingId(row.id);
    try {
      const res = await base44.imports.process({
        source_path: row.file_path,
        media_type: row.media_type,
        media_id: row.media_id,
        season_number: row.parsed_season ?? undefined,
        episode_number: row.parsed_episode ?? undefined,
        import_mode: row.import_mode || undefined,
      });
      setFileRows(prev => prev.map(r => r.id === row.id ? { ...r, status: 'imported', dest: res.dest } : r));
      queryClient.invalidateQueries({ queryKey: ['files-movies'] });
      queryClient.invalidateQueries({ queryKey: ['files-episodes'] });
      toast.success(`Imported: ${path.basename(res.dest || row.file_path)}`);
    } catch (err) {
      setFileRows(prev => prev.map(r => r.id === row.id ? { ...r, status: 'failed', error: err.message } : r));
      toast.error(err.message || 'Import failed');
    } finally {
      setImportingId(null);
    }
  };

  const importAll = async () => {
    const matched = fileRows.filter(r => r.media_id && r.status !== 'imported');
    if (!matched.length) { toast.error('No matched rows to import'); return; }
    for (const row of matched) await importRow(row);
  };

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent side="right" className="w-full max-w-6xl overflow-y-auto">
        <SheetHeader className="mb-4">
          <SheetTitle>Manual Import</SheetTitle>
        </SheetHeader>
        <div className="flex gap-2 mb-4">
          <Input
            value={scanPath}
            onChange={e => setScanPath(e.target.value)}
            className="bg-secondary border-0 font-mono text-sm"
            placeholder="/downloads/complete"
          />
          <Button onClick={handleScan} disabled={scanning || !scanPath}>
            {scanning ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Scanning…</> : 'Scan'}
          </Button>
        </div>
        {scanned && fileRows.length === 0 && (
          <EmptyState icon={FolderOpen} title="No video files found" description={`Nothing to import in ${scanPath}`} />
        )}
        {scanned && fileRows.length > 0 && (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>File</TableHead>
                    <TableHead>Parsed</TableHead>
                    <TableHead>Quality</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Assign To</TableHead>
                    <TableHead>Mode</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fileRows.map(row => {
                    const candidates = row.media_type === 'series' ? series : movies;
                    const isEpisode = row.media_type === 'series' && row.parsed_season != null && row.parsed_episode != null;
                    return (
                      <TableRow key={row.id}>
                        <TableCell className="max-w-[240px] truncate font-mono text-xs text-muted-foreground" title={row.file_path}>
                          {row.file_path.split('/').pop()}
                        </TableCell>
                        <TableCell className="text-xs">
                          <div className="font-medium">{row.parsed_title || '—'}</div>
                          <div className="text-muted-foreground">
                            {row.parsed_year && `${row.parsed_year} `}
                            {isEpisode && `S${String(row.parsed_season).padStart(2,'0')}E${String(row.parsed_episode).padStart(2,'0')}`}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs">{row.parsed_quality || '—'}</TableCell>
                        <TableCell>
                          <Select value={row.media_type} onValueChange={v => updateRow(row.id, 'media_type', v)}>
                            <SelectTrigger className="h-7 text-xs bg-secondary border-0 w-24"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="movie">Movie</SelectItem>
                              <SelectItem value="series">Series</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="min-w-[200px]">
                          <Select value={row.media_id || ''} onValueChange={v => updateRow(row.id, 'media_id', v || null)}>
                            <SelectTrigger className="h-7 text-xs bg-secondary border-0"><SelectValue placeholder="Assign…" /></SelectTrigger>
                            <SelectContent>
                              {candidates.map(m => (
                                <SelectItem key={m.id} value={m.id}>
                                  {m.title}{m.year ? ` (${m.year})` : ''}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="min-w-[110px]">
                          <Select value={row.import_mode || 'default'} onValueChange={v => updateRow(row.id, 'import_mode', v === 'default' ? null : v)}>
                            <SelectTrigger className="h-7 text-xs bg-secondary border-0"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="default">Default</SelectItem>
                              <SelectItem value="hardlink">Hardlink</SelectItem>
                              <SelectItem value="move">Move</SelectItem>
                              <SelectItem value="copy">Copy</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={`text-[10px] ${
                              row.status === 'imported' ? 'text-green-400 border-green-500/30' :
                              row.status === 'failed' ? 'text-red-400 border-red-500/30' :
                              row.media_id ? 'text-blue-400 border-blue-500/30' : ''
                            }`}
                            title={row.error || ''}
                          >
                            {row.status === 'imported' ? 'Imported' : row.status === 'failed' ? 'Failed' : row.media_id ? 'Matched' : 'Pending'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {row.status !== 'imported' && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs gap-1"
                              disabled={importingId === row.id || !row.media_id}
                              onClick={() => importRow(row)}
                            >
                              {importingId === row.id && <Loader2 className="w-3 h-3 animate-spin" />}
                              Import
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setFileRows([])}>Clear</Button>
              <Button onClick={importAll}>Import All Matched</Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

export default function FilesPage() {
  const [search, setSearch] = useState('');
  const [episodeSearch, setEpisodeSearch] = useState('');
  const [manualImportOpen, setManualImportOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const queryClient = useQueryClient();

  const { data: movies = [] } = useQuery({
    queryKey: ['files-movies'],
    queryFn: () => base44.entities.Movie.list('-file_size', 500),
    initialData: [],
  });

  const { data: episodes = [] } = useQuery({
    queryKey: ['files-episodes'],
    queryFn: () => base44.entities.Episode.filter({ has_file: true }, '-updated_date', 500),
    initialData: [],
  });

  const { data: series = [] } = useQuery({
    queryKey: ['series-all'],
    queryFn: () => base44.entities.Series.list('-title', 500),
    initialData: [],
  });

  const updateMovieMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Movie.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['files-movies'] }),
  });

  const updateEpisodeMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Episode.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['files-episodes'] }),
  });

  const renameMutation = useMutation({
    mutationFn: (payload) => base44.imports.rename(payload),
    onSuccess: (res) => {
      if (res.unchanged) toast.info('Filename already matches naming template');
      else toast.success(`Renamed to ${path.basename(res.dest)}`);
      queryClient.invalidateQueries({ queryKey: ['files-movies'] });
      queryClient.invalidateQueries({ queryKey: ['files-episodes'] });
    },
    onError: (err) => toast.error(err.message || 'Rename failed'),
  });

  const moviesWithFiles = movies.filter(m => m.file_path);
  const totalSize = moviesWithFiles.reduce((sum, m) => sum + (m.file_size || 0), 0);
  const orphaned = movies.filter(m => m.file_path && !m.monitored);

  const filteredMovies = moviesWithFiles.filter(m =>
    !search || m.title?.toLowerCase().includes(search.toLowerCase())
  );

  const filteredEpisodes = episodes.filter(ep =>
    !episodeSearch || ep.title?.toLowerCase().includes(episodeSearch.toLowerCase())
  );

  const getSeriesTitle = (series_id) => {
    const s = series.find(s => s.id === series_id);
    return s?.title || series_id;
  };

  const handleDeleteMovie = async () => {
    const movie = deleteTarget.item;
    await updateMovieMutation.mutateAsync({ id: movie.id, data: { file_path: null, library_status: 'missing' } });
    await base44.entities.HistoryEvent.create({
      event_type: 'deleted', media_type: 'movie', media_id: movie.id,
      media_title: movie.title, details: 'File reference removed from Files page', success: true,
    });
    toast.success(`Deleted reference: ${movie.title}`);
    setDeleteTarget(null);
  };

  const handleDeleteEpisode = async () => {
    const ep = deleteTarget.item;
    await updateEpisodeMutation.mutateAsync({ id: ep.id, data: { has_file: false, file_path: null, status: 'missing' } });
    toast.success('Episode file reference removed');
    setDeleteTarget(null);
  };

  return (
    <div>
      <PageHeader title="Files" description="Media file management and storage overview">
        <Button size="sm" className="gap-1.5" onClick={() => setManualImportOpen(true)}>
          <Upload className="w-4 h-4" /> Manual Import
        </Button>
      </PageHeader>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatsCard label="Movie Files" value={moviesWithFiles.length} icon={Film} />
        <StatsCard label="Episode Files" value={episodes.length} icon={Tv} />
        <StatsCard label="Total Size" value={`${(totalSize / 1099511627776).toFixed(1)} TB`} icon={HardDrive} />
        <StatsCard label="Orphaned" value={orphaned.length} icon={AlertTriangle} />
      </div>

      <Tabs defaultValue="movie-files">
        <TabsList className="bg-secondary mb-4">
          <TabsTrigger value="movie-files">Movie Files ({moviesWithFiles.length})</TabsTrigger>
          <TabsTrigger value="episode-files">Episode Files ({episodes.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="movie-files">
          <div className="relative max-w-sm mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Filter movies..." className="pl-9 h-9 bg-secondary border-0" />
          </div>
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Path</TableHead>
                  <TableHead>Quality</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Codec</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMovies.length === 0 ? (
                  <TableRow><TableCell colSpan={6}><EmptyState icon={FolderOpen} title="No files found" /></TableCell></TableRow>
                ) : filteredMovies.map(movie => (
                  <TableRow key={movie.id} className="group">
                    <TableCell className="font-medium text-sm">{movie.title}</TableCell>
                    <TableCell className="text-xs text-muted-foreground font-mono max-w-[200px] truncate" title={movie.file_path}>{movie.file_path}</TableCell>
                    <TableCell className="text-sm">{movie.quality || '—'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {movie.file_size ? `${(movie.file_size / 1073741824).toFixed(1)} GB` : '—'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{movie.video_codec || '—'}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => renameMutation.mutate({ media_type: 'movie', media_id: movie.id })}>
                            <Pencil className="w-4 h-4 mr-2" /> Rename to template
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive" onClick={() => setDeleteTarget({ type: 'movie', item: movie })}>
                            <Trash2 className="w-4 h-4 mr-2" /> Remove reference
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="episode-files">
          <div className="relative max-w-sm mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input value={episodeSearch} onChange={e => setEpisodeSearch(e.target.value)} placeholder="Filter episodes..." className="pl-9 h-9 bg-secondary border-0" />
          </div>
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Series</TableHead>
                  <TableHead>Episode</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Path</TableHead>
                  <TableHead>Quality</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEpisodes.length === 0 ? (
                  <TableRow><TableCell colSpan={7}><EmptyState icon={Tv} title="No episode files" description="Episodes with files will appear here" /></TableCell></TableRow>
                ) : filteredEpisodes.map(ep => (
                  <TableRow key={ep.id} className="group">
                    <TableCell>
                      <Link to={`/series/${ep.series_id}`} className="text-sm font-medium hover:text-primary">{getSeriesTitle(ep.series_id)}</Link>
                    </TableCell>
                    <TableCell className="text-sm font-mono">
                      S{String(ep.season_number).padStart(2,'0')}E{String(ep.episode_number).padStart(2,'0')}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{ep.title || '—'}</TableCell>
                    <TableCell className="text-xs font-mono text-muted-foreground max-w-[160px] truncate" title={ep.file_path}>{ep.file_path || '—'}</TableCell>
                    <TableCell className="text-sm">{ep.quality || '—'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {ep.file_size ? `${(ep.file_size / 1073741824).toFixed(1)} GB` : '—'}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => renameMutation.mutate({ media_type: 'episode', media_id: ep.id })}>
                            <Pencil className="w-4 h-4 mr-2" /> Rename to template
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive" onClick={() => setDeleteTarget({ type: 'episode', item: ep })}>
                            <Trash2 className="w-4 h-4 mr-2" /> Remove reference
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>

      <ManualImportSheet open={manualImportOpen} onClose={() => setManualImportOpen(false)} movies={movies} series={series} />

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove file reference</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the reference from the library. The physical file on disk is not deleted.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={() => {
              if (deleteTarget?.type === 'movie') handleDeleteMovie();
              else handleDeleteEpisode();
            }}>Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
