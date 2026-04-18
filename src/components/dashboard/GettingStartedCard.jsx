import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { CheckCircle2, Circle, X, Rocket } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const STEPS = [
  { label: 'Add a root folder', description: 'Define where media is stored', link: '/settings', entity: 'rootFolders' },
  { label: 'Add an indexer', description: 'Required for searching releases', link: '/settings', entity: 'indexers' },
  { label: 'Add a download client', description: 'Required to grab releases', link: '/settings', entity: 'clients' },
  { label: 'Create a quality profile', description: 'Set quality preferences', link: '/settings', entity: 'profiles' },
  { label: 'Add your first movie or series', description: 'Start building your library', link: '/discover', entity: 'media' },
];

export default function GettingStartedCard() {
  const queryClient = useQueryClient();

  const { data: rootFolders = [] } = useQuery({ queryKey: ['root-folders'], queryFn: () => base44.entities.RootFolder.list(), initialData: [] });
  const { data: indexers = [] } = useQuery({ queryKey: ['indexers'], queryFn: () => base44.entities.Indexer.list(), initialData: [] });
  const { data: clients = [] } = useQuery({ queryKey: ['download-clients'], queryFn: () => base44.entities.DownloadClient.list(), initialData: [] });
  const { data: profiles = [] } = useQuery({ queryKey: ['quality-profiles'], queryFn: () => base44.entities.QualityProfile.list(), initialData: [] });
  const { data: movies = [] } = useQuery({ queryKey: ['all-movies'], queryFn: () => base44.entities.Movie.list('-added_date', 1), initialData: [] });
  const { data: series = [] } = useQuery({ queryKey: ['all-series'], queryFn: () => base44.entities.Series.list('-added_date', 1), initialData: [] });

  const { data: dismissedRecord } = useQuery({
    queryKey: ['onboarding-dismissed'],
    queryFn: async () => {
      const list = await base44.entities.AppSettings.filter({ key: 'onboarding_dismissed' });
      return list[0] || null;
    },
  });

  const dismissMutation = useMutation({
    mutationFn: async () => {
      const payload = { key: 'onboarding_dismissed', value: 'true' };
      if (dismissedRecord?.id) return base44.entities.AppSettings.update(dismissedRecord.id, payload);
      return base44.entities.AppSettings.create(payload);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['onboarding-dismissed'] }),
  });

  if (dismissedRecord?.value === 'true') return null;

  const counts = {
    rootFolders: rootFolders.length,
    indexers: indexers.length,
    clients: clients.length,
    profiles: profiles.length,
    media: movies.length + series.length,
  };

  const completed = STEPS.map(s => counts[s.entity] > 0);
  const allDone = completed.every(Boolean);

  if (allDone) return null;

  const completedCount = completed.filter(Boolean).length;

  return (
    <Card className="p-5 mb-6 border-primary/20 bg-primary/5">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/20">
            <Rocket className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold">Welcome to NexusMedia</h3>
            <p className="text-xs text-muted-foreground">Complete these steps to start managing your media library</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">{completedCount}/{STEPS.length} complete</span>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => dismissMutation.mutate()}>
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-secondary rounded-full h-1.5 mb-4">
        <div
          className="bg-primary h-1.5 rounded-full transition-all duration-500"
          style={{ width: `${(completedCount / STEPS.length) * 100}%` }}
        />
      </div>

      <div className="space-y-2">
        {STEPS.map((step, i) => (
          <div key={step.entity} className={`flex items-center gap-3 p-2.5 rounded-lg transition-colors ${completed[i] ? 'opacity-60' : 'hover:bg-secondary/50'}`}>
            {completed[i]
              ? <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
              : <Circle className="w-4 h-4 text-muted-foreground shrink-0" />
            }
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-medium ${completed[i] ? 'line-through text-muted-foreground' : ''}`}>{step.label}</p>
              <p className="text-xs text-muted-foreground">{step.description}</p>
            </div>
            {!completed[i] && (
              <Button asChild variant="outline" size="sm" className="h-7 text-xs shrink-0">
                <Link to={step.link}>Set up →</Link>
              </Button>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}