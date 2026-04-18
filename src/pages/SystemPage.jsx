import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  AlertCircle, AlertTriangle, Info, CheckCircle2, RefreshCw, Trash2,
  Play, Copy, Database, Server, Clock
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
import { toast } from 'sonner';
import { format } from 'date-fns';

const iconMap = {
  error: <AlertCircle className="w-4 h-4 text-red-400" />,
  warning: <AlertTriangle className="w-4 h-4 text-yellow-400" />,
  info: <Info className="w-4 h-4 text-blue-400" />,
};

const colorMap = {
  error: 'bg-red-500/10 border-red-500/20',
  warning: 'bg-yellow-500/10 border-yellow-500/20',
  info: 'bg-blue-500/10 border-blue-500/20',
};

const SCHEDULED_TASKS = [
  { name: 'Refresh All Movie Metadata', interval: 'Every 12 hours', last_run: '2 hours ago' },
  { name: 'RSS Sync', interval: 'Every 15 minutes', last_run: '8 minutes ago' },
  { name: 'Backup', interval: 'Daily at 03:00', last_run: '18 hours ago' },
  { name: 'Check For Finished Downloads', interval: 'Every minute', last_run: 'Just now' },
  { name: 'Refresh All Series Metadata', interval: 'Every 12 hours', last_run: '4 hours ago' },
  { name: 'Clean Up Recycling Bin', interval: 'Daily', last_run: 'Yesterday' },
  { name: 'Housekeeping', interval: 'Every hour', last_run: '30 minutes ago' },
];

const SEED_LOGS = [
  { ts: '2026-04-14 10:42:05', level: 'Info', msg: 'RSS sync completed. Found 3 new releases.' },
  { ts: '2026-04-14 10:40:11', level: 'Info', msg: 'Download client qBittorrent connected successfully.' },
  { ts: '2026-04-14 10:38:22', level: 'Warning', msg: 'Indexer "MyIndexer" returned slow response (3200ms).' },
  { ts: '2026-04-14 10:35:00', level: 'Info', msg: 'Metadata refresh started for 142 movies.' },
  { ts: '2026-04-14 10:20:15', level: 'Error', msg: 'Failed to import: /downloads/sample.mkv — No matching movie found.' },
  { ts: '2026-04-14 10:15:03', level: 'Info', msg: 'Download completed: Oppenheimer.2023.BluRay.2160p.mkv' },
  { ts: '2026-04-14 10:10:44', level: 'Info', msg: 'Grabbed release: Dune.Part.Two.2024.WEBDL.1080p from Indexer A.' },
  { ts: '2026-04-14 09:55:33', level: 'Warning', msg: 'Disk space on /media is below 10% threshold.' },
  { ts: '2026-04-14 09:50:01', level: 'Info', msg: 'Application started. Version 1.0.0' },
  { ts: '2026-04-14 09:48:55', level: 'Info', msg: 'Database migration completed successfully.' },
  { ts: '2026-04-14 09:45:00', level: 'Error', msg: 'Notification webhook to Discord failed: Connection refused.' },
  { ts: '2026-04-14 09:40:12', level: 'Info', msg: 'Backup created: mediaflow-backup-20260414.zip' },
  { ts: '2026-04-14 09:35:08', level: 'Warning', msg: 'Quality profile "Any" has no enabled qualities.' },
  { ts: '2026-04-14 09:30:00', level: 'Info', msg: 'Scheduled task "Housekeeping" completed in 204ms.' },
  { ts: '2026-04-14 09:25:55', level: 'Info', msg: 'User admin@mediaflow.local logged in.' },
];

const levelColor = {
  Info: 'text-blue-400',
  Warning: 'text-yellow-400',
  Error: 'text-red-400',
};

