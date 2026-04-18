import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import {
  MessageSquare, Download, AlertTriangle, Film, Tv,
  Clock, HardDrive, XCircle, ArrowRight, FolderOpen
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import PageHeader from '@/components/shared/PageHeader';
import StatsCard from '@/components/shared/StatsCard';
import StatusBadge from '@/components/shared/StatusBadge';
import DashboardActivityFeed from '@/components/dashboard/DashboardActivityFeed';
import DashboardRecentlyAdded from '@/components/dashboard/DashboardRecentlyAdded';
import StorageWidget from '@/components/dashboard/StorageWidget';
import GettingStartedCard from '@/components/dashboard/GettingStartedCard';

export default function Dashboard() {
  const navigate = useNavigate();

  const { data: requests = [] } = useQuery({
    queryKey: ['all-requests'],
    queryFn: () => base44.entities.Request.list('-created_date', 100),
    initialData: [],
  });

  const { data: movies = [] } = useQuery({
    queryKey: ['all-movies'],
    queryFn: () => base44.entities.Movie.list('-added_date', 100),
    initialData: [],
  });

  const { data: series = [] } = useQuery({
    queryKey: ['all-series'],
    queryFn: () => base44.entities.Series.list('-added_date', 100),
    initialData: [],
  });

  const { data: queue = [] } = useQuery({
    queryKey: ['queue'],
    queryFn: () => base44.entities.DownloadQueueItem.list('-created_date', 50),
    initialData: [],
  });

  const { data: history = [] } = useQuery({
    queryKey: ['recent-history'],
    queryFn: () => base44.entities.HistoryEvent.list('-created_date', 20),
    initialData: [],
  });

  const { data: healthIssues = [] } = useQuery({
    queryKey: ['health-issues'],
    queryFn: () => base44.entities.HealthIssue.filter({ resolved: false }),
    initialData: [],
  });

  const pendingRequests = requests.filter(r => r.status === 'pending_approval');
  const processingRequests = requests.filter(r => ['approved', 'processing'].includes(r.status));
  const activeDownloads = queue.filter(q => ['downloading', 'queued'].includes(q.status));
  const failedDownloads = queue.filter(q => q.status === 'failed');
  const missingMovies = movies.filter(m => m.library_status === 'missing' && m.monitored);
  const missingSeries = series.filter(s => s.episodes_missing > 0 && s.monitored);

  return (
    <div>
      <PageHeader title="Dashboard" description="Media library operational overview" />
      <GettingStartedCard />

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-6">
        <StatsCard
          label="Pending Requests"
          value={pendingRequests.length}
          icon={MessageSquare}
          onClick={() => navigate('/requests?status=pending_approval')}
        />
        <StatsCard
          label="In Progress"
          value={processingRequests.length}
          icon={Clock}
          onClick={() => navigate('/requests?status=processing')}
        />
        <StatsCard
          label="Downloading"
          value={activeDownloads.length}
          icon={Download}
          onClick={() => navigate('/queue')}
        />
        <StatsCard
          label="Failed"
          value={failedDownloads.length}
          icon={XCircle}
          onClick={() => navigate('/queue?status=failed')}
        />
        <StatsCard
          label="Movies Missing"
          value={missingMovies.length}
          icon={Film}
          onClick={() => navigate('/wanted?type=movies')}
        />
        <StatsCard
          label="Episodes Missing"
          value={missingSeries.reduce((sum, s) => sum + (s.episodes_missing || 0), 0)}
          icon={Tv}
          onClick={() => navigate('/wanted?type=series')}
        />
      </div>

      {/* Health Issues */}
      {healthIssues.length > 0 && (
        <Card className="p-4 mb-6 border-yellow-500/30 bg-yellow-500/5">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-yellow-400" />
            <h3 className="text-sm font-semibold text-yellow-400">Health Issues ({healthIssues.length})</h3>
          </div>
          <div className="space-y-2">
            {healthIssues.slice(0, 3).map(issue => (
              <div key={issue.id} className="flex items-center gap-2 text-sm">
                <StatusBadge status={issue.type} />
                <span className="text-muted-foreground">{issue.source}:</span>
                <span>{issue.message}</span>
              </div>
            ))}
            {healthIssues.length > 3 && (
              <Button variant="ghost" size="sm" onClick={() => navigate('/system')} className="text-xs">
                View all {healthIssues.length} issues <ArrowRight className="w-3 h-3 ml-1" />
              </Button>
            )}
          </div>
        </Card>
      )}

      {/* Storage Widget */}
      <StorageWidget />

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
        <div className="lg:col-span-2">
          <DashboardRecentlyAdded movies={movies} series={series} />
        </div>
        <div>
          <DashboardActivityFeed events={history} />
        </div>
      </div>
    </div>
  );
}