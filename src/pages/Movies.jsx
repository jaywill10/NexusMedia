import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import {
  Film, Search, Plus, Grid3X3, List, MoreHorizontal,
  Eye, EyeOff, RefreshCw, Trash2, ChevronDown, Star, FolderOpen, Tag
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import PageHeader from '@/components/shared/PageHeader';
import StatusBadge from '@/components/shared/StatusBadge';
import MediaCard from '@/components/shared/MediaCard';
import EmptyState from '@/components/shared/EmptyState';
import AddMovieDialog from '@/components/movies/AddMovieDialog';
import { toast } from 'sonner';

export default function Movies() {
  const [viewMode, setViewMode] = useState('grid');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [monitorFilter, setMonitorFilter] = useState('all');
  const [sortBy, setSortBy] = useState('added');
  const [selectedIds, setSelectedIds] = useState([]);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [bulkDialog, setBulkDialog] = useState(null);
  const [bulkValue, setBulkValue] = useState('');
  const [bulkTags, setBulkTags] = useState([]);
  const queryClient = useQueryClient();

  const { data: movies = [], isLoading } = useQuery({
    queryKey: ['movies', statusFilter, monitorFilter],
    queryFn: async () => {
      const filter = {};
      if (statusFilter !== 'all') filter.library_status = statusFilter;
      if (monitorFilter === 'monitored') filter.monitored = true;
      if (monitorFilter === 'unmonitored') filter.monitored = false;
      return Object.keys(filter).length > 0
        ? base44.entities.Movie.filter(filter, '-added_date', 500)
        : base44.entities.Movie.list('-added_date', 500);
    },
    initialData: [],
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Movie.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['movies'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Movie.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['movies'] }),
  });

  const { data: qualityProfiles = [] } = useQuery({
    queryKey: ['quality-profiles'],
    queryFn: () => base44.entities.QualityProfile.list(),
    initialData: [],
  });

  const { data: rootFolders = [] } = useQuery({
    queryKey: ['root-folders'],
    queryFn: () => base44.entities.RootFolder.list(),
    initialData: [],
  });

  const { data: tags = [] } = useQuery({
    queryKey: ['tags'],
    queryFn: () => base44.entities.Tag.list(),
    initialData: [],
  });

  const bulkUpdate = (data, label) => {
    selectedIds.forEach(id => updateMutation.mutate({ id, data }));
    toast.success(`${label} applied to ${selectedIds.length} movies`);
    setSelectedIds([]);
    setBulkDialog(null);
  };

  const handleBulkSearch = async () => {
    const filtered_sel = filtered.filter(m => selectedIds.includes(m.id));
    for (const movie of filtered_sel) {
      await base44.entities.HistoryEvent.create({
        event_type: 'searched', media_type: 'movie', media_id: movie.id, media_title: movie.title, success: true,
      });
    }
    toast.success(`Searching for ${selectedIds.length} movies`);
    setSelectedIds([]);
  };

  const handleBulkRefresh = async () => {
    const filtered_sel = filtered.filter(m => selectedIds.includes(m.id));
    for (const movie of filtered_sel) {
      await base44.entities.HistoryEvent.create({
        event_type: 'metadata_refreshed', media_type: 'movie', media_id: movie.id, media_title: movie.title, success: true,
      });
    }
    toast.success(`Refreshed metadata for ${selectedIds.length} movies`);
    setSelectedIds([]);
  };

  const handleBulkAddTags = () => {
    selectedIds.forEach(id => {
      const movie = filtered.find(m => m.id === id);
      const existing = movie?.tags || [];
      const merged = [...new Set([...existing, ...bulkTags])];
      updateMutation.mutate({ id, data: { tags: merged } });
    });
    toast.success(`Tags added to ${selectedIds.length} movies`);
    setSelectedIds([]);
    setBulkDialog(null);
    setBulkTags([]);
  };

  const filtered = movies
    .filter(m => !search || m.title?.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      switch (sortBy) {
        case 'title_asc': return (a.title || '').localeCompare(b.title || '');
        case 'title_desc': return (b.title || '').localeCompare(a.title || '');
        case 'year_desc': return (b.year || 0) - (a.year || 0);
        case 'year_asc': return (a.year || 0) - (b.year || 0);
        case 'rating': return (b.rating || 0) - (a.rating || 0);
        case 'size': return (b.file_size || 0) - (a.file_size || 0);
        default: return 0; // 'added' — already sorted by API
      }
    });

  const toggleMonitor = (movie) => {
    updateMutation.mutate(
      { id: movie.id, data: { monitored: !movie.monitored } },
      { onSuccess: () => toast.success(`${movie.title} ${movie.monitored ? 'unmonitored' : 'monitored'}`) }
    );
  };

  return (
    <div>
      <PageHeader title="Movies" description={`${movies.length} movies in library`}>
        <Button onClick={() => setShowAddDialog(true)} size="sm" className="gap-1.5">
          <Plus className="w-4 h-4" /> Add Movie
        </Button>
      </PageHeader>

      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Filter movies..." className="pl-9 h-9 bg-secondary border-0" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36 h-9"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="available">Available</SelectItem>
            <SelectItem value="missing">Missing</SelectItem>
            <SelectItem value="downloading">Downloading</SelectItem>
            <SelectItem value="cutoff_unmet">Cutoff Unmet</SelectItem>
          </SelectContent>
        </Select>
        <Select value={monitorFilter} onValueChange={setMonitorFilter}>
          <SelectTrigger className="w-36 h-9"><SelectValue placeholder="Monitor" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="monitored">Monitored</SelectItem>
            <SelectItem value="unmonitored">Unmonitored</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-44 h-9"><SelectValue placeholder="Sort" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="added">Recently Added</SelectItem>
            <SelectItem value="title_asc">Title A→Z</SelectItem>
            <SelectItem value="title_desc">Title Z→A</SelectItem>
            <SelectItem value="year_desc">Year (Newest)</SelectItem>
            <SelectItem value="year_asc">Year (Oldest)</SelectItem>
            <SelectItem value="rating">Rating (High→Low)</SelectItem>
            <SelectItem value="size">File Size (Large→Small)</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex border border-border rounded-md">
          <Button variant={viewMode === 'grid' ? 'secondary' : 'ghost'} size="icon" className="h-9 w-9" onClick={() => setViewMode('grid')}>
            <Grid3X3 className="w-4 h-4" />
          </Button>
          <Button variant={viewMode === 'list' ? 'secondary' : 'ghost'} size="icon" className="h-9 w-9" onClick={() => setViewMode('list')}>
            <List className="w-4 h-4" />
          </Button>
        </div>

        {selectedIds.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline" className="gap-1">
                Bulk ({selectedIds.length}) <ChevronDown className="w-3 h-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => { selectedIds.forEach(id => updateMutation.mutate({ id, data: { monitored: true } })); setSelectedIds([]); }}>
                <Eye className="w-4 h-4 mr-2" /> Monitor All
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { selectedIds.forEach(id => updateMutation.mutate({ id, data: { monitored: false } })); setSelectedIds([]); }}>
                <EyeOff className="w-4 h-4 mr-2" /> Unmonitor All
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleBulkSearch}>
                <Search className="w-4 h-4 mr-2" /> Search All
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleBulkRefresh}>
                <RefreshCw className="w-4 h-4 mr-2" /> Refresh Metadata
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => { setBulkValue(''); setBulkDialog('quality'); }}>
                <Star className="w-4 h-4 mr-2" /> Change Quality Profile
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { setBulkValue(''); setBulkDialog('rootfolder'); }}>
                <FolderOpen className="w-4 h-4 mr-2" /> Change Root Folder
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => { setBulkTags([]); setBulkDialog('tags'); }}>
                <Tag className="w-4 h-4 mr-2" /> Add Tags
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive" onClick={() => { selectedIds.forEach(id => deleteMutation.mutate(id)); setSelectedIds([]); }}>
                <Trash2 className="w-4 h-4 mr-2" /> Delete Selected
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Content */}
      {filtered.length === 0 ? (
        <EmptyState icon={Film} title="No movies in your library" description="Add movies directly or discover and request them">
          <div className="flex gap-2">
            <Button onClick={() => setShowAddDialog(true)} size="sm" className="gap-1.5">
              <Plus className="w-4 h-4" /> Add Movie
            </Button>
            <Button asChild variant="outline" size="sm" className="gap-1.5">
              <Link to="/discover">Discover Movies</Link>
            </Button>
          </div>
        </EmptyState>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-3">
          {filtered.map(movie => (
            <MediaCard key={movie.id} item={movie} type="movie" />
          ))}
        </div>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={selectedIds.length === filtered.length && filtered.length > 0}
                    onCheckedChange={() => setSelectedIds(selectedIds.length === filtered.length ? [] : filtered.map(m => m.id))}
                  />
                </TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Year</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Quality</TableHead>
                <TableHead>Monitored</TableHead>
                <TableHead>Size</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(movie => (
                <TableRow key={movie.id} className="group">
                  <TableCell>
                    <Checkbox checked={selectedIds.includes(movie.id)} onCheckedChange={() => {
                      setSelectedIds(prev => prev.includes(movie.id) ? prev.filter(i => i !== movie.id) : [...prev, movie.id]);
                    }} />
                  </TableCell>
                  <TableCell>
                    <Link to={`/movies/${movie.id}`} className="flex items-center gap-3 hover:text-primary">
                      <div className="w-8 h-12 rounded bg-secondary overflow-hidden shrink-0">
                        {movie.poster_url && <img src={movie.poster_url} alt="" className="w-full h-full object-cover" />}
                      </div>
                      <span className="font-medium text-sm">{movie.title}</span>
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{movie.year || '—'}</TableCell>
                  <TableCell><StatusBadge status={movie.library_status || 'missing'} /></TableCell>
                  <TableCell className="text-sm text-muted-foreground">{movie.quality || '—'}</TableCell>
                  <TableCell>
                    <button onClick={() => toggleMonitor(movie)} className="text-muted-foreground hover:text-foreground">
                      {movie.monitored ? <Eye className="w-4 h-4 text-primary" /> : <EyeOff className="w-4 h-4" />}
                    </button>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {movie.file_size ? `${(movie.file_size / 1073741824).toFixed(1)} GB` : '—'}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem><Search className="w-4 h-4 mr-2" /> Search</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => toggleMonitor(movie)}>
                          {movie.monitored ? <><EyeOff className="w-4 h-4 mr-2" /> Unmonitor</> : <><Eye className="w-4 h-4 mr-2" /> Monitor</>}
                        </DropdownMenuItem>
                        <DropdownMenuItem><RefreshCw className="w-4 h-4 mr-2" /> Refresh</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive" onClick={() => deleteMutation.mutate(movie.id)}>
                          <Trash2 className="w-4 h-4 mr-2" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {showAddDialog && <AddMovieDialog onClose={() => setShowAddDialog(false)} />}

      {/* Bulk: Quality Profile */}
      <Dialog open={bulkDialog === 'quality'} onOpenChange={() => setBulkDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Change Quality Profile</DialogTitle></DialogHeader>
          <Select value={bulkValue} onValueChange={setBulkValue}>
            <SelectTrigger><SelectValue placeholder="Select profile..." /></SelectTrigger>
            <SelectContent>
              {qualityProfiles.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkDialog(null)}>Cancel</Button>
            <Button onClick={() => bulkValue && bulkUpdate({ quality_profile_id: bulkValue }, 'Quality profile')}>Apply</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk: Root Folder */}
      <Dialog open={bulkDialog === 'rootfolder'} onOpenChange={() => setBulkDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Change Root Folder</DialogTitle></DialogHeader>
          <Select value={bulkValue} onValueChange={setBulkValue}>
            <SelectTrigger><SelectValue placeholder="Select folder..." /></SelectTrigger>
            <SelectContent>
              {rootFolders.map(f => <SelectItem key={f.id} value={f.id}>{f.name} — {f.path}</SelectItem>)}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkDialog(null)}>Cancel</Button>
            <Button onClick={() => bulkValue && bulkUpdate({ root_folder_id: bulkValue }, 'Root folder')}>Apply</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk: Tags */}
      <Dialog open={bulkDialog === 'tags'} onOpenChange={() => setBulkDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add Tags</DialogTitle></DialogHeader>
          <div className="flex flex-wrap gap-2">
            {tags.map(tag => (
              <button
                key={tag.id}
                onClick={() => setBulkTags(prev => prev.includes(tag.name) ? prev.filter(t => t !== tag.name) : [...prev, tag.name])}
                className={`px-3 py-1 rounded-full text-xs border transition-colors ${bulkTags.includes(tag.name) ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:border-primary'}`}
              >
                {tag.name}
              </button>
            ))}
            {tags.length === 0 && <p className="text-sm text-muted-foreground">No tags defined. Create tags in Settings.</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkDialog(null)}>Cancel</Button>
            <Button onClick={handleBulkAddTags}>Add Tags</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}