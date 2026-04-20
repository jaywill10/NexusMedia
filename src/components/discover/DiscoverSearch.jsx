import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useNavigate, Link } from 'react-router-dom';
import MediaCard from '@/components/shared/MediaCard';
import EmptyState from '@/components/shared/EmptyState';
import RequestDialog from '@/components/discover/RequestDialog';
import { Search, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function DiscoverSearch({ query, existingMovies, existingSeries, requests }) {
  const [selectedItem, setSelectedItem] = useState(null);
  const navigate = useNavigate();

  const { data: searchResults, isLoading, error } = useQuery({
    queryKey: ['discover-search', query],
    queryFn: () => base44.tmdb.search({ q: query }),
    enabled: query.trim().length > 0,
    staleTime: 60000,
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
        <span className="ml-2 text-sm text-muted-foreground">Searching...</span>
      </div>
    );
  }

  if (error) {
    const needsKey = error?.data?.error === 'no_api_key' || error?.data?.error === 'invalid_api_key';
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <AlertCircle className="w-8 h-8 text-muted-foreground mb-3" />
        <p className="text-sm font-medium mb-1">
          {needsKey ? 'TMDB API key required' : 'Search failed'}
        </p>
        <p className="text-xs text-muted-foreground max-w-md mb-4">
          {needsKey
            ? 'Add a free TMDB v3 API key in Settings → General to enable search.'
            : (error?.data?.error || error.message || 'Unknown error')}
        </p>
        {needsKey && (
          <Button asChild size="sm"><Link to="/settings">Open Settings</Link></Button>
        )}
      </div>
    );
  }

  const movies = searchResults?.movies || [];
  const series = searchResults?.series || [];
  const hasAny = movies.length > 0 || series.length > 0;

  const enrich = (item) => {
    if (item.media_type === 'movie') {
      const existing = existingMovies.find(m => m.tmdb_id === item.tmdb_id);
      const requested = requests.find(r => r.tmdb_id === item.tmdb_id && r.media_type === 'movie');
      return { ...item, library_status: existing?.library_status, request_status: requested?.status };
    }
    const existing = existingSeries.find(s => s.tmdb_id === item.tmdb_id);
    const requested = requests.find(r => r.tmdb_id === item.tmdb_id && r.media_type === 'series');
    return { ...item, library_status: existing ? 'available' : undefined, request_status: requested?.status };
  };

  return (
    <>
      {!hasAny && query.trim() ? (
        <EmptyState icon={Search} title="No results found" description={`No movies or series found for "${query}"`} />
      ) : (
        <>
          {movies.length > 0 && (
            <>
              <h2 className="text-lg font-semibold mb-3">Movies</h2>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3 mb-8">
                {movies.map((item) => {
                  const enriched = enrich(item);
                  return (
                    <div key={`m-${item.tmdb_id}`} onClick={() => navigate(`/discover/movie/${item.tmdb_id}`)} className="cursor-pointer">
                      <MediaCard item={enriched} type="movie" linkPrefix="" />
                    </div>
                  );
                })}
              </div>
            </>
          )}
          {series.length > 0 && (
            <>
              <h2 className="text-lg font-semibold mb-3">TV Series</h2>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
                {series.map((item) => {
                  const enriched = enrich(item);
                  return (
                    <div key={`s-${item.tmdb_id}`} onClick={() => navigate(`/discover/series/${item.tmdb_id}`)} className="cursor-pointer">
                      <MediaCard item={enriched} type="series" linkPrefix="" />
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </>
      )}

      {selectedItem && (
        <RequestDialog
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          existingMovies={existingMovies}
          existingSeries={existingSeries}
          requests={requests}
        />
      )}
    </>
  );
}
