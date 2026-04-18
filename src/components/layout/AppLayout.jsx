import React, { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import { cn } from '@/lib/utils';

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  const { data: requests = [] } = useQuery({
    queryKey: ['requests-pending'],
    queryFn: () => base44.entities.Request.filter({ status: 'pending_approval' }),
    initialData: [],
  });

  const { data: queueItems = [] } = useQuery({
    queryKey: ['queue-active'],
    queryFn: () => base44.entities.DownloadQueueItem.filter({ status: 'downloading' }),
    initialData: [],
  });

  const badgeCounts = {
    requests: requests.length,
    queue: queueItems.length,
  };

  return (
    <div className="min-h-screen bg-background">
      <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} badgeCounts={badgeCounts} />
      <div className={cn("transition-all duration-300", collapsed ? "ml-16" : "ml-60")}>
        <TopBar user={user} />
        <main className="p-6">
          <Outlet context={{ user }} />
        </main>
      </div>
    </div>
  );
}