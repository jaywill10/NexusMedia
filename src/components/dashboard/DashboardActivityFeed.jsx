import React from 'react';
import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { format } from 'date-fns';
import {
  MessageSquare, CheckCircle, Search, Download, FolderInput, XCircle,
  RefreshCw, Trash2, ArrowUpCircle, Shield, Activity
} from 'lucide-react';
import EmptyState from '@/components/shared/EmptyState';

const eventIcons = {
  requested: MessageSquare,
  approved: CheckCircle,
  declined: XCircle,
  searched: Search,
  grabbed: Download,
  download_started: Download,
  download_completed: CheckCircle,
  download_failed: XCircle,
  imported: FolderInput,
  import_failed: XCircle,
  renamed: RefreshCw,
  deleted: Trash2,
  upgraded: ArrowUpCircle,
  blocklisted: Shield,
};

const eventColors = {
  requested: 'text-blue-400',
  approved: 'text-green-400',
  declined: 'text-red-400',
  searched: 'text-cyan-400',
  grabbed: 'text-blue-400',
  download_started: 'text-blue-400',
  download_completed: 'text-green-400',
  download_failed: 'text-red-400',
  imported: 'text-emerald-400',
  import_failed: 'text-red-400',
  deleted: 'text-red-400',
  upgraded: 'text-purple-400',
};

export default function DashboardActivityFeed({ events = [] }) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Activity className="w-4 h-4 text-primary" />
          Recent Activity
        </h3>
      </div>

      {events.length === 0 ? (
        <EmptyState title="No recent activity" icon={Activity} />
      ) : (
        <div className="space-y-3">
          {events.slice(0, 15).map(event => {
            const Icon = eventIcons[event.event_type] || Activity;
            const color = eventColors[event.event_type] || 'text-muted-foreground';
            return (
              <div key={event.id} className="flex items-start gap-3">
                <div className="mt-0.5">
                  <Icon className={`w-3.5 h-3.5 ${color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">
                    {event.media_id ? (
                      <Link
                        to={event.media_type === 'movie' ? `/movies/${event.media_id}` : `/series/${event.media_id}`}
                        className="font-medium hover:text-primary transition-colors"
                      >
                        {event.media_title}
                      </Link>
                    ) : (
                      <span className="font-medium">{event.media_title}</span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {event.event_type?.replace(/_/g, ' ')}
                    {event.quality && ` · ${event.quality}`}
                  </p>
                </div>
                <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                  {event.created_date ? format(new Date(event.created_date), 'HH:mm') : ''}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}