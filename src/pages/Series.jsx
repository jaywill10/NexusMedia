import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import {
  Tv, Search, Plus, Grid3X3, List, MoreHorizontal,
  Eye, EyeOff, Trash2, ChevronDown, RefreshCw, Star, FolderOpen, Tag
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from '@/components/ui/alert-dialog';
import PageHeader from '@/components/shared/PageHeader';
import StatusBadge from '@/components/shared/StatusBadge';
import MediaCard from '@/components/shared/MediaCard';
import EmptyState from '@/components/shared/EmptyState';
import AddSeriesDialog from '@/components/series/AddSeriesDialog';
import { toast } from 'sonner';

export default function SeriesPage() {
  const [viewMode, setViewMode] = useState('grid');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('added');
  const [selectedIds, setSelectedIds] = useState([]);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [bulkDialog, setBulkDialog] = useState(null); // 'quality' | 'rootfolder' | 'tags' | 'delete'
  const [bulkValue, setBulkValue] = useState('');
  const [bulkTags, setBulkTags] = useState([]);
  const queryClient = useQueryClient();

  const { data: series = [] } = useQuery({
    queryKey: ['series', statusFilter],
    queryFn: async () => {
      if (statusFilter !== 'all') {
        return base44.entities.Series.filter({ series_status: statusFilter }, '-added_date', 500);
      }
      return base44.entities.Series.list('-added_date', 500);
    },
    initialData: [],
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

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Series.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['series'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Series.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['series'] }),
  });

  const filtered = series
    .filter(s => !search || s.title?.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      switch (sortBy) {
        case 'title_asc': return (a.title || '').localeCompare(b.title || '');
        case 'title_desc': return (b.title || '').localeCompare(a.title || '');
        case 'year_desc': return (b.year || 0) - (a.year || 0);
        case 'rating': return (b.rating || 0) - (a.rating || 0);
        case 'missing': return (b.episodes_missing || 0) - (a.episodes_missing || 0);
        default: return 0;
      }
    });

  const bulkUpdate = (data, label) => {
    selectedIds.forEach(id => updateMutation.mutate({ id, data }));
    toast.success(`${label} applied to ${selectedIds.length} series`);
    setSelectedIds([]);
    setBulkDialog(null);
  };

  const handleBulkSearch = async () => {
    for (const id of selectedIds) {
      const s = series.find(x => x.id === id);
      await base44.entities.HistoryEvent.create({
        event_type: 'searched', media_type: 'series', media_id: id,
        media_title: s?.title, success: true,
      });
    }
    toast.success(`Searching for ${selectedIds.length} series`);
    setSelectedIds([]);
  };

  const handleBulkRefresh = async () => {
    for (const id of selectedIds) {
      const s = series.find(x => x.id === id);
      await base44.entities.HistoryEvent.create({
        event_type: 'metadata_refreshed', media_type: 'series', media_id: id,
        media_title: s?.title, success: true,
      });
    }
    toast.success(`Refreshed metadata for ${selectedIds.length} series`);
    setSelectedIds([]);
  };

  const handleBulkDelete = () => {
    selectedIds.forEach(id => deleteMutation.mutate(id));
    toast.success(`Deleted ${selectedIds.length} series`);
    setSelectedIds([]);
    setBulkDialog(null);
  };

  const handleBulkAddTags = () => {
    selectedIds.forEach(id => {
      const s = series.find(x => x.id === id);
      const existing = s?.tags || [];
      const merged = [...new Set([...existing, ...bulkTags])];
      updateMutation.mutate({ id, data: { tags: merged } });
    });
    toast.success(`Tags added to ${selectedIds.length} series`);
    setSelectedIds([]);
    setBulkDialog(null);
    setBulkTags([]);
  };

  return (
    <div>
      <PageHeader title="Series" description={`${series.length} series in library`}>
        <Button onClick={() => setShowAddDialog(true)} size="sm" className="gap-1.5">
          <Plus className="w-4 h-4" /> Add Series
        </Button>
      </PageHeader>

      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Filter series..." className="pl-9 h-9 bg-secondary border-0" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36 h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="continuing">Continuing</SelectItem>
            <SelectItem value="ended">Ended</SelectItem>
            <SelectItem value="upcoming">Upcoming</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-44 h-9"><SelectValue placeholder="Sort" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="added">Recently Added</SelectItem>
            <SelectItem value="title_asc">Title A→Z</SelectItem>
            <SelectItem value="title_desc">Title Z→A</SelectItem>
            <SelectItem value="year_desc">Year (Newest)</SelectItem>
            <SelectItem value="rating">Rating (High→Low)</SelectItem>
            <SelectItem value="missing">Episodes Missing</SelectItem>
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
              <DropdownMenuItem onClick={() => bulkUpdate({ monitored: true }, 'Monitored')}>
                <Eye className="w-4 h-4 mr-2" /> Monitor All
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => bulkUpdate({ monitored: false }, 'Unmonitored')}>
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
              <DropdownMenuItem className="text-destructive" onClick={() => setBulkDialog('delete')}>
                <Trash2 className="w-4 h-4 mr-2" /> Delete Selected
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={Tv} title="No series in your library" description="Add series directly or discover and request them">
          <div className="flex gap-2">
            <Button onClick={() => setShowAddDialog(true)} size="sm" className="gap-1.5">
              <Plus className="w-4 h-4" /> Add Series
            </Button>
            <Button asChild variant="outline" size="sm" className="gap-1.5">
              <Link to="/discover">Discover Series</Link>
            </Button>
          </div>
        </EmptyState>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-3">
          {filtered.map(s => <MediaCard key={s.id} item={s} type="series" />)}
        </div>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={selectedIds.length === filtered.length && filtered.length > 0}
                    onCheckedChange={() => setSelectedIds(selectedIds.length === filtered.length ? [] : filtered.map(s => s.id))}
                  />
                </TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Network</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Seasons</TableHead>
                <TableHead>Episodes</TableHead>
                <TableHead>Monitored</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(s => {
                const pct = s.episodes_total > 0 ? Math.round((s.episodes_available / s.episodes_total) * 100) : 0;
                return (
                  <TableRow key={s.id} className="group">
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.includes(s.id)}
                        onCheckedChange={() => setSelectedIds(prev => prev.includes(s.id) ? prev.filter(i => i !== s.id) : [...prev, s.id])}
                      />
                    </TableCell>
                    <TableCell>
                      <Link to={`/series/${s.id}`} className="flex items-center gap-3 hover:text-primary">
                        <div className="w-8 h-12 rounded bg-secondary overflow-hidden shrink-0">
                          {s.poster_url && <img src={s.poster_url} alt="" className="w-full h-full object-cover" />}
                        </div>
                        <div>
                          <span className="font-medium text-sm">{s.title}</span>
                          {s.year && <p className="text-xs text-muted-foreground">{s.year}</p>}
                        </div>
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{s.network || '—'}</TableCell>
                    <TableCell><StatusBadge status={s.series_status || 'continuing'} /></TableCell>
                    <TableCell className="text-sm">{s.total_seasons || '—'}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress value={pct} className="w-16 h-1.5" />
                        <span className="text-xs text-muted-foreground">{s.episodes_available || 0}/{s.episodes_total || 0}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <button onClick={() => updateMutation.mutate({ id: s.id, data: { monitored: !s.monitored } })}>
                        {s.monitored ? <Eye className="w-4 h-4 text-primary" /> : <EyeOff className="w-4 h-4 text-muted-foreground" />}
                      </button>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem><Search className="w-4 h-4 mr-2" /> Search All</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => updateMutation.mutate({ id: s.id, data: { monitored: !s.monitored } })}>
                            {s.monitored ? <><EyeOff className="w-4 h-4 mr-2" /> Unmonitor</> : <><Eye className="w-4 h-4 mr-2" /> Monitor</>}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      {showAddDialog && <AddSeriesDialog onClose={() => setShowAddDialog(false)} />}

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

      {/* Bulk: Delete */}
      <AlertDialog open={bulkDialog === 'delete'} onOpenChange={() => setBulkDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedIds.length} Series?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently delete the selected series and all associated data.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={handleBulkDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}