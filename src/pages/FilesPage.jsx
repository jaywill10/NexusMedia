import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import {
  FolderOpen, HardDrive, Film, AlertTriangle, Search, Upload,
  MoreHorizontal, Tv, RefreshCw, Trash2
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
import StatusBadge from '@/components/shared/StatusBadge';
import EmptyState from '@/components/shared/EmptyState';
import StatsCard from '@/components/shared/StatsCard';
import { toast } from 'sonner';

const MOCK_FILES = [
  { id: 1, file_path: '/downloads/complete/Oppenheimer.2023.BluRay.2160p.x265-GROUP/Oppenheimer.2023.BluRay.2160p.x265.mkv', parsed_title: 'Oppenheimer', parsed_year: 2023, parsed_quality: 'BluRay-2160p', status: 'Pending', movie_id: null },
  { id: 2, file_path: '/downloads/complete/Dune.Part.Two.2024.WEBDL.1080p.DTS-HD.mkv', parsed_title: 'Dune Part Two', parsed_year: 2024, parsed_quality: 'WEBDL-1080p', status: 'Pending', movie_id: null },
  { id: 3, file_path: '/downloads/complete/Poor.Things.2023.BluRay.1080p.x264.mkv', parsed_title: 'Poor Things', parsed_year: 2023, parsed_quality: 'BluRay-1080p', status: 'Pending', movie_id: null },
  { id: 4, file_path: '/downloads/complete/Mission.Impossible.DeadReckoning.2023.4K.HDR.mkv', parsed_title: 'Mission Impossible Dead Reckoning', parsed_year: 2023, parsed_quality: 'BluRay-2160p', status: 'Pending', movie_id: null },
  { id: 5, file_path: '/downloads/complete/The.Zone.of.Interest.2023.1080p.WEBDL.mkv', parsed_title: 'The Zone of Interest', parsed_year: 2023, parsed_quality: 'WEBDL-1080p', status: 'Pending', movie_id: null },
];

function ManualImportSheet({ open, onClose, movies }) {
  const [scanPath, setScanPath] = useState('/downloads');
  const [scanning, setScanning] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [fileRows, setFileRows] = useState([]);
  const queryClient = useQueryClient();

  const handleScan = async () => {
    setScanning(true);
    await new Promise(r => setTimeout(r, 800));
    setFileRows(MOCK_FILES.map(f => ({ ...f, movie_id: null, import_mode: 'Move' })));
    setScanned(true);
    setScanning(false);
  };

  const updateRow = (id, key, val) => {
    setFileRows(prev => prev.map(r => r.id === id ? { ...r, [key]: val } : r));
  };

  const importRow = async (row) => {
    if (!row.movie_id) { toast.error('Assign to a movie first'); return; }
    const movie = movies.find(m => m.id === row.movie_id);
    await base44.entities.Movie.update(row.movie_id, {
      file_path: row.file_path,
      quality: row.parsed_quality,
      library_status: 'available',
    });
    await base44.entities.HistoryEvent.create({
      event_type: 'manual_import',
      media_type: 'movie',
      media_id: row.movie_id,
      media_title: movie?.title || row.parsed_title,
      source_info: row.file_path,
      quality: row.parsed_quality,
      success: true,
    });
    setFileRows(prev => prev.map(r => r.id === row.id ? { ...r, status: 'Imported' } : r));
    queryClient.invalidateQueries({ queryKey: ['files-movies'] });
    toast.success(`Imported: ${movie?.title || row.parsed_title}`);
  };

  const importAll = async () => {
    const matched = fileRows.filter(r => r.movie_id && r.status !== 'Imported');
    if (!matched.length) { toast.error('No matched rows to import'); return; }
    for (const row of matched) await importRow(row);
  };

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent side="right" className="w-full max-w-5xl overflow-y-auto">
        <SheetHeader className="mb-4">
          <SheetTitle>Manual Import</SheetTitle>
        </SheetHeader>
        <div className="flex gap-2 mb-4">
          <Input value={scanPath} onChange={e => setScanPath(e.target.value)} className="bg-secondary border-0 font-mono text-sm" />
          <Button onClick={handleScan} disabled={scanning}>
            {scanning ? 'Scanning…' : 'Scan'}
          </Button>
        </div>
        {scanned && (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>File Path</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Year</TableHead>
                    <TableHead>Quality</TableHead>
                    <TableHead>Assign To</TableHead>
                    <TableHead>Mode</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fileRows.map(row => (
                    <TableRow key={row.id}>
                      <TableCell className="max-w-[200px] truncate font-mono text-xs text-muted-foreground" title={row.file_path}>{row.file_path}</TableCell>
                      <TableCell className="text-sm">{row.parsed_title}</TableCell>
                      <TableCell className="text-sm">{row.parsed_year}</TableCell>
                      <TableCell className="text-sm">{row.parsed_quality}</TableCell>
                      <TableCell className="min-w-[160px]">
                        <Select value={row.movie_id || ''} onValueChange={v => updateRow(row.id, 'movie_id', v || null)}>
                          <SelectTrigger className="h-7 text-xs bg-secondary border-0"><SelectValue placeholder="Assign…" /></SelectTrigger>
                          <SelectContent>
                            {movies.map(m => <SelectItem key={m.id} value={m.id}>{m.title} ({m.year})</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="min-w-[100px]">
                        <Select value={row.import_mode} onValueChange={v => updateRow(row.id, 'import_mode', v)}>
                          <SelectTrigger className="h-7 text-xs bg-secondary border-0"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Move">Move</SelectItem>
                            <SelectItem value="Copy">Copy</SelectItem>
                            <SelectItem value="Hardlink">Hardlink</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-[10px] ${row.status === 'Imported' ? 'text-green-400 border-green-500/30' : row.movie_id ? 'text-blue-400 border-blue-500/30' : ''}`}>
                          {row.movie_id && row.status === 'Pending' ? 'Matched' : row.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {row.status !== 'Imported' && (
                          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => importRow(row)}>Import</Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="mt-4 flex justify-end">
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
  const [deleteTarget, setDeleteTarget] = useState(null); // { type: 'movie'|'episode', item }
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

  const { data: rootFolders = [] } = useQuery({
    queryKey: ['root-folders'],
    queryFn: () => base44.entities.RootFolder.list(),
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
      media_title: movie.title, details: 'File deleted from Files page', success: true,
    });
    toast.success(`Deleted: ${movie.title}`);
    setDeleteTarget(null);
  };

  const handleDeleteEpisode = async () => {
    const ep = deleteTarget.item;
    await updateEpisodeMutation.mutateAsync({ id: ep.id, data: { has_file: false, file_path: null, status: 'missing' } });
    toast.success('Episode file removed');
    setDeleteTarget(null);
  };

  const handleRescanMovie = async (movie) => {
    await base44.entities.HistoryEvent.create({
      event_type: 'metadata_refreshed', media_type: 'movie', media_id: movie.id,
      media_title: movie.title, success: true,
    });
    toast.success(`Rescanning: ${movie.title}`);
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
                    <TableCell className="text-xs text-muted-foreground font-mono max-w-[200px] truncate">{movie.file_path}</TableCell>
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
                          <DropdownMenuItem onClick={() => { toast.success(`Renaming: ${movie.title}`); }}>
                            Rename
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => { toast.success(`Moving: ${movie.title}`); }}>
                            Move
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleRescanMovie(movie)}>
                            <RefreshCw className="w-4 h-4 mr-2" /> Rescan
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive" onClick={() => setDeleteTarget({ type: 'movie', item: movie })}>
                            <Trash2 className="w-4 h-4 mr-2" /> Delete File
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
                    <TableCell className="text-xs font-mono text-muted-foreground max-w-[160px] truncate">{ep.file_path || '—'}</TableCell>
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
                          <DropdownMenuItem onClick={() => toast.success('Rescanning episode...')}>
                            <RefreshCw className="w-4 h-4 mr-2" /> Rescan
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive" onClick={() => setDeleteTarget({ type: 'episode', item: ep })}>
                            <Trash2 className="w-4 h-4 mr-2" /> Delete File
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

      <ManualImportSheet open={manualImportOpen} onClose={() => setManualImportOpen(false)} movies={movies} />

      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete File</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the file reference from the library. The physical file on disk is not deleted.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={() => {
              if (deleteTarget?.type === 'movie') handleDeleteMovie();
              else handleDeleteEpisode();
            }}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}