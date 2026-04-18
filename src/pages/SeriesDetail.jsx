import React, { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  ArrowLeft, Search, Bell, BellOff, MoreHorizontal, Trash2,
  RefreshCw, Star, ChevronDown, ChevronRight, CheckCircle2,
  AlertCircle, Tv, Clock, Plus, XCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import StatusBadge from '@/components/shared/StatusBadge';
import EmptyState from '@/components/shared/EmptyState';
import InteractiveSearchDrawer from '@/components/search/InteractiveSearchDrawer';
import RequestMoreSeasonsDialog from '@/components/series/RequestMoreSeasonsDialog';
import { toast } from 'sonner';
import { format, formatDistanceToNow, isValid, isFuture } from 'date-fns';
import { useAuth } from '@/lib/AuthContext';

const EVENT_DESCRIPTIONS = {
  grabbed: (e) => `Grabbed ${e.source_info || 'release'}`,
  imported: (e) => `Imported to library${e.details ? ': ' + e.details : ''}`,
  import_failed: (e) => `Import failed${e.error_details ? ': ' + e.error_details : ''}`,
  searched: () => 'Automatic search triggered',
  upgraded: (e) => `Upgraded quality${e.details ? ': ' + e.details : ''}`,
  deleted: () => 'File deleted from disk',
  approved: (e) => `Request approved${e.user_email ? ' by ' + e.user_email : ''}`,
  declined: (e) => `Request declined${e.details ? ': ' + e.details : ''}`,
  renamed: () => 'File renamed',
  blocklisted: (e) => `Release blocklisted${e.source_info ? ': ' + e.source_info : ''}`,
  metadata_refreshed: () => 'Metadata refreshed',
  manual_import: (e) => `Manually imported${e.details ? ': ' + e.details : ''}`,
  download_failed: (e) => `Download failed${e.error_details ? ': ' + e.error_details : ''}`,
  download_completed: () => 'Download completed',
  download_started: () => 'Download started',
  quality_changed: (e) => `Quality changed${e.details ? ': ' + e.details : ''}`,
};

function EpisodeRow({ ep, seriesId, seriesTitle, series, queryClient }) {
  const [searchOpen, setSearchOpen] = useState(false);
  const updateEpMutation = useMutation({
    mutationFn: (data) => base44.entities.Episode.update(ep.id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['episodes', seriesId] }),
  });

  const isUnaired = ep.air_date && isFuture(new Date(ep.air_date));
  const isMissing = !ep.has_file && ep.monitored && !isUnaired;

  return (
    <>
      <div className="flex items-center gap-3 px-4 py-2.5 hover:bg-secondary/30 transition-colors border-b border-border/50 last:border-0 group">
        {ep.has_file
          ? <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
          : isUnaired
          ? <Clock className="w-4 h-4 text-blue-400 shrink-0" />
          : <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
        }
        <span className="text-xs text-muted-foreground font-mono w-12 shrink-0">
          E{String(ep.episode_number).padStart(2, '0')}
        </span>
        <span className="text-sm flex-1 truncate">{ep.title || `Episode ${ep.episode_number}`}</span>
        {ep.air_date && <span className="text-xs text-muted-foreground">{ep.air_date}</span>}

        {/* Action row — always visible on hover */}
        <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
          {ep.has_file && ep.quality && <Badge variant="outline" className="text-[10px]">{ep.quality}</Badge>}
          {ep.has_file && ep.file_size && <span className="text-[10px] text-muted-foreground">{(ep.file_size / 1073741824).toFixed(1)}GB</span>}
          {isUnaired && <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-[10px]">Unaired</Badge>}
          {isMissing && <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-[10px]">Missing</Badge>}

          <Switch
            checked={ep.monitored !== false}
            onCheckedChange={v => updateEpMutation.mutate({ monitored: v })}
            className="scale-75"
          />

          {/* Interactive Search — always shown (like Sonarr) */}
          {!isUnaired && (
            <Button variant="ghost" size="icon" className="h-6 w-6" title="Interactive Search" onClick={() => setSearchOpen(true)}>
              <Search className="w-3 h-3" />
            </Button>
          )}

          {ep.has_file && (
            <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={() => {
              updateEpMutation.mutate({ has_file: false, file_path: null });
              toast.success('File deleted');
            }}>
              <Trash2 className="w-3 h-3" />
            </Button>
          )}
        </div>
      </div>

      <InteractiveSearchDrawer
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        media={series}
        mediaType="series"
        seasonNumber={ep.season_number}
        episodeNumber={ep.episode_number}
      />
    </>
  );
}

function SeasonRow({ season, episodes, seriesId, seriesTitle, series, queryClient }) {
  const [expanded, setExpanded] = useState(false);
  const eps = episodes.filter(e => e.season_number === season.season_number)
    .sort((a, b) => a.episode_number - b.episode_number);
  const available = eps.filter(e => e.has_file).length;
  const total = eps.length || season.episode_count || 0;
  const pct = total > 0 ? Math.round((available / total) * 100) : 0;

  const updateSeasonMutation = useMutation({
    mutationFn: (data) => base44.entities.Season.update(season.id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['seasons', seriesId] }),
  });

  const handleSearchSeason = async (e) => {
    e.stopPropagation();
    toast.success(`Searching Season ${season.season_number}`);
    await base44.entities.HistoryEvent.create({
      event_type: 'searched',
      media_type: 'series',
      media_id: seriesId,
      media_title: `${seriesTitle} Season ${season.season_number}`,
      season_number: season.season_number,
      success: true,
    });
    queryClient.invalidateQueries({ queryKey: ['history', 'series', seriesId] });
  };

  return (
    <Card className="overflow-hidden">
      <div
        className="flex items-center gap-4 p-4 cursor-pointer hover:bg-secondary/40 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" /> : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />}
        <div className="w-8 h-8 rounded bg-secondary flex items-center justify-center text-xs font-bold shrink-0">
          {season.season_number}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm">Season {season.season_number}</span>
            <StatusBadge status={season.status || 'missing'} />
          </div>
          <div className="flex items-center gap-3 mt-1">
            <Progress value={pct} className="h-1.5 w-32" />
            <span className="text-xs text-muted-foreground">{available} / {total} episodes</span>
          </div>
        </div>
        <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
          <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" onClick={handleSearchSeason}>
            <Search className="w-3 h-3" /> Search
          </Button>
          <Switch
            checked={season.monitored !== false}
            onCheckedChange={v => updateSeasonMutation.mutate({ monitored: v })}
          />
          <span className="text-xs text-muted-foreground">Monitor</span>
        </div>
      </div>
      {expanded && eps.length > 0 && (
        <div className="border-t border-border">
          {eps.map(ep => (
            <EpisodeRow key={ep.id} ep={ep} seriesId={seriesId} seriesTitle={seriesTitle} series={series} queryClient={queryClient} />
          ))}
        </div>
      )}
    </Card>
  );
}