async function runHealthChecks(queryClient) {
  const [rootFolders, indexers, clients] = await Promise.all([
    base44.entities.RootFolder.list(),
    base44.entities.Indexer.list(),
    base44.entities.DownloadClient.list(),
  ]);
  const existingIssues = await base44.entities.HealthIssue.filter({ resolved: false });

  const upsert = async (source, message, type) => {
    const existing = existingIssues.find(i => i.source === source && i.message === message);
    if (!existing) await base44.entities.HealthIssue.create({ type, source, message, resolved: false });
  };
  const resolve = async (source, message) => {
    const existing = existingIssues.find(i => i.source === source && i.message === message);
    if (existing) await base44.entities.HealthIssue.update(existing.id, { resolved: true, resolved_date: new Date().toISOString() });
  };

  // Root folders
  if (rootFolders.length === 0) {
    await upsert('RootFolder', 'No root folders configured', 'warning');
  } else {
    await resolve('RootFolder', 'No root folders configured');
    for (const f of rootFolders) {
      const msg = `Root folder is not accessible: ${f.path}`;
      if (f.accessible === false) await upsert('RootFolder', msg, 'error');
      else await resolve('RootFolder', msg);
    }
  }
  // Indexers
  if (indexers.length === 0) await upsert('Indexer', 'No indexers configured — automatic search is disabled', 'warning');
  else await resolve('Indexer', 'No indexers configured — automatic search is disabled');
  // Download clients
  if (clients.length === 0) await upsert('DownloadClient', 'No download clients configured — cannot grab releases', 'warning');
  else await resolve('DownloadClient', 'No download clients configured — cannot grab releases');
  for (const c of clients) {
    const msg = `Download client unreachable: ${c.name}`;
    if (c.health_status === 'disconnected' || c.health_status === 'error') await upsert('DownloadClient', msg, 'error');
    else await resolve('DownloadClient', msg);
  }

  queryClient.invalidateQueries({ queryKey: ['health-issues'] });
}

