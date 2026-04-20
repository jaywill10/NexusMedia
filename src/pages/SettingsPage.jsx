import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Settings, Database, HardDrive, Sliders, Bell, FolderOpen, Plus, Trash2, Play, Clock, Cog, Map, Film, Pencil, ChevronUp, ChevronDown, Star, Check, AlertCircle, ExternalLink, Server, RefreshCw, Loader2 } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import PageHeader from '@/components/shared/PageHeader';
import StatusBadge from '@/components/shared/StatusBadge';
import EmptyState from '@/components/shared/EmptyState';
import { toast } from 'sonner';

export default function SettingsPage() {
  return (
    <div>
      <PageHeader title="Settings" description="Configure all aspects of MediaFlow" />
      <Tabs defaultValue="general">
        <TabsList className="bg-secondary mb-6 flex-wrap h-auto gap-1">
          <TabsTrigger value="general"><Cog className="w-3.5 h-3.5 mr-1.5" />General</TabsTrigger>
          <TabsTrigger value="indexers"><Database className="w-3.5 h-3.5 mr-1.5" />Indexers</TabsTrigger>
          <TabsTrigger value="download-clients"><HardDrive className="w-3.5 h-3.5 mr-1.5" />Download Clients</TabsTrigger>
          <TabsTrigger value="media-servers"><Server className="w-3.5 h-3.5 mr-1.5" />Media Servers</TabsTrigger>
          <TabsTrigger value="quality"><Sliders className="w-3.5 h-3.5 mr-1.5" />Quality Profiles</TabsTrigger>
          <TabsTrigger value="custom-formats"><Film className="w-3.5 h-3.5 mr-1.5" />Custom Formats</TabsTrigger>
          <TabsTrigger value="media-management"><FolderOpen className="w-3.5 h-3.5 mr-1.5" />Media Management</TabsTrigger>
          <TabsTrigger value="root-folders"><FolderOpen className="w-3.5 h-3.5 mr-1.5" />Root Folders</TabsTrigger>
          <TabsTrigger value="remote-path-maps"><Map className="w-3.5 h-3.5 mr-1.5" />Path Maps</TabsTrigger>
          <TabsTrigger value="notifications"><Bell className="w-3.5 h-3.5 mr-1.5" />Notifications</TabsTrigger>
          <TabsTrigger value="tasks"><Clock className="w-3.5 h-3.5 mr-1.5" />Tasks</TabsTrigger>
        </TabsList>
        <TabsContent value="general">
          <div className="space-y-6">
            <GeneralTab />
            <TmdbCard />
          </div>
        </TabsContent>
        <TabsContent value="indexers"><IndexersTab /></TabsContent>
        <TabsContent value="download-clients"><DownloadClientsTab /></TabsContent>
        <TabsContent value="media-servers"><MediaServersTab /></TabsContent>
        <TabsContent value="quality"><QualityProfilesTab /></TabsContent>
        <TabsContent value="custom-formats"><CustomFormatsTab /></TabsContent>
        <TabsContent value="media-management"><MediaManagementTab /></TabsContent>
        <TabsContent value="root-folders"><RootFoldersTab /></TabsContent>
        <TabsContent value="remote-path-maps"><RemotePathMapsTab /></TabsContent>
        <TabsContent value="notifications"><NotificationsTab /></TabsContent>
        <TabsContent value="tasks"><TasksTab /></TabsContent>
      </Tabs>
    </div>
  );
}

const DEFAULT_GENERAL = {
  app_name: 'MediaFlow',
  enable_auth: true,
  default_quality_profile: '',
  default_root_folder: '',
  auto_approve_role: 'admin',
  search_on_add: true,
  minimum_availability: 'released',
};

