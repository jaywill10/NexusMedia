import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Compass, Search, Film, Tv, TrendingUp, Star, Sparkles, Clock } from 'lucide-react';

import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import PageHeader from '@/components/shared/PageHeader';
import DiscoverGrid from '@/components/discover/DiscoverGrid';
import DiscoverSearch from '@/components/discover/DiscoverSearch';

const genres = [
  'Action', 'Adventure', 'Animation', 'Comedy', 'Crime', 'Documentary',
  'Drama', 'Family', 'Fantasy', 'Horror', 'Music', 'Mystery',
  'Romance', 'Science Fiction', 'Thriller', 'War', 'Western'
];

const networks = ['Netflix', 'HBO', 'Disney+', 'Amazon', 'Apple TV+', 'Hulu', 'Peacock', 'AMC', 'FX', 'Showtime', 'BBC', 'ABC', 'NBC', 'CBS', 'FOX'];
const studios = ['Marvel Studios', 'Warner Bros.', 'Universal', 'Disney', 'Paramount', 'Sony Pictures', 'A24', '20th Century Studios', 'Lionsgate', 'DreamWorks'];

export default function Discover() {
  const [searchParams] = useSearchParams();
  const initialQuery = searchParams.get('q') || '';
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [activeTab, setActiveTab] = useState('trending');
  const [selectedGenre, setSelectedGenre] = useState(null);
  const [mediaTypeFilter, setMediaTypeFilter] = useState('all');
  const [selectedNetwork, setSelectedNetwork] = useState(null);
  const [selectedStudio, setSelectedStudio] = useState(null);

  useEffect(() => {
    if (initialQuery) setSearchQuery(initialQuery);
  }, [initialQuery]);

  // Get existing library items for matching
  const { data: existingMovies = [] } = useQuery({
    queryKey: ['library-movies'],
    queryFn: () => base44.entities.Movie.list('-created_date', 500),
    initialData: [],
  });

  const { data: existingSeries = [] } = useQuery({
    queryKey: ['library-series'],
    queryFn: () => base44.entities.Series.list('-created_date', 500),
    initialData: [],
  });

  const { data: requests = [] } = useQuery({
    queryKey: ['all-requests-discover'],
    queryFn: () => base44.entities.Request.list('-created_date', 500),
    initialData: [],
  });

  return (
    <div>
      <PageHeader title="Discover" description="Browse and search for movies and TV series" />

      {/* Search */}
      <div className="relative max-w-2xl mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search for movies, TV shows, people..."
          className="pl-9 h-11 bg-secondary border-0 text-base"
        />
      </div>

      {/* Media type toggle */}
      <div className="flex gap-1 mb-4">
        {['all', 'movie', 'series'].map(type => (
          <Button
            key={type}
            size="sm"
            variant={mediaTypeFilter === type ? 'default' : 'secondary'}
            className="h-7 text-xs capitalize"
            onClick={() => { setMediaTypeFilter(type); setSelectedNetwork(null); setSelectedStudio(null); }}
          >
            {type === 'all' ? 'All' : type === 'movie' ? <><Film className="w-3 h-3 mr-1" />Movies</> : <><Tv className="w-3 h-3 mr-1" />Series</>}
          </Button>
        ))}
      </div>

      {searchQuery.trim() ? (
        <DiscoverSearch
          query={searchQuery}
          existingMovies={existingMovies}
          existingSeries={existingSeries}
          requests={requests}
        />
      ) : (
        <>
          {/* Category tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="mb-4">
            <TabsList className="bg-secondary h-9">
              <TabsTrigger value="trending" className="text-xs gap-1.5">
                <TrendingUp className="w-3 h-3" /> Trending
              </TabsTrigger>
              <TabsTrigger value="popular" className="text-xs gap-1.5">
                <Sparkles className="w-3 h-3" /> Popular
              </TabsTrigger>
              <TabsTrigger value="top_rated" className="text-xs gap-1.5">
                <Star className="w-3 h-3" /> Top Rated
              </TabsTrigger>
              <TabsTrigger value="upcoming" className="text-xs gap-1.5">
                <Clock className="w-3 h-3" /> Upcoming
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Genre filter */}
          <div className="flex flex-wrap gap-1.5 mb-3">
            <Button variant={selectedGenre === null ? "default" : "secondary"} size="sm" className="h-7 text-xs" onClick={() => setSelectedGenre(null)}>All</Button>
            {genres.map(g => (
              <Button key={g} variant={selectedGenre === g ? "default" : "secondary"} size="sm" className="h-7 text-xs" onClick={() => setSelectedGenre(selectedGenre === g ? null : g)}>
                {g}
              </Button>
            ))}
          </div>

          {/* Networks row */}
          {(mediaTypeFilter === 'all' || mediaTypeFilter === 'series') && (
            <div className="mb-3">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5">Networks</p>
              <div className="flex gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                {networks.map(n => (
                  <Button key={n} variant={selectedNetwork === n ? "default" : "secondary"} size="sm" className="h-7 text-xs whitespace-nowrap shrink-0"
                    onClick={() => setSelectedNetwork(selectedNetwork === n ? null : n)}>
                    {n}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Studios row */}
          {(mediaTypeFilter === 'all' || mediaTypeFilter === 'movie') && (
            <div className="mb-5">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5">Studios</p>
              <div className="flex gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
                {studios.map(s => (
                  <Button key={s} variant={selectedStudio === s ? "default" : "secondary"} size="sm" className="h-7 text-xs whitespace-nowrap shrink-0"
                    onClick={() => setSelectedStudio(selectedStudio === s ? null : s)}>
                    {s}
                  </Button>
                ))}
              </div>
            </div>
          )}

          <DiscoverGrid
            category={activeTab}
            genre={selectedGenre}
            mediaTypeFilter={mediaTypeFilter}
            selectedNetwork={selectedNetwork}
            selectedStudio={selectedStudio}
            existingMovies={existingMovies}
            existingSeries={existingSeries}
            requests={requests}
          />
        </>
      )}
    </div>
  );
}