export default function SeriesDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();
  const [searchOpen, setSearchOpen] = useState(false);
  const [requestSeasonsOpen, setRequestSeasonsOpen] = useState(false);

  const { data: series, isLoading } = useQuery({
    queryKey: ['series', id],
    queryFn: () => base44.entities.Series.filter({ id }),
    select: (data) => data[0],
  });

  const { data: seasons = [] } = useQuery({
    queryKey: ['seasons', id],
    queryFn: () => base44.entities.Season.filter({ series_id: id }, 'season_number', 50),
    enabled: !!id,
    initialData: [],
  });

  const { data: episodes = [] } = useQuery({
    queryKey: ['episodes', id],
    queryFn: () => base44.entities.Episode.filter({ series_id: id }, 'episode_number', 500),
    enabled: !!id,
    initialData: [],
  });

  const { data: history = [] } = useQuery({
    queryKey: ['history', 'series', id],
    queryFn: () => base44.entities.HistoryEvent.filter({ media_id: id }, '-created_date', 100),
    enabled: !!id,
    initialData: [],
  });

  const updateMutation = useMutation({
    mutationFn: (data) => base44.entities.Series.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['series', id] }),
  });

  const deleteMutation = useMutation({
    mutationFn: () => base44.entities.Series.delete(id),
    onSuccess: () => navigate('/series'),
  });

  if (isLoading) return <div className="flex items-center justify-center h-96"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  if (!series) return <div className="text-center py-16 text-muted-foreground">Series not found</div>;

  const completionPct = series.episodes_total > 0 ? Math.round((series.episodes_available / series.episodes_total) * 100) : 0;

  // Group history by date
  const groupedHistory = history.reduce((acc, event) => {
    const date = event.created_date && isValid(new Date(event.created_date))
      ? format(new Date(event.created_date), 'MMMM d, yyyy') : 'Unknown';
    if (!acc[date]) acc[date] = [];
    acc[date].push(event);
    return acc;
  }, {});

  return (
    <div>
      {/* Hero */}
      <div className="relative -mx-6 -mt-6 mb-6 h-72 overflow-hidden">
        {series.backdrop_url && <img src={series.backdrop_url} alt="" className="w-full h-full object-cover opacity-30" />}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-background/80 to-transparent" />

        <div className="absolute inset-0 flex items-end p-6">
          <Button variant="ghost" size="sm" className="absolute top-4 left-4 gap-1.5" asChild>
            <Link to="/series"><ArrowLeft className="w-4 h-4" /> Back</Link>
          </Button>

          <div className="flex items-end gap-6">
            {series.poster_url
              ? <img src={series.poster_url} alt={series.title} className="w-28 h-40 object-cover rounded-lg shadow-xl shrink-0" />
              : <div className="w-28 h-40 bg-secondary rounded-lg flex items-center justify-center shrink-0"><Tv className="w-8 h-8 text-muted-foreground" /></div>
            }
            <div className="pb-2">
              <div className="flex items-center gap-2 mb-1">
                <StatusBadge status={series.series_status || 'continuing'} />
                <StatusBadge status={series.series_type || 'standard'} />
              </div>
              <h1 className="text-3xl font-bold">{series.title}</h1>
              <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground flex-wrap">
                {series.year && <span>{series.year}</span>}
                {series.network && <span>{series.network}</span>}
                {series.rating > 0 && <div className="flex items-center gap-1"><Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" /><span>{series.rating?.toFixed(1)}</span></div>}
                {series.total_seasons > 0 && <span>{series.total_seasons} seasons</span>}
                {series.certification && <Badge variant="outline" className="text-[10px] px-1.5 py-0">{series.certification}</Badge>}
              </div>
              <div className="flex items-center gap-2 mt-3 flex-wrap">
                <Button size="sm" className="gap-1.5" onClick={() => setSearchOpen(true)}>
                  <Search className="w-4 h-4" /> Search
                </Button>
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => updateMutation.mutate({ monitored: !series.monitored })}>
                  {series.monitored ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
                  {series.monitored ? 'Monitored' : 'Unmonitored'}
                </Button>
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setRequestSeasonsOpen(true)}>
                  <Plus className="w-4 h-4" /> Request Seasons
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm"><MoreHorizontal className="w-4 h-4" /></Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => {
                      updateMutation.mutate({ added_date: new Date().toISOString() });
                      base44.entities.HistoryEvent.create({ event_type: 'metadata_refreshed', media_type: 'series', media_id: id, media_title: series.title, success: true });
                      toast.success('Refreshing metadata...');
                    }}><RefreshCw className="w-4 h-4 mr-2" />Refresh & Scan</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="text-destructive" onClick={() => deleteMutation.mutate()}>
                      <Trash2 className="w-4 h-4 mr-2" />Delete Series
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
        </div>
      </div>

      {series.episodes_total > 0 && (
        <div className="flex items-center gap-4 mb-6">
          <div className="flex-1">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
              <span>{series.episodes_available} / {series.episodes_total} episodes</span>
              <span>{completionPct}%</span>
            </div>
            <Progress value={completionPct} className="h-2" />
          </div>
          {series.size_on_disk > 0 && (
            <div className="text-sm text-muted-foreground whitespace-nowrap">
              {(series.size_on_disk / 1073741824).toFixed(1)} GB on disk
            </div>
          )}
        </div>
      )}

      {series.genres?.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-6">
          {series.genres.map(g => <Badge key={g} variant="secondary" className="text-xs">{g}</Badge>)}
        </div>
      )}

      <Tabs defaultValue="seasons">
        <TabsList className="bg-secondary mb-4">
          <TabsTrigger value="seasons">Seasons & Episodes</TabsTrigger>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="history">History ({history.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="seasons">
          {seasons.length === 0 && episodes.length === 0 ? (
            <Card className="p-8">
              <EmptyState icon={Tv} title="No season data" description="Refresh the series to load season information or request seasons below." />
              <div className="flex justify-center mt-4">
                <Button variant="outline" size="sm" onClick={() => setRequestSeasonsOpen(true)} className="gap-1.5">
                  <Plus className="w-4 h-4" /> Request Seasons
                </Button>
              </div>
            </Card>
          ) : seasons.length > 0 ? (
            <div className="space-y-2">
              {seasons.map(season => (
                <SeasonRow
                  key={season.id}
                  season={season}
                  episodes={episodes}
                  seriesId={id}
                  seriesTitle={series.title}
                  series={series}
                  queryClient={queryClient}
                />
              ))}
            </div>
          ) : (
            // Fallback: episodes only, no Season entities
            <div className="space-y-2">
              {Object.entries(
                episodes.reduce((acc, ep) => { (acc[ep.season_number] = acc[ep.season_number] || []).push(ep); return acc; }, {})
              ).sort(([a], [b]) => parseInt(a) - parseInt(b)).map(([sNum, eps]) => {
                const available = eps.filter(e => e.has_file).length;
                const pct = eps.length > 0 ? Math.round((available / eps.length) * 100) : 0;
                return (
                  <SeasonRow
                    key={sNum}
                    season={{ season_number: parseInt(sNum), id: `fallback-${sNum}`, episode_count: eps.length, status: pct === 100 ? 'complete' : pct > 0 ? 'partial' : 'missing' }}
                    episodes={episodes}
                    seriesId={id}
                    seriesTitle={series.title}
                    series={series}
                    queryClient={queryClient}
                  />
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="overview">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              {/* Synopsis */}
              <Card className="p-5">
                <h3 className="font-semibold mb-3">Synopsis</h3>
                {series.overview
                  ? <p className="text-sm text-muted-foreground leading-relaxed">{series.overview}</p>
                  : <p className="text-sm text-muted-foreground">No overview available.</p>
                }
              </Card>

              {/* Metadata grid */}
              <Card className="p-5">
                <h3 className="font-semibold mb-3">Details</h3>
                <div className="grid grid-cols-2 gap-4">
                  {[
                    ['Network', series.network],
                    ['Original Language', series.original_language?.toUpperCase()],
                    ['Certification', series.certification],
                    ['Genres', series.genres?.join(', ')],
                    ['Series Status', series.series_status],
                    ['Type', series.series_type],
                    ['TMDB ID', series.tmdb_id],
                    ['IMDB ID', series.imdb_id],
                    ['TVDB ID', series.tvdb_id],
                  ].filter(([, v]) => v).map(([label, value]) => (
                    <div key={label}>
                      <p className="text-xs text-muted-foreground">{label}</p>
                      <p className="text-sm font-medium mt-0.5 capitalize truncate">{value}</p>
                    </div>
                  ))}
                </div>
              </Card>
            </div>

            {/* Right column */}
            <div className="space-y-4">
              {/* Episode stats */}
              <Card className="p-4 space-y-3">
                <h3 className="font-semibold text-sm">Episode Stats</h3>
                {[
                  ['Total Episodes', series.episodes_total],
                  ['Available', series.episodes_available],
                  ['Missing', series.episodes_missing],
                  ['Size on Disk', series.size_on_disk ? `${(series.size_on_disk / 1073741824).toFixed(1)} GB` : null],
                ].filter(([, v]) => v != null && v !== 0 || v === 0).map(([label, value]) => (
                  <div key={label} className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{label}</span>
                    <span className={`font-medium ${label === 'Missing' && value > 0 ? 'text-red-400' : ''}`}>{value ?? '—'}</span>
                  </div>
                ))}
              </Card>

              {/* Next airing */}
              {series.next_airing && isValid(new Date(series.next_airing)) && (
                <Card className="p-4 border-primary/20 bg-primary/5">
                  <h3 className="font-semibold text-sm mb-2 flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-primary" /> Next Airing
                  </h3>
                  <p className="text-sm font-medium">{format(new Date(series.next_airing), 'MMMM d, yyyy')}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{format(new Date(series.next_airing), 'h:mm a')}</p>
                  <p className="text-xs text-primary mt-1">{formatDistanceToNow(new Date(series.next_airing), { addSuffix: true })}</p>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            {history.length === 0 ? (
              <div className="p-8"><EmptyState icon={Clock} title="No history" /></div>
            ) : (
              <div className="divide-y divide-border">
                {Object.entries(groupedHistory).map(([date, events]) => (
                  <React.Fragment key={date}>
                    <div className="px-4 py-2 bg-secondary/40">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{date}</p>
                    </div>
                    {events.map(event => {
                      const desc = EVENT_DESCRIPTIONS[event.event_type];
                      return (
                        <div key={event.id} className={`flex items-start gap-3 px-4 py-3 ${event.success === false ? 'bg-red-500/5' : ''}`}>
                          {event.success === false
                            ? <XCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                            : <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0 mt-0.5" />
                          }
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-medium ${event.success === false ? 'text-red-400' : ''}`}>
                              {desc ? desc(event) : event.event_type?.replace(/_/g, ' ')}
                            </p>
                            {['grabbed','blocklisted','download_failed'].includes(event.event_type) && event.source_info && (
                              <p className="text-[10px] font-mono text-muted-foreground/70 mt-0.5 truncate">{event.source_info}</p>
                            )}
                            {event.error_details && <p className="text-xs text-red-400 mt-0.5">{event.error_details}</p>}
                          </div>
                          {event.quality && <Badge variant="outline" className="text-[10px] shrink-0">{event.quality}</Badge>}
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {event.created_date && isValid(new Date(event.created_date)) ? format(new Date(event.created_date), 'HH:mm') : ''}
                          </span>
                        </div>
                      );
                    })}
                  </React.Fragment>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>

      <InteractiveSearchDrawer open={searchOpen} onClose={() => setSearchOpen(false)} media={series} mediaType="series" />
      {requestSeasonsOpen && (
        <RequestMoreSeasonsDialog series={series} currentUser={currentUser} onClose={() => setRequestSeasonsOpen(false)} />
      )}
    </div>
  );
}