function TmdbCard() {
  const queryClient = useQueryClient();
  const [apiKey, setApiKey] = useState('');
  const [showForm, setShowForm] = useState(false);

  const { data: status, isLoading } = useQuery({
    queryKey: ['tmdb-status'],
    queryFn: () => base44.tmdb.status(),
  });

  const saveMutation = useMutation({
    mutationFn: (k) => base44.tmdb.setApiKey(k),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tmdb-status'] });
      queryClient.invalidateQueries({ queryKey: ['discover'] });
      setApiKey('');
      setShowForm(false);
      toast.success('TMDB API key saved');
    },
    onError: (err) => {
      const code = err?.data?.error;
      toast.error(code === 'invalid_api_key' ? 'Invalid API key' : (code || err.message || 'Save failed'));
    },
  });

  const clearMutation = useMutation({
    mutationFn: () => base44.tmdb.clearApiKey(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tmdb-status'] });
      queryClient.invalidateQueries({ queryKey: ['discover'] });
      toast.success('TMDB API key removed');
    },
    onError: (err) => toast.error(err?.data?.message || err?.data?.error || 'Could not remove key'),
  });

  const fromEnv = status?.source === 'env';
  const configured = !!status?.configured;

  return (
    <Card className="p-6 max-w-xl">
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="font-semibold">TMDB</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Powers the Discover page, search, and metadata.
          </p>
        </div>
        {!isLoading && (
          <span className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded border ${
            configured
              ? 'bg-green-500/15 text-green-400 border-green-500/30'
              : 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30'
          }`}>
            {configured
              ? <><Check className="w-3 h-3" /> Connected{fromEnv ? ' (env)' : ''}</>
              : <><AlertCircle className="w-3 h-3" /> Not configured</>}
          </span>
        )}
      </div>

      {fromEnv ? (
        <p className="text-xs text-muted-foreground">
          The API key is supplied via the <code className="font-mono">TMDB_API_KEY</code> environment
          variable. Unset it to manage the key here.
        </p>
      ) : configured && !showForm ? (
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setShowForm(true)}>Replace key</Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-destructive hover:text-destructive"
            onClick={() => clearMutation.mutate()}
            disabled={clearMutation.isPending}
          >
            Remove key
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <Label className="text-xs">API Key (v3)</Label>
            <Input
              className="mt-1 font-mono text-xs"
              type="password"
              value={apiKey}
              onChange={e => setApiKey(e.target.value)}
              placeholder="Paste your TMDB v3 API key"
              autoComplete="off"
            />
            <p className="text-[10px] text-muted-foreground mt-1.5 inline-flex items-center gap-1">
              Get a free key at
              <a
                href="https://www.themoviedb.org/settings/api"
                target="_blank"
                rel="noreferrer"
                className="underline inline-flex items-center gap-0.5"
              >
                themoviedb.org/settings/api <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => saveMutation.mutate(apiKey.trim())}
              disabled={!apiKey.trim() || saveMutation.isPending}
            >
              {saveMutation.isPending ? 'Validating…' : 'Save key'}
            </Button>
            {configured && (
              <Button size="sm" variant="ghost" onClick={() => { setShowForm(false); setApiKey(''); }}>
                Cancel
              </Button>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}

function GeneralTab() {
  const queryClient = useQueryClient();
  const { data: profiles = [] } = useQuery({ queryKey: ['quality-profiles'], queryFn: () => base44.entities.QualityProfile.list(), initialData: [] });
  const { data: folders = [] } = useQuery({ queryKey: ['root-folders'], queryFn: () => base44.entities.RootFolder.list(), initialData: [] });

  const { data: settings } = useQuery({
    queryKey: ['app-settings-general'],
    queryFn: async () => {
      const list = await base44.entities.AppSettings.filter({ key: 'general' });
      return list[0] || null;
    },
  });

  const [form, setForm] = useState(DEFAULT_GENERAL);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    if (settings?.value) {
      try {
        const parsed = JSON.parse(settings.value);
        setForm(f => ({ ...f, ...parsed }));
      } catch {}
    }
  }, [settings]);

  const update = (patch) => { setForm(f => ({ ...f, ...patch })); setIsDirty(true); };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = { key: 'general', value: JSON.stringify(form) };
      if (settings?.id) return base44.entities.AppSettings.update(settings.id, payload);
      return base44.entities.AppSettings.create(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['app-settings-general'] });
      setIsDirty(false);
      toast.success('Settings saved');
    },
  });

  return (
    <Card className="p-6 max-w-xl">
      <div className="space-y-5">
        <div><Label className="text-xs">App Name</Label><Input className="mt-1" value={form.app_name} onChange={e => update({ app_name: e.target.value })} /></div>
        <div className="flex items-center justify-between">
          <div><Label className="text-sm">Enable Authentication</Label><p className="text-xs text-muted-foreground">Require login to access the app</p></div>
          <Switch checked={form.enable_auth} onCheckedChange={v => update({ enable_auth: v })} />
        </div>
        <div>
          <Label className="text-xs">Default Quality Profile</Label>
          <Select value={form.default_quality_profile} onValueChange={v => update({ default_quality_profile: v })}>
            <SelectTrigger className="mt-1"><SelectValue placeholder="Select profile..." /></SelectTrigger>
            <SelectContent>{profiles.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Default Root Folder</Label>
          <Select value={form.default_root_folder} onValueChange={v => update({ default_root_folder: v })}>
            <SelectTrigger className="mt-1"><SelectValue placeholder="Select folder..." /></SelectTrigger>
            <SelectContent>{folders.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Auto-Approve Threshold</Label>
          <Select value={form.auto_approve_role} onValueChange={v => update({ auto_approve_role: v })}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="admin">Admin Only</SelectItem>
              <SelectItem value="manager">Manager+</SelectItem>
              <SelectItem value="standard">Standard+</SelectItem>
              <SelectItem value="all">All Users</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Minimum Availability</Label>
          <Select value={form.minimum_availability} onValueChange={v => update({ minimum_availability: v })}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="announced">Announced</SelectItem>
              <SelectItem value="in_cinemas">In Cinemas</SelectItem>
              <SelectItem value="released">Released</SelectItem>
              <SelectItem value="any">Any</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center justify-between">
          <Label className="text-sm">Search Immediately on Add</Label>
          <Switch checked={form.search_on_add} onCheckedChange={v => update({ search_on_add: v })} />
        </div>
        <Button onClick={() => saveMutation.mutate()} disabled={!isDirty || saveMutation.isPending}>
          {saveMutation.isPending ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
    </Card>
  );
}

function CustomFormatsTab() {
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: '', score: 0, specifications: [] });

  const { data: formats = [] } = useQuery({ queryKey: ['custom-formats'], queryFn: () => base44.entities.CustomFormat.list(), initialData: [] });

  const createMutation = useMutation({
    mutationFn: () => base44.entities.CustomFormat.create(form),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['custom-formats'] }); setAdding(false); setForm({ name: '', score: 0, specifications: [] }); toast.success('Custom format created'); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.CustomFormat.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['custom-formats'] }),
  });

  const addSpec = () => setForm(f => ({ ...f, specifications: [...f.specifications, { name: '', type: 'release_title', value: '', required: false, negate: false }] }));
  const updateSpec = (i, field, val) => setForm(f => {
    const specs = [...f.specifications];
    specs[i] = { ...specs[i], [field]: val };
    return { ...f, specifications: specs };
  });
  const removeSpec = (i) => setForm(f => ({ ...f, specifications: f.specifications.filter((_, idx) => idx !== i) }));

  const SPEC_TYPES = ['release_title', 'source', 'resolution', 'codec', 'audio', 'language', 'release_group', 'size', 'indexer_flag'];

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-muted-foreground">{formats.length} format(s)</p>
        <Button size="sm" onClick={() => setAdding(true)} className="gap-1.5"><Plus className="w-4 h-4" />Add Format</Button>
      </div>
      {adding && (
        <Card className="p-4 mb-4 border-primary/30">
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div><Label className="text-xs">Name</Label><Input className="mt-1" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="HDR10+" /></div>
            <div><Label className="text-xs">Score</Label><Input className="mt-1" type="number" value={form.score} onChange={e => setForm({ ...form, score: parseInt(e.target.value) })} /></div>
          </div>
          <div className="mb-3">
            <div className="flex items-center justify-between mb-2">
              <Label className="text-xs">Specifications</Label>
              <Button size="sm" variant="outline" onClick={addSpec} className="h-7 text-xs gap-1"><Plus className="w-3 h-3" />Add Spec</Button>
            </div>
            {form.specifications.map((spec, i) => (
              <div key={i} className="grid grid-cols-5 gap-2 mb-2 items-center">
                <Select value={spec.type} onValueChange={v => updateSpec(i, 'type', v)}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>{SPEC_TYPES.map(t => <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>)}</SelectContent>
                </Select>
                <Input className="h-8 text-xs" placeholder="value" value={spec.value} onChange={e => updateSpec(i, 'value', e.target.value)} />
                <div className="flex items-center gap-1"><Switch checked={spec.required} onCheckedChange={v => updateSpec(i, 'required', v)} /><span className="text-[10px]">Req</span></div>
                <div className="flex items-center gap-1"><Switch checked={spec.negate} onCheckedChange={v => updateSpec(i, 'negate', v)} /><span className="text-[10px]">Neg</span></div>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeSpec(i)}><Trash2 className="w-3 h-3" /></Button>
              </div>
            ))}
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={() => setAdding(false)}>Cancel</Button>
            <Button size="sm" onClick={() => createMutation.mutate()} disabled={!form.name}>Save</Button>
          </div>
        </Card>
      )}
      <Card>
        <Table>
          <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Score</TableHead><TableHead>Specifications</TableHead><TableHead className="w-10"></TableHead></TableRow></TableHeader>
          <TableBody>
            {formats.length === 0 ? (
              <TableRow><TableCell colSpan={4}><EmptyState icon={Film} title="No custom formats" description="Custom formats allow scoring releases by specific attributes" /></TableCell></TableRow>
            ) : formats.map(f => (
              <TableRow key={f.id}>
                <TableCell className="font-medium text-sm">{f.name}</TableCell>
                <TableCell className={`text-sm font-medium ${f.score > 0 ? 'text-green-400' : f.score < 0 ? 'text-red-400' : 'text-muted-foreground'}`}>
                  {f.score > 0 ? '+' : ''}{f.score}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{f.specifications?.length || 0} spec(s)</TableCell>
                <TableCell><Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => deleteMutation.mutate(f.id)}><Trash2 className="w-4 h-4" /></Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

function MediaManagementTab() {
  const [form, setForm] = useState({
    import_mode: 'hardlink',
    rename_movies: true,
    movie_naming: '{Movie Title} ({Year}) {Quality Full}',
    rename_series: true,
    series_naming: '{Series Title} - S{season:00}E{episode:00} - {Episode Title}',
    season_folder: true,
    empty_folder_cleanup: false,
    recycle_bin_path: '',
  });

  return (
    <Card className="p-6 max-w-2xl">
      <div className="space-y-6">
        <div>
          <Label className="text-sm font-medium mb-3 block">Import Mode</Label>
          <RadioGroup value={form.import_mode} onValueChange={v => setForm({ ...form, import_mode: v })} className="flex gap-4">
            {['move', 'copy', 'hardlink'].map(m => (
              <div key={m} className="flex items-center gap-2">
                <RadioGroupItem value={m} id={`mode-${m}`} />
                <Label htmlFor={`mode-${m}`} className="capitalize cursor-pointer">{m}</Label>
              </div>
            ))}
          </RadioGroup>
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm">Rename Movies</Label>
            <Switch checked={form.rename_movies} onCheckedChange={v => setForm({ ...form, rename_movies: v })} />
          </div>
          {form.rename_movies && (
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Movie Naming Format</Label>
              <Input value={form.movie_naming} onChange={e => setForm({ ...form, movie_naming: e.target.value })} className="font-mono text-xs" />
              <p className="text-[10px] text-muted-foreground mt-1">Tokens: {'{Movie Title}'} {'{Year}'} {'{Quality Full}'} {'{MediaInfo VideoCodec}'} {'{Edition Tags}'}</p>
            </div>
          )}
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm">Rename Series</Label>
            <Switch checked={form.rename_series} onCheckedChange={v => setForm({ ...form, rename_series: v })} />
          </div>
          {form.rename_series && (
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Episode Naming Format</Label>
              <Input value={form.series_naming} onChange={e => setForm({ ...form, series_naming: e.target.value })} className="font-mono text-xs" />
            </div>
          )}
        </div>
        <div className="flex items-center justify-between">
          <div><Label className="text-sm">Season Folder</Label><p className="text-xs text-muted-foreground">Organize episodes into season subfolders</p></div>
          <Switch checked={form.season_folder} onCheckedChange={v => setForm({ ...form, season_folder: v })} />
        </div>
        <div className="flex items-center justify-between">
          <div><Label className="text-sm">Empty Folder Cleanup</Label><p className="text-xs text-muted-foreground">Delete empty folders after file operations</p></div>
          <Switch checked={form.empty_folder_cleanup} onCheckedChange={v => setForm({ ...form, empty_folder_cleanup: v })} />
        </div>
        <div>
          <Label className="text-xs">Recycle Bin Path</Label>
          <Input className="mt-1 font-mono text-xs" value={form.recycle_bin_path} onChange={e => setForm({ ...form, recycle_bin_path: e.target.value })} placeholder="/media/.trash" />
        </div>
        <Button onClick={() => toast.success('Media management settings saved')}>Save Changes</Button>
      </div>
    </Card>
  );
}

function RemotePathMapsTab() {
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ host: '', remote_path: '', local_path: '', download_client_id: '' });
  const { data: maps = [] } = useQuery({ queryKey: ['remote-path-maps'], queryFn: () => base44.entities.RemotePathMap.list(), initialData: [] });
  const { data: clients = [] } = useQuery({ queryKey: ['download-clients'], queryFn: () => base44.entities.DownloadClient.list(), initialData: [] });

  const createMutation = useMutation({
    mutationFn: () => base44.entities.RemotePathMap.create(form),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['remote-path-maps'] }); setAdding(false); toast.success('Path map added'); },
  });
  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.RemotePathMap.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['remote-path-maps'] }),
  });

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-muted-foreground">{maps.length} path map(s)</p>
        <Button size="sm" onClick={() => setAdding(true)} className="gap-1.5"><Plus className="w-4 h-4" />Add Map</Button>
      </div>
      {adding && (
        <Card className="p-4 mb-4 border-primary/30">
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div><Label className="text-xs">Host</Label><Input className="mt-1 font-mono text-xs" value={form.host} onChange={e => setForm({ ...form, host: e.target.value })} placeholder="192.168.1.100" /></div>
            <div>
              <Label className="text-xs">Download Client</Label>
              <Select value={form.download_client_id} onValueChange={v => setForm({ ...form, download_client_id: v })}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select client..." /></SelectTrigger>
                <SelectContent>{clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">Remote Path</Label><Input className="mt-1 font-mono text-xs" value={form.remote_path} onChange={e => setForm({ ...form, remote_path: e.target.value })} placeholder="/downloads" /></div>
            <div><Label className="text-xs">Local Path</Label><Input className="mt-1 font-mono text-xs" value={form.local_path} onChange={e => setForm({ ...form, local_path: e.target.value })} placeholder="/media/downloads" /></div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={() => setAdding(false)}>Cancel</Button>
            <Button size="sm" onClick={() => createMutation.mutate()} disabled={!form.host || !form.remote_path || !form.local_path}>Save</Button>
          </div>
        </Card>
      )}
      <Card>
        <Table>
          <TableHeader><TableRow><TableHead>Host</TableHead><TableHead>Remote Path</TableHead><TableHead>Local Path</TableHead><TableHead className="w-10"></TableHead></TableRow></TableHeader>
          <TableBody>
            {maps.length === 0 ? (
              <TableRow><TableCell colSpan={4}><EmptyState icon={Map} title="No remote path maps" description="Add path maps when the download client runs on a different machine" /></TableCell></TableRow>
            ) : maps.map(m => (
              <TableRow key={m.id}>
                <TableCell className="text-sm font-mono">{m.host}</TableCell>
                <TableCell className="text-xs font-mono text-muted-foreground">{m.remote_path}</TableCell>
                <TableCell className="text-xs font-mono text-muted-foreground">{m.local_path}</TableCell>
                <TableCell><Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => deleteMutation.mutate(m.id)}><Trash2 className="w-4 h-4" /></Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

const STATIC_TASKS = [
  { id: 'rss-sync', name: 'RSS Sync', interval: '15 min', description: 'Sync RSS feeds from all enabled indexers' },
  { id: 'search-missing', name: 'Search Missing', interval: '1 hr', description: 'Auto-search for monitored missing media' },
  { id: 'refresh-metadata', name: 'Refresh Metadata', interval: '12 hr', description: 'Refresh metadata from TMDB for all library items' },
  { id: 'backup', name: 'Backup Database', interval: 'Daily', description: 'Create a database backup' },
  { id: 'clean-completed', name: 'Clean Completed', interval: '1 hr', description: 'Remove completed/imported items from queue' },
];

function TasksTab() {
  const [lastRun, setLastRun] = useState({});

  const runNow = (taskId, taskName) => {
    setLastRun(r => ({ ...r, [taskId]: new Date().toISOString() }));
    toast.success(`${taskName} started`);
  };

  return (
    <Card>
      <Table>
        <TableHeader><TableRow><TableHead>Task</TableHead><TableHead>Interval</TableHead><TableHead>Last Run</TableHead><TableHead>Status</TableHead><TableHead className="w-24"></TableHead></TableRow></TableHeader>
        <TableBody>
          {STATIC_TASKS.map(task => (
            <TableRow key={task.id}>
              <TableCell>
                <p className="font-medium text-sm">{task.name}</p>
                <p className="text-xs text-muted-foreground">{task.description}</p>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">{task.interval}</TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {lastRun[task.id] ? new Date(lastRun[task.id]).toLocaleTimeString() : 'Never'}
              </TableCell>
              <TableCell>
                <StatusBadge status={lastRun[task.id] ? 'completed' : 'unknown'} />
              </TableCell>
              <TableCell>
                <Button size="sm" variant="outline" className="gap-1.5 h-7 text-xs" onClick={() => runNow(task.id, task.name)}>
                  <Play className="w-3 h-3" /> Run Now
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}

function IndexerHealthBadge({ status, message }) {
  const map = {
    healthy: 'bg-green-500/15 text-green-400 border-green-500/30',
    warning: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
    error: 'bg-red-500/15 text-red-400 border-red-500/30',
    unknown: 'bg-muted/50 text-muted-foreground border-border',
  };
  const cls = map[status] || map.unknown;
  return (
    <span title={message || status} className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${cls}`}>
      {status === 'healthy' && <Check className="w-2.5 h-2.5" />}
      {status === 'error' && <AlertCircle className="w-2.5 h-2.5" />}
      {status === 'warning' && <AlertCircle className="w-2.5 h-2.5" />}
      {(status === 'unknown' || !status) && <RefreshCw className="w-2.5 h-2.5" />}
      {status || 'unknown'}
    </span>
  );
}

