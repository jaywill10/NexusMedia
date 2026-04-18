import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { AlertCircle, Film, Tv, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import PageHeader from '@/components/shared/PageHeader';
import StatusBadge from '@/components/shared/StatusBadge';
import EmptyState from '@/components/shared/EmptyState';
import { toast } from 'sonner';

export default function WantedPage() {
  const [searchParams] = useSearchParams();
  const defaultTab = searchParams.get('tab') || 'missing-movies';

  const { data: movies = [] } = useQuery({
    queryKey: ['wanted-movies'],
    queryFn: () => base44.entities.Movie.filter({ library_status: 'missing', monitored: true }, '-added_date', 200),
    initialData: [],
  });

  const { data: cutoffMovies = [] } = useQuery({
    queryKey: ['cutoff-movies'],
    queryFn: () => base44.entities.Movie.filter({ library_status: 'cutoff_unmet', monitored: true }, '-added_date', 200),
    initialData: [],
  });

  const { data: episodes = [] } = useQuery({
    queryKey: ['wanted-episodes'],
    queryFn: () => base44.entities.Episode.filter({ status: 'missing', monitored: true }, '-air_date', 200),
    initialData: [],
  });

  const { data: cutoffEpisodes = [] } = useQuery({
    queryKey: ['cutoff-episodes'],
    queryFn: () => base44.entities.Episode.filter({ status: 'cutoff_unmet', monitored: true }, '-air_date', 200),
    initialData: [],
  });

  const { data: series = [] } = useQuery({
    queryKey: ['series-all'],
    queryFn: () => base44.entities.Series.list('-title', 500),
    initialData: [],
  });

  const getSeriesTitle = (series_id) => series.find(s => s.id === series_id)?.title || series_id;

  const logSearch = async (items, mediaType) => {
    for (const item of items) {
      await base44.entities.HistoryEvent.create({
        event_type: 'searched',
        media_type: mediaType,
        media_id: item.id,
        media_title: item.title || item.title,
        success: true,
      });
    }
  };

  return (
    <div>
      <PageHeader title="Wanted" description="Missing and cutoff unmet items">
        <Button size="sm" className="gap-1.5" onClick={async () => {
          await logSearch([...movies, ...episodes], 'movie');
          toast.success('Search started for all wanted items');
        }}>
          <Search className="w-4 h-4" /> Search All Wanted
        </Button>
      </PageHeader>

      <Tabs defaultValue={defaultTab}>
        <TabsList className="bg-secondary mb-4">
          <TabsTrigger value="missing-movies" className="gap-1.5 text-xs">
            <Film className="w-3 h-3" /> Missing Movies ({movies.length})
          </TabsTrigger>
          <TabsTrigger value="missing-episodes" className="gap-1.5 text-xs">
            <Tv className="w-3 h-3" /> Missing Episodes ({episodes.length})
          </TabsTrigger>
          <TabsTrigger value="cutoff-movies" className="gap-1.5 text-xs">
            <Film className="w-3 h-3" /> Cutoff Movies ({cutoffMovies.length})
          </TabsTrigger>
          <TabsTrigger value="cutoff-episodes" className="gap-1.5 text-xs">
            <Tv className="w-3 h-3" /> Cutoff Episodes ({cutoffEpisodes.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="missing-movies">
          <div className="flex justify-between items-center mb-3">
            <p className="text-sm text-muted-foreground">{movies.length} missing movies</p>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={async () => {
              await logSearch(movies, 'movie');
              toast.success(`Searching for ${movies.length} movies`);
            }}><Search className="w-3 h-3" /> Search All</Button>
          </div>
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Year</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Profile</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {movies.length === 0 ? (
                  <TableRow><TableCell colSpan={5}><EmptyState icon={Film} title="No missing movies" /></TableCell></TableRow>
                ) : movies.map(movie => (
                  <TableRow key={movie.id}>
                    <TableCell>
                      <Link to={`/movies/${movie.id}`} className="font-medium text-sm hover:text-primary">{movie.title}</Link>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{movie.year || '—'}</TableCell>
                    <TableCell><StatusBadge status="missing" /></TableCell>
                    <TableCell className="text-sm text-muted-foreground">{movie.quality_profile_id || 'Default'}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={async () => {
                        await base44.entities.HistoryEvent.create({ event_type: 'searched', media_type: 'movie', media_id: movie.id, media_title: movie.title, success: true });
                        toast.success(`Searching for ${movie.title}`);
                      }}>
                        <Search className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="missing-episodes">
          <div className="flex justify-between items-center mb-3">
            <p className="text-sm text-muted-foreground">{episodes.length} missing episodes</p>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={async () => {
              await logSearch(episodes, 'episode');
              toast.success(`Searching for ${episodes.length} episodes`);
            }}><Search className="w-3 h-3" /> Search All</Button>
          </div>
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Series</TableHead>
                  <TableHead>Episode</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Air Date</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {episodes.length === 0 ? (
                  <TableRow><TableCell colSpan={5}><EmptyState icon={Tv} title="No missing episodes" /></TableCell></TableRow>
                ) : episodes.map(ep => (
                  <TableRow key={ep.id}>
                    <TableCell className="font-medium text-sm">
                      <Link to={`/series/${ep.series_id}`} className="hover:text-primary">{getSeriesTitle(ep.series_id)}</Link>
                    </TableCell>
                    <TableCell className="text-sm font-mono">S{String(ep.season_number).padStart(2,'0')}E{String(ep.episode_number).padStart(2,'0')}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{ep.title || '—'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{ep.air_date || '—'}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={async () => {
                        await base44.entities.HistoryEvent.create({ event_type: 'searched', media_type: 'episode', media_id: ep.id, media_title: ep.title || 'Episode', success: true });
                        toast.success('Search started');
                      }}><Search className="w-4 h-4" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="cutoff-movies">
          <div className="flex justify-between items-center mb-3">
            <p className="text-sm text-muted-foreground">{cutoffMovies.length} movies below cutoff</p>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={async () => {
              await logSearch(cutoffMovies, 'movie');
              toast.success(`Searching for ${cutoffMovies.length} movies`);
            }}><Search className="w-3 h-3" /> Search All</Button>
          </div>
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Current Quality</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cutoffMovies.length === 0 ? (
                  <TableRow><TableCell colSpan={4}><EmptyState icon={AlertCircle} title="No cutoff unmet movies" /></TableCell></TableRow>
                ) : cutoffMovies.map(movie => (
                  <TableRow key={movie.id}>
                    <TableCell>
                      <Link to={`/movies/${movie.id}`} className="font-medium text-sm hover:text-primary">{movie.title}</Link>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{movie.quality || '—'}</TableCell>
                    <TableCell><StatusBadge status="cutoff_unmet" /></TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={async () => {
                        await base44.entities.HistoryEvent.create({ event_type: 'searched', media_type: 'movie', media_id: movie.id, media_title: movie.title, success: true });
                        toast.success(`Searching for ${movie.title}`);
                      }}><Search className="w-4 h-4" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="cutoff-episodes">
          <div className="flex justify-between items-center mb-3">
            <p className="text-sm text-muted-foreground">{cutoffEpisodes.length} episodes below cutoff</p>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={async () => {
              await logSearch(cutoffEpisodes, 'episode');
              toast.success(`Searching for ${cutoffEpisodes.length} episodes`);
            }}><Search className="w-3 h-3" /> Search All</Button>
          </div>
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Series</TableHead>
                  <TableHead>Episode</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Current Quality</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cutoffEpisodes.length === 0 ? (
                  <TableRow><TableCell colSpan={5}><EmptyState icon={AlertCircle} title="No cutoff unmet episodes" /></TableCell></TableRow>
                ) : cutoffEpisodes.map(ep => (
                  <TableRow key={ep.id}>
                    <TableCell className="font-medium text-sm">
                      <Link to={`/series/${ep.series_id}`} className="hover:text-primary">{getSeriesTitle(ep.series_id)}</Link>
                    </TableCell>
                    <TableCell className="text-sm font-mono">S{String(ep.season_number).padStart(2,'0')}E{String(ep.episode_number).padStart(2,'0')}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{ep.title || '—'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{ep.quality || '—'}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={async () => {
                        await base44.entities.HistoryEvent.create({ event_type: 'searched', media_type: 'episode', media_id: ep.id, media_title: ep.title || 'Episode', success: true });
                        toast.success('Search started');
                      }}><Search className="w-4 h-4" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}