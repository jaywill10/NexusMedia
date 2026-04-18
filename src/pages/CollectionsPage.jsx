import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import {
  Layers, Plus, TrendingUp, Star, Heart, Play, RefreshCw, Trash2,
  ToggleLeft, ToggleRight, Film, X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
import { toast } from 'sonner';

const STATIC_LISTS = [
  { id: 'trakt-popular', name: 'Trakt Popular', icon: TrendingUp, color: 'text-red-400', count: 250, lastSync: '2 hours ago' },
  { id: 'imdb-top250', name: 'IMDB Top 250', icon: Star, color: 'text-yellow-400', count: 250, lastSync: '1 day ago' },
  { id: 'letterboxd', name: 'Letterboxd Watchlist', icon: Heart, color: 'text-pink-400', count: 87, lastSync: '3 hours ago' },
  { id: 'plex', name: 'Plex Watchlist', icon: Play, color: 'text-orange-400', count: 34, lastSync: '30 min ago' },
];

const LIST_TYPES = ['Trakt', 'IMDB', 'Letterboxd', 'Custom RSS'];

function CollectionCard({ name, movies, onMonitorAll }) {
  const [expanded, setExpanded] = useState(false);
  const inLibrary = movies.filter(m => m.library_status === 'available' || m.library_status === 'cutoff_met').length;

  return (
    <Card className="overflow-hidden hover:border-primary/30 transition-colors">
      <div className="p-4 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        {/* Poster strip */}
        <div className="flex gap-1 mb-3 h-20 overflow-hidden rounded-md">
          {movies.slice(0, 4).map((m, i) => (
            <div key={m.id} className="flex-1 bg-secondary overflow-hidden">
              {m.poster_url
                ? <img src={m.poster_url} alt={m.title} className="w-full h-full object-cover" />
                : <div className="w-full h-full flex items-center justify-center"><Film className="w-4 h-4 text-muted-foreground" /></div>
              }
            </div>
          ))}
          {movies.length < 4 && Array.from({ length: 4 - movies.length }).map((_, i) => (
            <div key={`empty-${i}`} className="flex-1 bg-secondary/50 rounded" />
          ))}
        </div>
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm truncate">{name}</p>
            <Badge variant="secondary" className="text-[10px] mt-1">{inLibrary} / {movies.length} in library</Badge>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="text-xs h-7 shrink-0"
            onClick={e => { e.stopPropagation(); onMonitorAll(); }}
          >
            Monitor All
          </Button>
        </div>
      </div>
      {expanded && (
        <div className="border-t border-border px-4 py-2 space-y-1">
          {movies.map(m => (
            <Link key={m.id} to={`/movies/${m.id}`} className="flex items-center gap-2 py-1 hover:text-primary text-sm transition-colors">
              <div className="w-6 h-9 bg-secondary rounded overflow-hidden shrink-0">
                {m.poster_url && <img src={m.poster_url} alt="" className="w-full h-full object-cover" />}
              </div>
              <span className="truncate flex-1">{m.title}</span>
              <span className="text-xs text-muted-foreground">{m.year}</span>
              {(m.library_status === 'available' || m.library_status === 'cutoff_met') && (
                <div className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0" />
              )}
            </Link>
          ))}
        </div>
      )}
    </Card>
  );
}

function ListsTab() {
  const queryClient = useQueryClient();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [enabledIds, setEnabledIds] = useState(STATIC_LISTS.map(l => l.id));
  const [form, setForm] = useState({ name: '', type: 'Trakt', url: '', auto_add: false });

  const { data: settingsRecord } = useQuery({
    queryKey: ['app-settings-lists'],
    queryFn: async () => {
      const list = await base44.entities.AppSettings.filter({ key: 'custom_lists' });
      return list[0] || null;
    },
  });

  const customLists = settingsRecord?.value ? JSON.parse(settingsRecord.value) : [];

  const saveListsMutation = useMutation({
    mutationFn: async (lists) => {
      const payload = { key: 'custom_lists', value: JSON.stringify(lists) };
      if (settingsRecord?.id) return base44.entities.AppSettings.update(settingsRecord.id, payload);
      return base44.entities.AppSettings.create(payload);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['app-settings-lists'] }),
  });

  const handleAddList = () => {
    if (!form.name || !form.url) { toast.error('Name and URL/ID required'); return; }
    const newList = { ...form, id: Date.now().toString(), lastSync: 'Never', count: 0, enabled: true };
    saveListsMutation.mutate([...customLists, newList]);
    toast.success(`List "${form.name}" added`);
    setForm({ name: '', type: 'Trakt', url: '', auto_add: false });
    setShowAddDialog(false);
  };

  const handleRemoveList = (id) => {
    saveListsMutation.mutate(customLists.filter(l => l.id !== id));
    toast.success('List removed');
  };

  const allLists = [
    ...STATIC_LISTS.map(l => ({ ...l, isStatic: true })),
    ...customLists.map(l => ({ ...l, icon: TrendingUp, color: 'text-blue-400', isStatic: false })),
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-muted-foreground">{allLists.length} list(s)</p>
        <Button size="sm" onClick={() => setShowAddDialog(true)} className="gap-1.5">
          <Plus className="w-4 h-4" /> Add List
        </Button>
      </div>

      {allLists.length === 0 ? (
        <EmptyState icon={Layers} title="No lists configured" description="Add lists to automatically discover and import media">
          <Button size="sm" onClick={() => setShowAddDialog(true)} className="gap-1.5">
            <Plus className="w-4 h-4" /> Add Your First List
          </Button>
        </EmptyState>
      ) : (
        <div className="space-y-2">
          {allLists.map(list => {
            const Icon = list.icon;
            const isEnabled = enabledIds.includes(list.id) || list.enabled;
            return (
              <Card key={list.id} className="p-4 flex items-center gap-4">
                <div className={`p-2 rounded-lg bg-secondary shrink-0 ${list.color}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{list.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {list.count} items · Last synced {list.lastSync}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-1.5 text-xs h-7"
                  onClick={() => toast.success(`Syncing ${list.name}...`)}
                >
                  <RefreshCw className="w-3 h-3" /> Sync
                </Button>
                <Switch
                  checked={isEnabled}
                  onCheckedChange={(v) => {
                    if (list.isStatic) {
                      setEnabledIds(prev => v ? [...prev, list.id] : prev.filter(i => i !== list.id));
                    }
                  }}
                />
                {!list.isStatic && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => handleRemoveList(list.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Add List</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs">List Type</Label>
              <Select value={form.type} onValueChange={v => setForm({ ...form, type: v })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{LIST_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Name</Label>
              <Input className="mt-1" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="My List" />
            </div>
            <div>
              <Label className="text-xs">URL or ID</Label>
              <Input className="mt-1 font-mono text-xs" value={form.url} onChange={e => setForm({ ...form, url: e.target.value })} placeholder="https://trakt.tv/lists/..." />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm">Auto-Add</Label>
                <p className="text-xs text-muted-foreground">Automatically add approved items to library</p>
              </div>
              <Switch checked={form.auto_add} onCheckedChange={v => setForm({ ...form, auto_add: v })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>Cancel</Button>
            <Button onClick={handleAddList}>Add List</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function CollectionsPage() {
  const queryClient = useQueryClient();

  const { data: movies = [] } = useQuery({
    queryKey: ['movies'],
    queryFn: () => base44.entities.Movie.list('-added_date', 500),
    initialData: [],
  });

  const monitorAllMutation = useMutation({
    mutationFn: async (movieIds) => {
      await Promise.all(movieIds.map(id => base44.entities.Movie.update(id, { monitored: true })));
    },
    onSuccess: (_, movieIds) => {
      queryClient.invalidateQueries({ queryKey: ['movies'] });
      toast.success(`Monitoring all ${movieIds.length} movies in collection`);
    },
  });

  // Group movies by collection_name
  const collections = movies
    .filter(m => m.collection_name)
    .reduce((acc, m) => {
      const key = m.collection_name;
      if (!acc[key]) acc[key] = [];
      acc[key].push(m);
      return acc;
    }, {});

  const handleMonitorAll = (collectionMovies) => {
    monitorAllMutation.mutate(collectionMovies.map(m => m.id));
  };

  return (
    <div>
      <PageHeader title="Collections & Lists" description="Manage movie collections and auto-import lists" />

      <Tabs defaultValue="collections">
        <TabsList className="bg-secondary mb-6">
          <TabsTrigger value="collections">Collections</TabsTrigger>
          <TabsTrigger value="lists">Lists</TabsTrigger>
        </TabsList>

        <TabsContent value="collections">
          {Object.keys(collections).length === 0 ? (
            <EmptyState
              icon={Layers}
              title="No collections"
              description="Collections appear automatically when movies with collection data are added to your library"
            >
              <Button asChild variant="outline" size="sm">
                <Link to="/movies">Go to Movies</Link>
              </Button>
            </EmptyState>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {Object.entries(collections).map(([name, collMovies]) => (
                <CollectionCard
                  key={name}
                  name={name}
                  movies={collMovies}
                  onMonitorAll={() => handleMonitorAll(collMovies)}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="lists">
          <ListsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}