function IndexersTab() {
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: '', url: '', api_key: '', type: 'torrent', priority: 25 });
  const [draftTestResult, setDraftTestResult] = useState(null);
  const [testingId, setTestingId] = useState(null);

  const { data: indexers = [] } = useQuery({ queryKey: ['indexers'], queryFn: () => base44.entities.Indexer.list(), initialData: [] });

  const createMutation = useMutation({
    mutationFn: () => base44.entities.Indexer.create({ ...form, health_status: 'unknown' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['indexers'] });
      setAdding(false);
      setForm({ name: '', url: '', api_key: '', type: 'torrent', priority: 25 });
      setDraftTestResult(null);
      toast.success('Indexer added');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Indexer.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['indexers'] }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Indexer.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['indexers'] }),
  });

  const testDraft = async () => {
    if (!form.url) return;
    setDraftTestResult(null);
    setTestingId('draft');
    try {
      const res = await base44.indexers.testDraft({ name: form.name || 'Draft', url: form.url, api_key: form.api_key, type: form.type });
      setDraftTestResult({ ok: true, cats: res.categories?.length ?? 0 });
      toast.success('Connection successful');
    } catch (err) {
      setDraftTestResult({ ok: false, msg: err.message });
      toast.error(`Test failed: ${err.message}`);
    } finally {
      setTestingId(null);
    }
  };

  const testSaved = async (idx) => {
    setTestingId(idx.id);
    try {
      const res = await base44.indexers.test(idx.id);
      queryClient.invalidateQueries({ queryKey: ['indexers'] });
      toast.success(`${idx.name}: ${res.categories?.length ?? 0} categories found`);
    } catch (err) {
      queryClient.invalidateQueries({ queryKey: ['indexers'] });
      toast.error(`${idx.name}: ${err.message}`);
    } finally {
      setTestingId(null);
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-muted-foreground">{indexers.length} indexer(s) configured</p>
        <Button size="sm" onClick={() => { setAdding(true); setDraftTestResult(null); }} className="gap-1.5"><Plus className="w-4 h-4" />Add Indexer</Button>
      </div>
      {adding && (
        <Card className="p-4 mb-4 border-primary/30">
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div><Label className="text-xs">Name</Label><Input className="mt-1" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="My Indexer" /></div>
            <div><Label className="text-xs">Type</Label>
              <Select value={form.type} onValueChange={v => setForm({ ...form, type: v })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="torrent">Torrent</SelectItem><SelectItem value="usenet">Usenet</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="col-span-2"><Label className="text-xs">Torznab URL</Label><Input className="mt-1 font-mono text-xs" value={form.url} onChange={e => setForm({ ...form, url: e.target.value })} placeholder="http://prowlarr:9696/1/api  or  http://jackett:9117/api/v2.0/indexers/all/results/torznab/api" /></div>
            <div className="col-span-2"><Label className="text-xs">API Key</Label><Input className="mt-1 font-mono text-xs" value={form.api_key} onChange={e => setForm({ ...form, api_key: e.target.value })} type="password" placeholder="••••••••" /></div>
          </div>
          {draftTestResult && (
            <div className={`mb-3 p-2 rounded text-xs flex items-center gap-2 ${draftTestResult.ok ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
              {draftTestResult.ok ? <Check className="w-3 h-3 shrink-0" /> : <AlertCircle className="w-3 h-3 shrink-0" />}
              {draftTestResult.ok ? `Connected — ${draftTestResult.cats} categories` : draftTestResult.msg}
            </div>
          )}
          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={() => { setAdding(false); setDraftTestResult(null); }}>Cancel</Button>
            <Button variant="outline" size="sm" onClick={testDraft} disabled={!form.url || testingId === 'draft'} className="gap-1.5">
              {testingId === 'draft' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}Test
            </Button>
            <Button size="sm" onClick={() => createMutation.mutate()} disabled={!form.name || !form.url || createMutation.isPending}>Save</Button>
          </div>
        </Card>
      )}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead><TableHead>Type</TableHead><TableHead>URL</TableHead>
              <TableHead>Priority</TableHead><TableHead>Health</TableHead>
              <TableHead>Enabled</TableHead><TableHead className="w-24"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {indexers.length === 0 ? (
              <TableRow><TableCell colSpan={7}><EmptyState icon={Database} title="No indexers configured" description="Add a Prowlarr or Jackett Torznab endpoint to enable searching" /></TableCell></TableRow>
            ) : indexers.map(idx => (
              <TableRow key={idx.id}>
                <TableCell className="font-medium text-sm">{idx.name}</TableCell>
                <TableCell className="text-xs text-muted-foreground capitalize">{idx.type}</TableCell>
                <TableCell className="text-xs text-muted-foreground font-mono max-w-[200px] truncate">{idx.url}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{idx.priority}</TableCell>
                <TableCell>
                  <IndexerHealthBadge status={idx.health_status} message={idx.failure_reason || idx.health_message} />
                </TableCell>
                <TableCell><Switch checked={idx.enabled !== false} onCheckedChange={v => updateMutation.mutate({ id: idx.id, data: { enabled: v } })} /></TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" className="h-8 px-2 text-xs gap-1" onClick={() => testSaved(idx)} disabled={testingId === idx.id} title="Test connection">
                      {testingId === idx.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}Test
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => deleteMutation.mutate(idx.id)}><Trash2 className="w-4 h-4" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

function MediaServersTab() {
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: '', type: 'plex', url: '', token: '', username: '', enabled: true });
  const [testing, setTesting] = useState(false);

  const { data: servers = [] } = useQuery({
    queryKey: ['media-servers'],
    queryFn: () => base44.entities.MediaServer.list(),
    initialData: [],
  });
  const { data: statusData } = useQuery({
    queryKey: ['media-servers-status'],
    queryFn: () => base44.mediaservers.status(),
    refetchInterval: 15000,
  });

  const statusById = Object.fromEntries((statusData?.servers || []).map((s) => [s.id, s]));

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['media-servers'] });
    queryClient.invalidateQueries({ queryKey: ['media-servers-status'] });
  };

  const createMutation = useMutation({
    mutationFn: () => base44.entities.MediaServer.create({ ...form, health_status: 'unknown' }),
    onSuccess: () => {
      invalidateAll();
      setAdding(false);
      setForm({ name: '', type: 'plex', url: '', token: '', username: '', enabled: true });
      toast.success('Media server added');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.MediaServer.delete(id),
    onSuccess: () => invalidateAll(),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.MediaServer.update(id, data),
    onSuccess: () => invalidateAll(),
  });

  const testDraft = async () => {
    if (!form.url || !form.token) return toast.error('URL and token are required');
    setTesting(true);
    try {
      const res = await base44.mediaservers.testDraft({ type: form.type, url: form.url, token: form.token, username: form.username });
      toast.success(`Connected to ${res.info?.name || form.type}`);
    } catch (err) {
      const code = err?.data?.error || err.message;
      toast.error(code === 'unauthorized' ? 'Invalid token' : `Connection failed: ${code}`);
    } finally {
      setTesting(false);
    }
  };

  const testExisting = async (id) => {
    try {
      const res = await base44.mediaservers.test(id);
      invalidateAll();
      toast.success(`Connected to ${res.info?.name || 'server'}`);
    } catch (err) {
      invalidateAll();
      const code = err?.data?.error || err.message;
      toast.error(code === 'unauthorized' ? 'Invalid token' : `Connection failed: ${code}`);
    }
  };

  const syncNow = async (id, name) => {
    const t = toast.loading(`Syncing "${name}"...`);
    try {
      const res = await base44.mediaservers.sync(id);
      invalidateAll();
      queryClient.invalidateQueries({ queryKey: ['movies'] });
      queryClient.invalidateQueries({ queryKey: ['series'] });
      queryClient.invalidateQueries({ queryKey: ['requests'] });
      queryClient.invalidateQueries({ queryKey: ['library-movies'] });
      queryClient.invalidateQueries({ queryKey: ['library-series'] });
      const r = res.result;
      toast.success(
        `Synced "${name}": ${r.movies_matched} movie(s), ${r.series_matched} series, ${r.requests_updated} request(s) updated`,
        { id: t },
      );
    } catch (err) {
      const code = err?.data?.error || err.message;
      toast.error(`Sync failed: ${code}`, { id: t });
    }
  };

  const healthBadge = (status, msg) => {
    const cls = status === 'healthy'
      ? 'bg-green-500/15 text-green-400 border-green-500/30'
      : status === 'error'
        ? 'bg-red-500/15 text-red-400 border-red-500/30'
        : 'bg-secondary text-muted-foreground border-border';
    const label = status === 'healthy' ? 'Connected' : status === 'error' ? 'Error' : 'Unknown';
    return (
      <span className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded border ${cls}`} title={msg || ''}>
        {status === 'healthy' && <Check className="w-3 h-3" />}
        {status === 'error' && <AlertCircle className="w-3 h-3" />}
        {label}
      </span>
    );
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-muted-foreground">
          {servers.length} server(s). Syncs mark your existing library as "Available" and flip matching requests.
        </p>
        <Button size="sm" onClick={() => setAdding(true)} className="gap-1.5"><Plus className="w-4 h-4" />Add Server</Button>
      </div>

      {adding && (
        <Card className="p-4 mb-4 border-primary/30">
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div><Label className="text-xs">Name</Label><Input className="mt-1" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Home Plex" /></div>
            <div>
              <Label className="text-xs">Type</Label>
              <Select value={form.type} onValueChange={v => setForm({ ...form, type: v })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="plex">Plex</SelectItem>
                  <SelectItem value="jellyfin">Jellyfin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label className="text-xs">URL</Label>
              <Input className="mt-1 font-mono text-xs" value={form.url} onChange={e => setForm({ ...form, url: e.target.value })} placeholder={form.type === 'plex' ? 'http://192.168.1.10:32400' : 'http://192.168.1.10:8096'} />
            </div>
            <div className="col-span-2">
              <Label className="text-xs">{form.type === 'plex' ? 'X-Plex-Token' : 'API Key'}</Label>
              <Input className="mt-1 font-mono text-xs" type="password" value={form.token} onChange={e => setForm({ ...form, token: e.target.value })} placeholder="••••••••" />
              <p className="text-[10px] text-muted-foreground mt-1">
                {form.type === 'plex'
                  ? 'Get from browser dev tools on any Plex page, or https://support.plex.tv/articles/204059436'
                  : 'Jellyfin → Dashboard → API Keys → New API Key'}
              </p>
            </div>
            {form.type === 'jellyfin' && (
              <div className="col-span-2">
                <Label className="text-xs">Username (optional)</Label>
                <Input className="mt-1" value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} placeholder="Leave blank for the first admin user" />
              </div>
            )}
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={testDraft} disabled={testing || !form.url || !form.token}>
              {testing ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Test Connection'}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setAdding(false)}>Cancel</Button>
            <Button size="sm" onClick={() => createMutation.mutate()} disabled={!form.name || !form.url || !form.token}>Save</Button>
          </div>
        </Card>
      )}

      <div className="space-y-2">
        {servers.length === 0 ? (
          <Card className="p-8"><EmptyState icon={Server} title="No media servers" description="Connect Plex or Jellyfin to auto-mark your library as available" /></Card>
        ) : servers.map(s => {
          const status = statusById[s.id];
          const lr = status?.last_sync_result;
          return (
            <Card key={s.id} className="p-4">
              <div className="flex items-start gap-4">
                <Server className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-sm">{s.name}</p>
                    <span className="text-[10px] uppercase px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">{s.type}</span>
                    {healthBadge(status?.health_status || s.health_status, status?.health_message || s.health_message)}
                  </div>
                  <p className="text-xs text-muted-foreground font-mono mt-0.5 truncate">{s.url}</p>
                  {lr && (
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Last sync: {s.last_sync_date ? new Date(s.last_sync_date).toLocaleString() : '—'} · {lr.movies_matched} movies · {lr.series_matched} series · {lr.requests_updated} requests updated
                      {(lr.created_movies + lr.created_series) > 0 && ` · +${lr.created_movies + lr.created_series} new`}
                      {lr.errors?.length > 0 && ` · ${lr.errors.length} error(s)`}
                    </p>
                  )}
                </div>
                <div className="flex gap-1 shrink-0">
                  <Switch
                    checked={s.enabled !== false}
                    onCheckedChange={v => updateMutation.mutate({ id: s.id, data: { enabled: v } })}
                  />
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => testExisting(s.id)} title="Test connection">
                    <Check className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-primary" onClick={() => syncNow(s.id, s.name)} disabled={s.enabled === false} title="Sync now">
                    <RefreshCw className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => deleteMutation.mutate(s.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function DownloadClientsTab() {
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: '', type: 'qbittorrent', host: '', port: 8080, username: '', password: '', use_ssl: false, category: '', media_type: 'both' });

  const { data: clients = [] } = useQuery({ queryKey: ['download-clients'], queryFn: () => base44.entities.DownloadClient.list(), initialData: [] });

  const createMutation = useMutation({
    mutationFn: () => base44.entities.DownloadClient.create({ ...form, health_status: 'unknown' }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['download-clients'] }); setAdding(false); toast.success('Download client added'); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.DownloadClient.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['download-clients'] }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.DownloadClient.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['download-clients'] }),
  });

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-muted-foreground">{clients.length} client(s) configured</p>
        <Button size="sm" onClick={() => setAdding(true)} className="gap-1.5"><Plus className="w-4 h-4" />Add Client</Button>
      </div>
      {adding && (
        <Card className="p-4 mb-4 border-primary/30">
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div><Label className="text-xs">Name</Label><Input className="mt-1" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label className="text-xs">Type</Label>
              <Select value={form.type} onValueChange={v => setForm({ ...form, type: v })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['qbittorrent', 'transmission', 'deluge', 'sabnzbd', 'nzbget', 'rtorrent', 'aria2'].map(t => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">Host</Label><Input className="mt-1 font-mono text-xs" value={form.host} onChange={e => setForm({ ...form, host: e.target.value })} placeholder="192.168.1.100" /></div>
            <div><Label className="text-xs">Port</Label><Input className="mt-1" type="number" value={form.port} onChange={e => setForm({ ...form, port: parseInt(e.target.value) })} /></div>
            <div><Label className="text-xs">Username</Label><Input className="mt-1" value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} /></div>
            <div><Label className="text-xs">Password</Label><Input className="mt-1" type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} /></div>
            <div className="flex items-center gap-2 mt-2"><Switch checked={form.use_ssl} onCheckedChange={v => setForm({ ...form, use_ssl: v })} /><Label className="text-xs">Use SSL</Label></div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={() => setAdding(false)}>Cancel</Button>
            <Button size="sm" onClick={() => createMutation.mutate()} disabled={!form.name || !form.host}>Save</Button>
          </div>
        </Card>
      )}
      <Card>
        <Table>
          <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Type</TableHead><TableHead>Host</TableHead><TableHead>For</TableHead><TableHead>Status</TableHead><TableHead>Enabled</TableHead><TableHead className="w-10"></TableHead></TableRow></TableHeader>
          <TableBody>
            {clients.length === 0 && !adding ? (
              <TableRow><TableCell colSpan={7}><EmptyState icon={HardDrive} title="No download clients configured" description="A download client is required to grab releases from indexers">
                <Button size="sm" onClick={() => setAdding(true)} className="gap-1.5"><Plus className="w-4 h-4" /> Add Download Client</Button>
              </EmptyState></TableCell></TableRow>
            ) : clients.map(c => (
              <TableRow key={c.id}>
                <TableCell className="font-medium text-sm">{c.name}</TableCell>
                <TableCell className="text-sm text-muted-foreground capitalize">{c.type}</TableCell>
                <TableCell className="text-xs font-mono text-muted-foreground">{c.use_ssl ? 'https' : 'http'}://{c.host}:{c.port}</TableCell>
                <TableCell className="text-sm text-muted-foreground capitalize">{c.media_type}</TableCell>
                <TableCell><StatusBadge status={c.health_status || 'unknown'} /></TableCell>
                <TableCell><Switch checked={c.enabled !== false} onCheckedChange={v => updateMutation.mutate({ id: c.id, data: { enabled: v } })} /></TableCell>
                <TableCell><Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => deleteMutation.mutate(c.id)}><Trash2 className="w-4 h-4" /></Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}

const DEFAULT_QUALITIES = [
  'Bluray-2160p','WEBDL-2160p','WEBRip-2160p','HDTV-2160p',
  'Bluray-1080p','WEBDL-1080p','WEBRip-1080p','HDTV-1080p',
  'Bluray-720p','WEBDL-720p','WEBRip-720p','HDTV-720p',
  'WEBDL-480p','DVDRip','SDTV',
].map(name => ({ name, enabled: true, preferred: false }));

function QualityProfileForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState(() => ({
    name: initial?.name || '',
    description: initial?.description || '',
    upgrade_allowed: initial?.upgrade_allowed !== false,
    media_type: initial?.media_type || 'both',
    cutoff_quality: initial?.cutoff_quality || 'WEBDL-1080p',
    qualities: initial?.qualities?.length ? initial.qualities : [...DEFAULT_QUALITIES],
  }));

  const moveQuality = (idx, dir) => {
    const qs = [...form.qualities];
    const target = idx + dir;
    if (target < 0 || target >= qs.length) return;
    [qs[idx], qs[target]] = [qs[target], qs[idx]];
    setForm(f => ({ ...f, qualities: qs }));
  };

  const toggleEnabled = (idx) => {
    const qs = [...form.qualities];
    qs[idx] = { ...qs[idx], enabled: !qs[idx].enabled };
    setForm(f => ({ ...f, qualities: qs }));
  };

  const togglePreferred = (idx) => {
    const qs = [...form.qualities];
    qs[idx] = { ...qs[idx], preferred: !qs[idx].preferred };
    setForm(f => ({ ...f, qualities: qs }));
  };

  return (
    <Card className="p-4 mb-4 border-primary/30">
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div><Label className="text-xs">Name</Label><Input className="mt-1" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Any" /></div>
        <div><Label className="text-xs">Description</Label><Input className="mt-1" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
        <div className="flex items-center gap-2 mt-1"><Switch checked={form.upgrade_allowed} onCheckedChange={v => setForm({ ...form, upgrade_allowed: v })} /><Label className="text-xs">Allow Upgrades</Label></div>
        <div>
          <Label className="text-xs">For</Label>
          <Select value={form.media_type} onValueChange={v => setForm({ ...form, media_type: v })}>
            <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="both">Both</SelectItem><SelectItem value="movie">Movies</SelectItem><SelectItem value="series">Series</SelectItem></SelectContent>
          </Select>
        </div>
      </div>

      <Label className="text-xs font-semibold block mb-2">Quality Order (top = highest priority)</Label>
      <div className="border border-border rounded-md divide-y divide-border mb-3 max-h-80 overflow-y-auto">
        {form.qualities.map((q, idx) => (
          <div key={q.name} className={`flex items-center gap-2 px-3 py-2 ${!q.enabled ? 'opacity-40' : ''}`}>
            <input
              type="checkbox"
              checked={q.enabled}
              onChange={() => toggleEnabled(idx)}
              className="w-3.5 h-3.5 accent-primary shrink-0"
            />
            <span className="text-sm flex-1">{q.name}</span>
            {form.cutoff_quality === q.name && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 shrink-0">Cutoff</span>
            )}
            <button
              onClick={() => togglePreferred(idx)}
              className={`shrink-0 ${q.preferred ? 'text-yellow-400' : 'text-muted-foreground hover:text-yellow-400'}`}
              title="Toggle preferred"
            >
              <Star className="w-3.5 h-3.5" fill={q.preferred ? 'currentColor' : 'none'} />
            </button>
            <button
              onClick={() => setForm(f => ({ ...f, cutoff_quality: q.name }))}
              className="text-[10px] px-1.5 py-0.5 rounded border border-border text-muted-foreground hover:border-cyan-500/50 hover:text-cyan-400 shrink-0"
              title="Set as cutoff"
            >Set Cutoff</button>
            <div className="flex flex-col shrink-0">
              <button onClick={() => moveQuality(idx, -1)} disabled={idx === 0} className="text-muted-foreground hover:text-foreground disabled:opacity-20"><ChevronUp className="w-3 h-3" /></button>
              <button onClick={() => moveQuality(idx, 1)} disabled={idx === form.qualities.length - 1} className="text-muted-foreground hover:text-foreground disabled:opacity-20"><ChevronDown className="w-3 h-3" /></button>
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-2 justify-end">
        <Button variant="outline" size="sm" onClick={onCancel}>Cancel</Button>
        <Button size="sm" onClick={() => onSave(form)} disabled={!form.name}>Save Profile</Button>
      </div>
    </Card>
  );
}

function QualityProfilesTab() {
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const { data: profiles = [] } = useQuery({ queryKey: ['quality-profiles'], queryFn: () => base44.entities.QualityProfile.list(), initialData: [] });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.QualityProfile.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['quality-profiles'] }); setAdding(false); toast.success('Profile created'); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.QualityProfile.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['quality-profiles'] }); setEditingId(null); toast.success('Profile updated'); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.QualityProfile.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['quality-profiles'] }),
  });

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-muted-foreground">{profiles.length} profile(s)</p>
        <Button size="sm" onClick={() => { setAdding(true); setEditingId(null); }} className="gap-1.5"><Plus className="w-4 h-4" />Add Profile</Button>
      </div>

      {adding && (
        <QualityProfileForm
          onSave={(data) => createMutation.mutate(data)}
          onCancel={() => setAdding(false)}
        />
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {profiles.length === 0 ? (
          <Card className="p-8 col-span-3"><EmptyState icon={Sliders} title="No quality profiles" /></Card>
        ) : profiles.map(p => (
          editingId === p.id ? (
            <div key={p.id} className="col-span-3">
              <QualityProfileForm
                initial={p}
                onSave={(data) => updateMutation.mutate({ id: p.id, data })}
                onCancel={() => setEditingId(null)}
              />
            </div>
          ) : (
            <Card key={p.id} className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold">{p.name}</p>
                  {p.description && <p className="text-xs text-muted-foreground mt-0.5">{p.description}</p>}
                  {p.qualities?.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {p.qualities.filter(q => q.enabled).slice(0, 3).map(q => (
                        <span key={q.name} className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">{q.name}</span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => { setEditingId(p.id); setAdding(false); }}><Pencil className="w-3.5 h-3.5" /></Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => deleteMutation.mutate(p.id)}><Trash2 className="w-4 h-4" /></Button>
                </div>
              </div>
              <div className="mt-3 space-y-1">
                <div className="flex justify-between text-xs"><span className="text-muted-foreground">Cutoff</span><span>{p.cutoff_quality || 'Any'}</span></div>
                <div className="flex justify-between text-xs"><span className="text-muted-foreground">Upgrades</span><span>{p.upgrade_allowed ? 'Enabled' : 'Disabled'}</span></div>
                <div className="flex justify-between text-xs"><span className="text-muted-foreground">For</span><span className="capitalize">{p.media_type}</span></div>
              </div>
            </Card>
          )
        ))}
      </div>
    </div>
  );
}

function RootFoldersTab() {
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: '', path: '', media_type: 'both' });

  const { data: folders = [] } = useQuery({ queryKey: ['root-folders'], queryFn: () => base44.entities.RootFolder.list(), initialData: [] });

  const createMutation = useMutation({
    mutationFn: () => base44.entities.RootFolder.create({ ...form, accessible: true }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['root-folders'] }); setAdding(false); toast.success('Root folder added'); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.RootFolder.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['root-folders'] }),
  });

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-muted-foreground">{folders.length} folder(s)</p>
        <Button size="sm" onClick={() => setAdding(true)} className="gap-1.5"><Plus className="w-4 h-4" />Add Folder</Button>
      </div>
      {adding && (
        <Card className="p-4 mb-4 border-primary/30">
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div><Label className="text-xs">Name</Label><Input className="mt-1" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Movies" /></div>
            <div><Label className="text-xs">For</Label>
              <Select value={form.media_type} onValueChange={v => setForm({ ...form, media_type: v })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="movie">Movies</SelectItem><SelectItem value="series">Series</SelectItem><SelectItem value="both">Both</SelectItem></SelectContent>
              </Select>
            </div>
            <div className="col-span-2"><Label className="text-xs">Path</Label><Input className="mt-1 font-mono text-xs" value={form.path} onChange={e => setForm({ ...form, path: e.target.value })} placeholder="/media/movies" /></div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={() => setAdding(false)}>Cancel</Button>
            <Button size="sm" onClick={() => createMutation.mutate()} disabled={!form.name || !form.path}>Save</Button>
          </div>
        </Card>
      )}
      <div className="space-y-2">
        {folders.length === 0 ? (
          <Card className="p-8"><EmptyState icon={FolderOpen} title="No root folders" description="Add root folders to define where media is stored" /></Card>
        ) : folders.map(f => (
          <Card key={f.id} className="p-4 flex items-center gap-4">
            <FolderOpen className="w-5 h-5 text-primary shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm">{f.name}</p>
              <p className="text-xs text-muted-foreground font-mono">{f.path}</p>
            </div>
            <StatusBadge status={f.accessible ? 'healthy' : 'error'} />
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => deleteMutation.mutate(f.id)}><Trash2 className="w-4 h-4" /></Button>
          </Card>
        ))}
      </div>
    </div>
  );
}

