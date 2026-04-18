import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import MediaCard from '@/components/shared/MediaCard';
import EmptyState from '@/components/shared/EmptyState';
import RequestDialog from '@/components/discover/RequestDialog';
import { Search, Loader2 } from 'lucide-react';

export default function DiscoverSearch({ query, existingMovies, existingSeries, requests }) {
  const [selectedItem, setSelectedItem] = useState(null);
  const navigate = useNavigate();

  const { data: searchResults, isLoading } = useQuery({
    queryKey: ['discover-search', query],
    queryFn: async () => {
      if (!query.trim()) return { movies: [], series: [] };
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `Search for movies and TV shows matching "${query}". Return up to 8 movies and 8 TV series that match. Include title, year, overview, genres, rating, tmdb_id. For movies include runtime. For TV include network, total_seasons.`,
        response_json_schema: {
          type: "object",
          properties: {
            movies: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  year: { type: "number" },
                  overview: { type: "string" },
                  genres: { type: "array", items: { type: "string" } },
                  rating: { type: "number" },
                  tmdb_id: { type: "string" },
                  runtime: { type: "number" }
                }
              }
            },
            series: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  title: { type: "string" },
                  year: { type: "number" },
                  overview: { type: "string" },
                  genres: { type: "array", items: { type: "string" } },
                  rating: { type: "number" },
                  tmdb_id: { type: "string" },
                  network: { type: "string" },
                  total_seasons: { type: "number" }
                }
              }
            }
          }
        },
        add_context_from_internet: true,
      });
      return result;
    },
    enabled: query.trim().length > 0,
    staleTime: 60000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
        <span className="ml-2 text-sm text-muted-foreground">Searching...</span>
      </div>
    );
  }

  const allResults = [
    ...(searchResults?.movies || []).map(m => ({ ...m, media_type: 'movie' })),
    ...(searchResults?.series || []).map(s => ({ ...s, media_type: 'series' })),
  ];

  return (
    <>
      {allResults.length === 0 && query.trim() ? (
        <EmptyState icon={Search} title="No results found" description={`No movies or series found for "${query}"`} />
      ) : (
        <>
          {searchResults?.movies?.length > 0 && (
          <>
          <h2 className="text-lg font-semibold mb-3">Movies</h2>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3 mb-8">
            {searchResults.movies.map((item, idx) => (
              <div key={idx} onClick={() => navigate(`/discover/movie/${item.tmdb_id}`)} className="cursor-pointer">
                <MediaCard item={item} type="movie" linkPrefix="" />
              </div>
            ))}
          </div>
          </>
          )}
          {searchResults?.series?.length > 0 && (
          <>
          <h2 className="text-lg font-semibold mb-3">TV Series</h2>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
            {searchResults.series.map((item, idx) => (
              <div key={idx} onClick={() => navigate(`/discover/series/${item.tmdb_id}`)} className="cursor-pointer">
                <MediaCard item={item} type="series" linkPrefix="" />
              </div>
            ))}
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