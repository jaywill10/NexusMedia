import React, { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { ArrowLeft, Star, Clock, Tv, Film, Check, Plus, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import StatusBadge from '@/components/shared/StatusBadge';
import RequestDialog from '@/components/discover/RequestDialog';
import { cn } from '@/lib/utils';

async function fetchTmdbDetail(mediaType, tmdbId) {
  if (mediaType === 'movie') return base44.tmdb.movie(tmdbId);
  return base44.tmdb.series(tmdbId);
}

export default function DiscoverDetail() {
  const { mediaType, tmdbId } = useParams();
  const navigate = useNavigate();
  const [selectedSeasons, setSelectedSeasons] = useState([]);
  const [requestItem, setRequestItem] = useState(null);

  const { data: detail, isLoading, error } = useQuery({
    queryKey: ['discover-detail', mediaType, tmdbId],
    queryFn: () => fetchTmdbDetail(mediaType, tmdbId),
    staleTime: 10 * 60 * 1000,
    retry: false,
  });

  const { data: existingMovies = [] } = useQuery({
    queryKey: ['movies'],
    queryFn: () => base44.entities.Movie.list('-created_date', 500),
    initialData: [],
  });

  const { data: existingSeries = [] } = useQuery({
    queryKey: ['series'],
    queryFn: () => base44.entities.Series.list('-created_date', 500),
    initialData: [],
  });

  const { data: requests = [] } = useQuery({
    queryKey: ['requests'],
    queryFn: () => base44.entities.Request.list('-created_date', 200),
    initialData: [],
  });

  const inLibraryMovie = existingMovies.find(m => m.tmdb_id === tmdbId);
  const inLibrarySeries = existingSeries.find(s => s.tmdb_id === tmdbId);
  const inLibrary = mediaType === 'movie' ? inLibraryMovie : inLibrarySeries;
  const existingRequest = requests.find(r => r.tmdb_id === tmdbId);

  const getStatusInfo = () => {
    if (inLibrary?.library_status === 'available') return { label: 'In Library', color: 'green', link: mediaType === 'movie' ? `/movies/${inLibrary.id}` : `/series/${inLibrary.id}` };
    if (inLibrary?.library_status === 'downloading') return { label: 'Downloading', color: 'blue' };
    if (existingRequest?.status === 'available') return { label: 'Available', color: 'green' };
    if (existingRequest?.status === 'approved' || existingRequest?.status === 'processing') return { label: 'Approved', color: 'cyan' };
    if (existingRequest?.status === 'pending_approval' || existingRequest?.status === 'submitted') return { label: 'Requested', color: 'yellow' };
    return { label: 'Not Requested', color: 'slate' };
  };

  const statusInfo = getStatusInfo();

  const toggleSeason = (num) => {
    setSelectedSeasons(s => s.includes(num) ? s.filter(n => n !== num) : [...s, num]);
  };

  const handleRequest = (seasons) => {
    if (!detail) return;
    setRequestItem({
      title: detail.title,
      media_type: mediaType,
      tmdb_id: tmdbId,
      poster_url: detail.poster_url,
      backdrop_url: detail.backdrop_url,
      year: detail.year,
      overview: detail.overview,
      rating: detail.rating,
      seasons: seasons,
    });
  };

  if (isLoading) {
    return (
      <div>
        <Button variant="ghost" size="sm" className="mb-4 gap-1.5" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4" /> Back
        </Button>
        <div className="space-y-4">
          <Skeleton className="h-64 w-full rounded-xl" />
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      </div>
    );
  }

  if (error || !detail) {
    const needsKey = error?.data?.error === 'no_api_key' || error?.data?.error === 'invalid_api_key';
    return (
      <div className="text-center py-16">
        <Button variant="ghost" size="sm" className="mb-4 gap-1.5" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4" /> Back
        </Button>
        <p className="text-sm font-medium mb-1">
          {needsKey ? 'TMDB API key required' : 'Failed to load details'}
        </p>
        <p className="text-xs text-muted-foreground max-w-md mx-auto">
          {needsKey
            ? 'Add a free TMDB v3 API key in Settings → General.'
            : (error?.data?.error || error?.message || '')}
        </p>
        {needsKey && (
          <Button asChild size="sm" className="mt-4"><Link to="/settings">Open Settings</Link></Button>
        )}
      </div>
    );
  }

  const seasons = detail.total_seasons > 0
    ? Array.from({ length: detail.total_seasons }, (_, i) => i + 1)
    : [];

  return (
    <div>
      <Button variant="ghost" size="sm" className="mb-4 gap-1.5" onClick={() => navigate(-1)}>
        <ArrowLeft className="w-4 h-4" /> Back to Discover
      </Button>

      {/* Hero */}
      <div className="relative rounded-xl overflow-hidden mb-6 h-72">
        {detail.backdrop_url && (
          <img src={detail.backdrop_url} alt="" className="w-full h-full object-cover opacity-40" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-background/90 to-transparent" />
        <div className="absolute inset-0 flex items-end p-6">
          <div className="flex gap-6">
            {detail.poster_url && (
              <img src={detail.poster_url} alt={detail.title} className="w-28 h-40 object-cover rounded-lg shadow-xl shrink-0" />
            )}
            <div className="pb-2">
              <div className="flex items-center gap-2 mb-2">
                <Badge className={`bg-${statusInfo.color}-500/20 text-${statusInfo.color}-400 border-${statusInfo.color}-500/30 text-xs`}>
                  {statusInfo.label}
                </Badge>
                {detail.certification && <Badge variant="outline" className="text-[10px]">{detail.certification}</Badge>}
              </div>
              <h1 className="text-3xl font-bold">{detail.title}</h1>
              <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground flex-wrap">
                {detail.year && <span>{detail.year}</span>}
                {detail.runtime && <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{detail.runtime}m</span>}
                {detail.total_seasons > 0 && <span className="flex items-center gap-1"><Tv className="w-3.5 h-3.5" />{detail.total_seasons} seasons</span>}
                {detail.rating > 0 && <span className="flex items-center gap-1"><Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />{detail.rating?.toFixed(1)}</span>}
                {detail.network && <span>{detail.network}</span>}
              </div>
              {detail.genres?.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {detail.genres.map(g => <Badge key={g} variant="secondary" className="text-xs">{g}</Badge>)}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Overview */}
      {detail.overview && (
        <p className="text-sm text-muted-foreground leading-relaxed mb-6 max-w-3xl">{detail.overview}</p>
      )}

      {/* Action area */}
      {statusInfo.link ? (
        <div className="flex items-center gap-3 mb-6">
          <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-sm px-3 py-1.5 gap-1.5">
            <Check className="w-4 h-4" /> In Library
          </Badge>
          <Button asChild variant="outline" size="sm" className="gap-1.5">
            <Link to={statusInfo.link}><ExternalLink className="w-4 h-4" />View in Library</Link>
          </Button>
        </div>
      ) : mediaType === 'movie' ? (
        <div className="mb-6">
          {existingRequest ? (
            <Badge className={`bg-${statusInfo.color}-500/20 text-${statusInfo.color}-400 border-${statusInfo.color}-500/30 text-sm px-3 py-1.5`}>
              {statusInfo.label}
            </Badge>
          ) : (
            <Button onClick={() => handleRequest(null)} className="gap-1.5">
              <Plus className="w-4 h-4" /> Request Movie
            </Button>
          )}
        </div>
      ) : (
        /* Series season selector */
        <div className="mb-6">
          <h3 className="text-sm font-semibold mb-3">Select Seasons to Request</h3>
          {seasons.length > 0 ? (
            <>
              <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2 mb-4">
                {seasons.map(num => {
                  const isSelected = selectedSeasons.includes(num);
                  return (
                    <div
                      key={num}
                      className={cn(
                        "rounded-lg border p-3 text-center cursor-pointer transition-all",
                        isSelected ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-primary/50"
                      )}
                      onClick={() => toggleSeason(num)}
                    >
                      <div className="text-xs text-muted-foreground">S</div>
                      <div className="text-lg font-bold">{num}</div>
                    </div>
                  );
                })}
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={() => handleRequest(selectedSeasons)}
                  disabled={selectedSeasons.length === 0}
                  className="gap-1.5"
                >
                  <Plus className="w-4 h-4" /> Request {selectedSeasons.length > 0 ? `${selectedSeasons.length} Season${selectedSeasons.length > 1 ? 's' : ''}` : 'Seasons'}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleRequest(seasons)}
                  className="gap-1.5"
                >
                  Request All {detail.total_seasons} Seasons
                </Button>
              </div>
            </>
          ) : (
            <Button onClick={() => handleRequest([])} className="gap-1.5">
              <Plus className="w-4 h-4" /> Request Series
            </Button>
          )}
        </div>
      )}

      {requestItem && (
        <RequestDialog
          item={requestItem}
          existingMovies={existingMovies}
          existingSeries={existingSeries}
          existingRequests={requests}
          onClose={() => setRequestItem(null)}
          onSuccess={() => setRequestItem(null)}
        />
      )}
    </div>
  );
}