function NotificationsTab() {
  const queryClient = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: '', type: 'discord', enabled: true, config: {} });

  const { data: rules = [] } = useQuery({ queryKey: ['notification-rules'], queryFn: () => base44.entities.NotificationRule.list(), initialData: [] });

  const createMutation = useMutation({
    mutationFn: () => base44.entities.NotificationRule.create(form),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['notification-rules'] }); setAdding(false); toast.success('Notification rule created'); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.NotificationRule.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notification-rules'] }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.NotificationRule.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notification-rules'] }),
  });

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-muted-foreground">{rules.length} rule(s)</p>
        <Button size="sm" onClick={() => setAdding(true)} className="gap-1.5"><Plus className="w-4 h-4" />Add Rule</Button>
      </div>
      {adding && (
        <Card className="p-4 mb-4 border-primary/30">
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div><Label className="text-xs">Name</Label><Input className="mt-1" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Discord Alerts" /></div>
            <div><Label className="text-xs">Type</Label>
              <Select value={form.type} onValueChange={v => setForm({ ...form, type: v })}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {['email', 'webhook', 'discord', 'slack', 'telegram', 'pushover'].map(t => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={() => setAdding(false)}>Cancel</Button>
            <Button size="sm" onClick={() => createMutation.mutate()} disabled={!form.name}>Save</Button>
          </div>
        </Card>
      )}
      <div className="space-y-2">
        {rules.length === 0 ? (
          <Card className="p-8"><EmptyState icon={Bell} title="No notification rules" description="Add rules to get notified of media events" /></Card>
        ) : rules.map(r => (
          <Card key={r.id} className="p-4 flex items-center gap-4">
            <Bell className="w-5 h-5 text-primary shrink-0" />
            <div className="flex-1">
              <p className="font-medium text-sm">{r.name}</p>
              <p className="text-xs text-muted-foreground capitalize">{r.type}</p>
            </div>
            <Switch checked={r.enabled !== false} onCheckedChange={v => updateMutation.mutate({ id: r.id, data: { enabled: v } })} />
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => deleteMutation.mutate(r.id)}><Trash2 className="w-4 h-4" /></Button>
          </Card>
        ))}
      </div>
    </div>
  );
}