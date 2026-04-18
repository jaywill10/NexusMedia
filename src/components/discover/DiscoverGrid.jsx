import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import MediaCard from '@/components/shared/MediaCard';
import EmptyState from '@/components/shared/EmptyState';
import { Compass, Loader2 } from 'lucide-react';
import RequestDialog from '@/components/discover/RequestDialog';

export default function DiscoverGrid({ category, genre, mediaTypeFilter = 'all', selectedNetwork = null, selectedStudio = null, existingMovies, existingSeries, requests }) {
  const [selectedItem, setSelectedItem] = useState(null);
  const navigate = useNavigate();

  const { data: discoverData, isLoading } = useQuery({
    queryKey: ['discover', category, genre, mediaTypeFilter, selectedNetwork, selectedStudio],
    queryFn: async () => {
      const typeConstraint = mediaTypeFilter === 'movie' ? 'movies only (no TV series)' : mediaTypeFilter === 'series' ? 'TV series only (no movies)' : 'a mix of 12 movies and 12 TV series';
      const networkConstraint = selectedNetwork ? ` from ${selectedNetwork}` : '';
      const studioConstraint = selectedStudio ? ` from ${selectedStudio}` : '';
      const genreConstraint = genre ? ` in the ${genre} genre` : '';
      const prompt = `Generate a list of 24 ${category === 'upcoming' ? 'upcoming' : category === 'top_rated' ? 'top rated' : category} ${typeConstraint}${genreConstraint}${networkConstraint}${studioConstraint}. For each, include title, year, overview (2 sentences), genres array, rating (out of 10), and a tmdb_id (make it realistic). For movies include runtime and studio. For TV include network, total_seasons, total_episodes.`;

      const result = await base44.integrations.Core.InvokeLLM({
        prompt,
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
                  runtime: { type: "number" },
                  poster_url: { type: "string" }
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
                  total_seasons: { type: "number" },
                  total_episodes: { type: "number" },
                  poster_url: { type: "string" }
                }
              }
            }
          }
        }
      });
      return result;
    },
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
        <span className="ml-2 text-sm text-muted-foreground">Loading discoveries...</span>
      </div>
    );
  }

  const allItems = [
    ...(mediaTypeFilter !== 'series' ? (discoverData?.movies || []).map(m => ({ ...m, media_type: 'movie' })) : []),
    ...(mediaTypeFilter !== 'movie' ? (discoverData?.series || []).map(s => ({ ...s, media_type: 'series' })) : []),
  ];

  // Enrich with library status
  const enrichedItems = allItems.map(item => {
    if (item.media_type === 'movie') {
      const existing = existingMovies.find(m => m.title === item.title && m.year === item.year);
      const requested = requests.find(r => r.title === item.title && r.media_type === 'movie');
      return { ...item, library_status: existing?.library_status, request_status: requested?.status, id: existing?.id || item.tmdb_id };
    } else {
      const existing = existingSeries.find(s => s.title === item.title);
      const requested = requests.find(r => r.title === item.title && r.media_type === 'series');
      return { ...item, library_status: existing ? 'available' : undefined, request_status: requested?.status, id: existing?.id || item.tmdb_id };
    }
  });

  return (
    <>
      {enrichedItems.length === 0 ? (
        <EmptyState icon={Compass} title="No results" description="Try a different category or genre" />
      ) : (
        <>
          {/* Movies */}
          <h2 className="text-lg font-semibold mb-3">Movies</h2>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3 mb-8">
            {enrichedItems.filter(i => i.media_type === 'movie').map((item, idx) => (
              <div key={idx} onClick={() => navigate(`/discover/movie/${item.tmdb_id}`)} className="cursor-pointer">
                <MediaCard item={item} type="movie" linkPrefix="" />
              </div>
            ))}
          </div>

          {/* Series */}
          <h2 className="text-lg font-semibold mb-3">TV Series</h2>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
            {enrichedItems.filter(i => i.media_type === 'series').map((item, idx) => (
              <div key={idx} onClick={() => navigate(`/discover/series/${item.tmdb_id}`)} className="cursor-pointer">
                <MediaCard item={item} type="series" linkPrefix="" />
              </div>
            ))}
          </div>
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