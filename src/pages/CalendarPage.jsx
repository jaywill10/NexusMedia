import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Calendar as CalIcon, Film, Tv, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import PageHeader from '@/components/shared/PageHeader';
import StatusBadge from '@/components/shared/StatusBadge';
import {
  format, addDays, startOfWeek, addWeeks, subWeeks, isSameDay, isToday,
  startOfMonth, endOfMonth, startOfWeek as sowFn, addMonths, subMonths, addDays as ad, eachDayOfInterval
} from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export default function CalendarPage() {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState('week');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [expandedDays, setExpandedDays] = useState({});
  const [showMovies, setShowMovies] = useState(true);
  const [showTV, setShowTV] = useState(true);
  const [monitoredOnly, setMonitoredOnly] = useState(false);

  const { data: movies = [] } = useQuery({
    queryKey: ['calendar-movies'],
    queryFn: () => base44.entities.Movie.list('-digital_release_date', 100),
    initialData: [],
  });

  const { data: episodes = [] } = useQuery({
    queryKey: ['calendar-episodes'],
    queryFn: () => base44.entities.Episode.list('-air_date', 200),
    initialData: [],
  });

  const { data: seriesList = [] } = useQuery({
    queryKey: ['series-all'],
    queryFn: () => base44.entities.Series.list('-title', 500),
    initialData: [],
  });

  const getSeriesTitle = (series_id) => seriesList.find(s => s.id === series_id)?.title || 'Unknown Series';

  const getItemsForDay = (day) => {
    const dateStr = format(day, 'yyyy-MM-dd');
    let items = [];
    if (showMovies) {
      items = [...items, ...movies
        .filter(m => m.digital_release_date === dateStr || m.theatrical_release_date === dateStr)
        .filter(m => !monitoredOnly || m.monitored)
        .map(m => ({ ...m, _type: 'movie', _dateLabel: m.digital_release_date === dateStr ? 'Digital' : 'Theatrical' }))
      ];
    }
    if (showTV) {
      items = [...items, ...episodes
        .filter(e => e.air_date === dateStr)
        .filter(e => !monitoredOnly || e.monitored)
        .map(e => ({ ...e, _type: 'episode', _seriesTitle: getSeriesTitle(e.series_id) }))
      ];
    }
    return items;
  };

  const handleSearch = async (item) => {
    await base44.entities.HistoryEvent.create({
      event_type: 'searched',
      media_type: item._type === 'movie' ? 'movie' : 'episode',
      media_id: item.id,
      media_title: item._type === 'movie' ? item.title : item._seriesTitle,
      success: true,
    });
    toast.success('Search started');
  };

  const ItemPill = ({ item, compact = false }) => (
    <Popover>
      <PopoverTrigger asChild>
        <div className={cn(
          "rounded px-1.5 py-1 text-xs cursor-pointer transition-colors truncate",
          item._type === 'movie'
            ? "bg-blue-500/10 border border-blue-500/20 hover:bg-blue-500/20"
            : "bg-purple-500/10 border border-purple-500/20 hover:bg-purple-500/20"
        )}>
          <div className="flex items-center gap-1">
            {item._type === 'movie'
              ? <Film className="w-3 h-3 text-blue-400 shrink-0" />
              : <Tv className="w-3 h-3 text-purple-400 shrink-0" />}
            <span className="font-medium truncate">{item._type === 'movie' ? item.title : item._seriesTitle}</span>
          </div>
          {item._type === 'episode' && !compact && (
            <div className="text-muted-foreground truncate">
              S{String(item.season_number).padStart(2,'0')}E{String(item.episode_number).padStart(2,'0')} {item.title}
            </div>
          )}
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-72" align="start">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            {item._type === 'movie' ? <Film className="w-4 h-4 text-blue-400" /> : <Tv className="w-4 h-4 text-purple-400" />}
            <span className="font-semibold text-sm">{item._type === 'movie' ? item.title : item._seriesTitle}</span>
          </div>
          {item._type === 'episode' && (
            <p className="text-xs text-muted-foreground">
              S{String(item.season_number).padStart(2,'0')}E{String(item.episode_number).padStart(2,'0')} — {item.title}
            </p>
          )}
          {item._dateLabel && <Badge variant="outline" className="text-[10px]">{item._dateLabel}</Badge>}
          <StatusBadge status={item._type === 'movie' ? (item.library_status || 'missing') : (item.status || 'missing')} />
          <div className="flex gap-2 pt-1">
            <Button size="sm" variant="outline" className="flex-1 h-7 text-xs gap-1" onClick={() => handleSearch(item)}>
              <Search className="w-3 h-3" /> Search Now
            </Button>
            <Button size="sm" variant="outline" className="flex-1 h-7 text-xs" onClick={() => navigate(item._type === 'movie' ? `/movies/${item.id}` : `/series/${item.series_id}`)}>
              Go to Detail
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );

  // Week view
  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  // Month view
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calStart = sowFn(monthStart, { weekStartsOn: 1 });
  const calDays = eachDayOfInterval({ start: calStart, end: addDays(calStart, 41) });

  // List view — next 60 days
  const listDays = Array.from({ length: 60 }, (_, i) => addDays(new Date(), i))
    .filter(day => getItemsForDay(day).length > 0);

  const prev = () => {
    if (viewMode === 'week') setCurrentDate(subWeeks(currentDate, 1));
    else if (viewMode === 'month') setCurrentDate(subMonths(currentDate, 1));
  };
  const next = () => {
    if (viewMode === 'week') setCurrentDate(addWeeks(currentDate, 1));
    else if (viewMode === 'month') setCurrentDate(addMonths(currentDate, 1));
  };

  return (
    <div>
      <PageHeader title="Calendar" description="Upcoming releases and airing episodes">
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex border border-border rounded-md">
            {['week','month','list'].map(v => (
              <Button key={v} variant={viewMode === v ? 'secondary' : 'ghost'} size="sm" className="h-8 px-3 text-xs capitalize" onClick={() => setViewMode(v)}>
                {v}
              </Button>
            ))}
          </div>
          {viewMode !== 'list' && (
            <>
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={prev}><ChevronLeft className="w-4 h-4" /></Button>
              <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date())}>Today</Button>
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={next}><ChevronRight className="w-4 h-4" /></Button>
            </>
          )}
        </div>
      </PageHeader>

      {/* Filters */}
      <div className="flex items-center gap-2 mb-4">
        <button onClick={() => setShowMovies(!showMovies)} className={cn('px-3 py-1 rounded-full text-xs border transition-colors', showMovies ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' : 'border-border text-muted-foreground')}>
          <Film className="w-3 h-3 inline mr-1" />Movies
        </button>
        <button onClick={() => setShowTV(!showTV)} className={cn('px-3 py-1 rounded-full text-xs border transition-colors', showTV ? 'bg-purple-500/20 text-purple-400 border-purple-500/30' : 'border-border text-muted-foreground')}>
          <Tv className="w-3 h-3 inline mr-1" />TV
        </button>
        <button onClick={() => setMonitoredOnly(!monitoredOnly)} className={cn('px-3 py-1 rounded-full text-xs border transition-colors', monitoredOnly ? 'bg-primary/20 text-primary border-primary/30' : 'border-border text-muted-foreground')}>
          Monitored Only
        </button>
      </div>

      {viewMode === 'week' && (
        <div className="grid grid-cols-7 gap-2">
          {weekDays.map(day => {
            const items = getItemsForDay(day);
            return (
              <div key={day.toISOString()} className="min-h-[200px]">
                <div className={cn("text-center py-2 rounded-t-lg text-sm font-medium", isToday(day) ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground")}>
                  <div className="text-[10px] uppercase">{format(day, 'EEE')}</div>
                  <div className="text-lg">{format(day, 'd')}</div>
                </div>
                <div className="bg-card border border-border border-t-0 rounded-b-lg p-1.5 space-y-1 min-h-[160px]">
                  {items.map((item, idx) => <ItemPill key={idx} item={item} />)}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {viewMode === 'month' && (
        <div>
          <h2 className="text-lg font-semibold mb-3 text-center">{format(currentDate, 'MMMM yyyy')}</h2>
          <div className="grid grid-cols-7 gap-px bg-border rounded-lg overflow-hidden">
            {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d => (
              <div key={d} className="bg-secondary text-center text-xs font-medium text-muted-foreground py-2">{d}</div>
            ))}
            {calDays.map(day => {
              const dayKey = format(day, 'yyyy-MM-dd');
              const items = getItemsForDay(day);
              const isCurrentMonth = day >= monthStart && day <= monthEnd;
              const expanded = expandedDays[dayKey];
              const visible = expanded ? items : items.slice(0, 3);
              return (
                <div key={day.toISOString()} className={cn("bg-card min-h-[100px] p-1", !isCurrentMonth && "opacity-40")}>
                  <div className={cn("text-xs font-medium mb-1 w-6 h-6 rounded-full flex items-center justify-center", isToday(day) ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>
                    {format(day, 'd')}
                  </div>
                  <div className="space-y-0.5">
                    {visible.map((item, idx) => <ItemPill key={idx} item={item} compact />)}
                    {items.length > 3 && !expanded && (
                      <button onClick={() => setExpandedDays(prev => ({ ...prev, [dayKey]: true }))} className="text-[10px] text-muted-foreground hover:text-foreground">+{items.length - 3} more</button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {viewMode === 'list' && (
        <div className="space-y-6">
          {listDays.length === 0 ? (
            <Card className="p-8 text-center text-muted-foreground text-sm">No upcoming releases in the next 60 days</Card>
          ) : listDays.map(day => {
            const items = getItemsForDay(day);
            return (
              <div key={day.toISOString()}>
                <div className="sticky top-0 bg-background/95 backdrop-blur py-1.5 z-10">
                  <h3 className={cn("text-sm font-semibold", isToday(day) ? "text-primary" : "text-muted-foreground")}>
                    {isToday(day) ? 'Today' : format(day, 'EEEE, MMMM d')}
                  </h3>
                </div>
                <div className="space-y-2 mt-2">
                  {items.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
                      {item._type === 'movie' ? <Film className="w-4 h-4 text-blue-400 shrink-0" /> : <Tv className="w-4 h-4 text-purple-400 shrink-0" />}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{item._type === 'movie' ? item.title : item._seriesTitle}</p>
                        {item._type === 'episode' && (
                          <p className="text-xs text-muted-foreground">S{String(item.season_number).padStart(2,'0')}E{String(item.episode_number).padStart(2,'0')} — {item.title}</p>
                        )}
                      </div>
                      {item._dateLabel && <Badge variant="outline" className="text-[10px] shrink-0">{item._dateLabel}</Badge>}
                      <StatusBadge status={item._type === 'movie' ? (item.library_status || 'missing') : (item.status || 'missing')} />
                      <Button size="sm" variant="outline" className="h-7 text-xs gap-1 shrink-0" onClick={() => handleSearch(item)}>
                        <Search className="w-3 h-3" /> Search Now
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}