export default function SystemPage() {
  const queryClient = useQueryClient();
  const [logLevel, setLogLevel] = useState('all');

  const { data: issues = [], isLoading } = useQuery({
    queryKey: ['health-issues'],
    queryFn: () => base44.entities.HealthIssue.filter({ resolved: false }, '-created_date', 100),
    initialData: [],
  });

  useEffect(() => { runHealthChecks(queryClient); }, []);

  const resolveMutation = useMutation({
    mutationFn: (id) => base44.entities.HealthIssue.update(id, { resolved: true, resolved_date: new Date().toISOString() }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['health-issues'] });
      toast.success('Issue marked as resolved');
    },
  });

  const errors = issues.filter(i => i.type === 'error');
  const warnings = issues.filter(i => i.type === 'warning');
  const infos = issues.filter(i => i.type === 'info');

  const filteredLogs = logLevel === 'all' ? SEED_LOGS : SEED_LOGS.filter(l => l.level === logLevel);

  const copyLogs = () => {
    const text = filteredLogs.map(l => `[${l.ts}] [${l.level}] ${l.msg}`).join('\n');
    navigator.clipboard.writeText(text);
    toast.success('Logs copied to clipboard');
  };

  return (
    <div>
      <PageHeader title="System" description="Health checks and system status">
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => runHealthChecks(queryClient)}>
          <RefreshCw className="w-4 h-4" /> Re-run Health Check
        </Button>
      </PageHeader>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Errors', count: errors.length, icon: <AlertCircle className="w-5 h-5 text-red-400" />, color: 'border-red-500/30' },
          { label: 'Warnings', count: warnings.length, icon: <AlertTriangle className="w-5 h-5 text-yellow-400" />, color: 'border-yellow-500/30' },
          { label: 'Info', count: infos.length, icon: <Info className="w-5 h-5 text-blue-400" />, color: 'border-blue-500/30' },
          { label: 'API Status', count: null, icon: <CheckCircle2 className="w-5 h-5 text-green-400" />, color: 'border-green-500/30', chip: 'healthy' },
        ].map(s => (
          <Card key={s.label} className={`p-4 border ${s.color}`}>
            <div className="flex items-center gap-3">
              {s.icon}
              <div>
                {s.count !== null ? <p className="text-2xl font-bold">{s.count}</p> : null}
                {s.chip ? <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-[10px]">Healthy</Badge> : null}
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="health">
        <TabsList className="bg-secondary mb-4">
          <TabsTrigger value="health">Health Issues</TabsTrigger>
          <TabsTrigger value="tasks">Scheduled Tasks</TabsTrigger>
          <TabsTrigger value="logs">Application Logs</TabsTrigger>
          <TabsTrigger value="backup">Backup</TabsTrigger>
          <TabsTrigger value="environment">Environment</TabsTrigger>
        </TabsList>

        <TabsContent value="health">
          {issues.length === 0 ? (
            <Card className="p-8">
              <EmptyState icon={CheckCircle2} title="All systems operational" description="No issues detected. Everything is running smoothly." />
            </Card>
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">Type</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Message</TableHead>
                    <TableHead>Detected</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {issues.map(issue => (
                    <TableRow key={issue.id} className={colorMap[issue.type]}>
                      <TableCell>{iconMap[issue.type]}</TableCell>
                      <TableCell className="text-sm font-medium">{issue.source}</TableCell>
                      <TableCell>
                        <p className="text-sm">{issue.message}</p>
                        {issue.wiki_url && (
                          <a href={issue.wiki_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">Wiki ↗</a>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {issue.created_date ? format(new Date(issue.created_date), 'MMM d, HH:mm') : '—'}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => resolveMutation.mutate(issue.id)}>
                          <CheckCircle2 className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="tasks">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Task</TableHead>
                  <TableHead>Interval</TableHead>
                  <TableHead>Last Run</TableHead>
                  <TableHead className="w-24"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {SCHEDULED_TASKS.map(task => (
                  <TableRow key={task.name}>
                    <TableCell className="font-medium text-sm">{task.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      <div className="flex items-center gap-1.5"><Clock className="w-3 h-3" />{task.interval}</div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{task.last_run}</TableCell>
                    <TableCell>
                      <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => toast.success(`Running: ${task.name}`)}>
                        <Play className="w-3 h-3" /> Run Now
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="logs">
          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <Select value={logLevel} onValueChange={setLogLevel}>
                <SelectTrigger className="w-32 h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Levels</SelectItem>
                  <SelectItem value="Info">Info</SelectItem>
                  <SelectItem value="Warning">Warning</SelectItem>
                  <SelectItem value="Error">Error</SelectItem>
                </SelectContent>
              </Select>
              <Button size="sm" variant="outline" className="gap-1.5 h-8" onClick={copyLogs}>
                <Copy className="w-3 h-3" /> Copy Logs
              </Button>
            </div>
            <div className="bg-background rounded-lg p-3 font-mono text-xs space-y-1 max-h-[400px] overflow-y-auto border border-border">
              {filteredLogs.map((log, i) => (
                <div key={i} className="flex gap-2">
                  <span className="text-muted-foreground shrink-0">{log.ts}</span>
                  <span className={`shrink-0 font-semibold ${levelColor[log.level]}`}>[{log.level}]</span>
                  <span className="text-foreground/80">{log.msg}</span>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="backup">
          <Card className="p-6 space-y-6">
            <div>
              <h3 className="font-semibold mb-1">Database Backup</h3>
              <p className="text-sm text-muted-foreground mb-4">Last backup: <span className="text-foreground font-medium">Never</span></p>
              <div className="flex items-center gap-3">
                <Button className="gap-1.5" onClick={() => toast.success('Backup created successfully — mediaflow-backup-20260414.zip')}>
                  <Database className="w-4 h-4" /> Backup Now
                </Button>
              </div>
            </div>
            <div className="border-t border-border pt-4">
              <h3 className="font-semibold mb-2 text-sm">Retention</h3>
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground">Keep last</span>
                <input type="number" defaultValue={3} className="w-16 h-8 rounded-md border border-input bg-secondary px-2 text-sm" />
                <span className="text-sm text-muted-foreground">backups</span>
              </div>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="environment">
          <Card className="p-6">
            <div className="space-y-3">
              {[
                ['App Version', '1.0.0'],
                ['Node Environment', 'production'],
                ['Base URL', window.location.origin],
                ['Platform', 'Base44'],
                ['Build Date', '2026-04-14'],
                ['API Status', null],
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between items-center text-sm border-b border-border pb-2 last:border-0">
                  <span className="text-muted-foreground">{label}</span>
                  {value !== null
                    ? <span className="font-mono text-xs">{value}</span>
                    : <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-[10px]">Healthy</Badge>
                  }
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}