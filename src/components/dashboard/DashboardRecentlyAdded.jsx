import React from 'react';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import MediaCard from '@/components/shared/MediaCard';
import EmptyState from '@/components/shared/EmptyState';
import { Film, Tv } from 'lucide-react';

export default function DashboardRecentlyAdded({ movies = [], series = [] }) {
  const recentMovies = movies.filter(m => m.library_status === 'available').slice(0, 8);
  const recentSeries = series.filter(s => s.episodes_available > 0).slice(0, 8);

  return (
    <Card className="p-4">
      <Tabs defaultValue="movies">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold">Recently Added</h3>
          <TabsList className="h-8 bg-secondary">
            <TabsTrigger value="movies" className="text-xs h-6">Movies</TabsTrigger>
            <TabsTrigger value="series" className="text-xs h-6">Series</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="movies">
          {recentMovies.length === 0 ? (
            <EmptyState icon={Film} title="No movies yet" description="Movies will appear here once added to your library" />
          ) : (
            <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
              {recentMovies.map(movie => (
                <MediaCard key={movie.id} item={movie} type="movie" showStatus={false} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="series">
          {recentSeries.length === 0 ? (
            <EmptyState icon={Tv} title="No series yet" description="Series will appear here once added to your library" />
          ) : (
            <div className="grid grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
              {recentSeries.map(s => (
                <MediaCard key={s.id} item={s} type="series" showStatus={false} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </Card>
  );
}