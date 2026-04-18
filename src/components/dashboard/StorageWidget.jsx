import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { FolderOpen, Settings } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default function StorageWidget() {
  const { data: folders = [] } = useQuery({
    queryKey: ['root-folders'],
    queryFn: () => base44.entities.RootFolder.list(),
    initialData: [],
  });

  if (folders.length === 0) {
    return (
      <Card className="p-4 mb-6 border-dashed border-muted-foreground/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FolderOpen className="w-5 h-5 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">No Storage Configured</p>
              <p className="text-xs text-muted-foreground">Configure root folders to monitor disk usage</p>
            </div>
          </div>
          <Button asChild size="sm" variant="outline" className="gap-1.5">
            <Link to="/settings"><Settings className="w-4 h-4" /> Configure</Link>
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="mb-6">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Storage</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {folders.map(folder => {
          const used = (folder.total_space || 0) - (folder.free_space || 0);
          const total = folder.total_space || 0;
          const pct = total > 0 ? Math.round((used / total) * 100) : 0;
          const freeGB = folder.free_space ? (folder.free_space / 1099511627776).toFixed(1) : null;
          const totalGB = folder.total_space ? (folder.total_space / 1099511627776).toFixed(1) : null;
          const isLow = pct > 80;
          const isCritical = pct > 90;

          return (
            <Card key={folder.id} className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <FolderOpen className="w-4 h-4 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{folder.name}</p>
                  <p className="text-[10px] text-muted-foreground font-mono truncate">{folder.path}</p>
                </div>
              </div>
              {total > 0 ? (
                <>
                  <Progress
                    value={pct}
                    className={cn(
                      "h-2 mb-2",
                      isCritical ? "[&>div]:bg-red-500" : isLow ? "[&>div]:bg-yellow-500" : "[&>div]:bg-primary"
                    )}
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span className={isCritical ? 'text-red-400' : isLow ? 'text-yellow-400' : ''}>{pct}% used</span>
                    <span>{freeGB} TB free {totalGB ? `of ${totalGB} TB` : ''}</span>
                  </div>
                </>
              ) : (
                <p className="text-xs text-muted-foreground">Space data unavailable</p>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}