import React from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const statusConfig = {
  // Request statuses
  draft: { label: 'Draft', color: 'slate' },
  submitted: { label: 'Submitted', color: 'blue' },
  pending_approval: { label: 'Pending', color: 'yellow' },
  approved: { label: 'Approved', color: 'green' },
  declined: { label: 'Declined', color: 'red' },
  auto_approved: { label: 'Auto-Approved', color: 'emerald' },
  processing: { label: 'Processing', color: 'cyan' },
  partially_available: { label: 'Partial', color: 'orange' },
  available: { label: 'Available', color: 'green' },
  failed: { label: 'Failed', color: 'red' },
  canceled: { label: 'Canceled', color: 'slate' },
  // Library statuses
  missing: { label: 'Missing', color: 'red' },
  downloading: { label: 'Downloading', color: 'blue' },
  imported: { label: 'Imported', color: 'cyan' },
  cutoff_unmet: { label: 'Cutoff Unmet', color: 'orange' },
  cutoff_met: { label: 'Cutoff Met', color: 'green' },
  // Series statuses
  continuing: { label: 'Continuing', color: 'green' },
  ended: { label: 'Ended', color: 'slate' },
  upcoming: { label: 'Upcoming', color: 'blue' },
  // Queue statuses
  queued: { label: 'Queued', color: 'slate' },
  paused: { label: 'Paused', color: 'yellow' },
  completed: { label: 'Completed', color: 'green' },
  importing: { label: 'Importing', color: 'cyan' },
  warning: { label: 'Warning', color: 'yellow' },
  stalled: { label: 'Stalled', color: 'orange' },
  // Season
  partial: { label: 'Partial', color: 'orange' },
  complete: { label: 'Complete', color: 'green' },
  // Health
  healthy: { label: 'Healthy', color: 'green' },
  connected: { label: 'Connected', color: 'green' },
  disconnected: { label: 'Disconnected', color: 'red' },
  error: { label: 'Error', color: 'red' },
  unknown: { label: 'Unknown', color: 'slate' },
  // General
  true: { label: 'Yes', color: 'green' },
  false: { label: 'No', color: 'slate' },
};

export default function StatusBadge({ status, className }) {
  const config = statusConfig[status] || { label: status, color: 'slate' };
  return (
    <Badge
      variant="secondary"
      className={cn(
        `bg-${config.color}-500/20 text-${config.color}-400 border border-${config.color}-500/30 text-[11px] font-medium`,
        className
      )}
    >
      {config.label}
    </Badge>
  );
}