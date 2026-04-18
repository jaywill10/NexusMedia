import React, { useState, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertTriangle, Check, Download, Shield, ArrowUpDown, Loader2, Zap, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// Generate mock release candidates
function generateMockReleases(media) {
  const title = media?.title || 'Unknown';
  const year = media?.year || 2024;
  const sources = ['BluRay', 'WEB-DL', 'WEBRip', 'HDTV', 'REMUX'];
  const qualities = ['2160p', '1080p', '720p', '480p'];
  const indexers = ['1337x', 'NZBGeek', 'RARBG', 'YTS', 'TorrentGalaxy'];
  const groups = ['YIFY', 'FGT', 'SPARKS', 'NTG', 'EVO', 'FLUX'];

  return Array.from({ length: 18 }, (_, i) => {
    const quality = qualities[i % qualities.length];
    const source = sources[i % sources.length];
    const protocol = i % 3 === 0 ? 'usenet' : 'torrent';
    const seeders = protocol === 'torrent' ? Math.floor(Math.random() * 800) + 1 : null;
    const score = Math.floor(Math.random() * 100) - 20;
    const size = quality === '2160p' ? (40 + Math.random() * 40) * 1e9 : quality === '1080p' ? (8 + Math.random() * 15) * 1e9 : (1 + Math.random() * 5) * 1e9;
    const age = Math.floor(Math.random() * 720);
    const relName = `${title.replace(/[^a-zA-Z0-9]/g, '.')}.${year}.${quality}.${source}-${groups[i % groups.length]}`;

    // Acceptance logic
    const rejectionReasons = [];
    if (quality === '480p') rejectionReasons.push('Quality below minimum (720p required)');
    if (score < 0) rejectionReasons.push(`Custom format score too low (${score} < 0)`);
    if (seeders !== null && seeders < 5) rejectionReasons.push('Too few seeders (< 5)');
    if (i === 3) rejectionReasons.push('Release group EVO is blocklisted');
    if (i === 7) rejectionReasons.push('Wrong language (dubbed)');
    if (i === 11) rejectionReasons.push('Cutoff already met — upgrade not allowed');

    return {
      id: `mock-${i}`,
      release_name: relName,
      quality,
      source,
      indexer: indexers[i % indexers.length],
      protocol,
      seeders,
      size,
      age_hours: age,
      custom_format_score: score,
      accepted: rejectionReasons.length === 0,
      rejection_reasons: rejectionReasons,
      grabbed: false,
    };
  });
}

const SORT_FIELDS = ['release_name', 'quality', 'size', 'age_hours', 'seeders', 'custom_format_score'];

export default function InteractiveSearchDrawer({ open, onClose, media, mediaType = 'movie', seasonNumber, episodeNumber }) {
  const queryClient = useQueryClient();
  const [results, setResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [sortField, setSortField] = useState('custom_format_score');
  const [sortDir, setSortDir] = useState('desc');
  const [grabbed, setGrabbed] = useState({});
  const [blocklisted, setBlocklisted] = useState({});
  const [lastGrabbedName, setLastGrabbedName] = useState(null);

  const handleSearch = useCallback(async () => {
    setIsSearching(true);
    await new Promise(r => setTimeout(r, 1200));
    setResults(generateMockReleases(media));
    setHasSearched(true);
    setIsSearching(false);
  }, [media]);

  const handleAutoSearch = useCallback(async () => {
    setIsSearching(true);
    await new Promise(r => setTimeout(r, 1800));
    const res = generateMockReleases(media);
    setResults(res);
    setHasSearched(true);
    setIsSearching(false);
    const best = res.find(r => r.accepted);
    if (best) {
      await grabRelease(best, true);
      toast.success(`Auto Search: grabbed ${best.release_name}`);
    } else {
      toast.error('Auto Search: no acceptable releases found');
    }
  }, [media]);

  const grabRelease = async (release, silent = false) => {
    await base44.entities.DownloadQueueItem.create({
      title: media?.title || release.release_name,
      media_type: mediaType,
      linked_id: media?.id,
      release_name: release.release_name,
      protocol: release.protocol,
      quality: release.quality,
      size: release.size,
      progress: 0,
      status: 'queued',
      indexer: release.indexer,
    });
    await base44.entities.HistoryEvent.create({
      event_type: 'grabbed',
      media_type: mediaType,
      media_id: media?.id,
      media_title: media?.title,
      quality: release.quality,
      source_info: release.release_name,
      details: `Grabbed from ${release.indexer}`,
      success: true,
    });
    setGrabbed(g => ({ ...g, [release.id]: true }));
    setLastGrabbedName(release.release_name);
    queryClient.invalidateQueries({ queryKey: ['download-queue'] });
    if (!silent) toast.success(`Grabbing ${release.release_name}`);
  };

  const handleBlocklist = async (release) => {
    await base44.entities.BlocklistEntry.create({
      release_name: release.release_name,
      media_type: mediaType,
      media_id: media?.id,
      media_title: media?.title,
      indexer: release.indexer,
      protocol: release.protocol,
      reason: 'Manually blocklisted from Interactive Search',
    });
    setBlocklisted(b => ({ ...b, [release.id]: true }));
    toast.success('Release blocklisted');
  };

  const toggleSort = (field) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('desc'); }
  };

  const sorted = [...results].sort((a, b) => {
    const av = a[sortField] ?? -Infinity;
    const bv = b[sortField] ?? -Infinity;
    if (typeof av === 'string') return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
    return sortDir === 'asc' ? av - bv : bv - av;
  });

  const SortTh = ({ field, children }) => (
    <TableHead className="cursor-pointer select-none" onClick={() => toggleSort(field)}>
      <div className="flex items-center gap-1">
        {children}
        {sortField === field && <ArrowUpDown className="w-3 h-3 text-primary" />}
      </div>
    </TableHead>
  );

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent side="right" className="w-full max-w-5xl p-0 flex flex-col">
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-border">
          <SheetTitle className="flex items-center justify-between">
            <span>Interactive Search — {media?.title}{seasonNumber != null ? ` S${String(seasonNumber).padStart(2,'0')}` : ''}{episodeNumber != null ? `E${String(episodeNumber).padStart(2,'0')}` : ''}</span>
            <div className="flex gap-2 mr-8">
              <Button variant="outline" size="sm" onClick={handleAutoSearch} disabled={isSearching} className="gap-1.5">
                <Zap className="w-4 h-4" /> Auto Search
              </Button>
              <Button size="sm" onClick={handleSearch} disabled={isSearching} className="gap-1.5">
                {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                {isSearching ? 'Searching...' : 'Search'}
              </Button>
            </div>
          </SheetTitle>
          {media && (
            <div className="flex gap-3 text-xs text-muted-foreground mt-1">
              <span>{media.year}</span>
              {media.quality_profile_id && <span>Profile: {media.quality_profile_id}</span>}
              <span className="capitalize">{mediaType}</span>
            </div>
          )}
        </SheetHeader>

        <div className="flex-1 overflow-auto">
          {!hasSearched && !isSearching && (
            <div className="flex flex-col items-center justify-center h-64 text-center text-muted-foreground">
              <Download className="w-10 h-10 mb-3 opacity-40" />
              <p className="font-medium">Click Search to query all enabled indexers</p>
              <p className="text-xs mt-1">Or use Auto Search to automatically grab the best result</p>
            </div>
          )}
          {isSearching && (
            <div className="flex flex-col items-center justify-center h-64 text-center text-muted-foreground">
              <Loader2 className="w-10 h-10 mb-3 animate-spin text-primary" />
              <p className="font-medium">Querying indexers...</p>
            </div>
          )}
          {lastGrabbedName && (
            <div className="mx-4 mt-3 p-3 rounded-lg bg-green-500/10 border border-green-500/30 flex items-center gap-3">
              <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-green-400 font-medium">Grabbed — added to download queue</p>
                <p className="text-xs text-muted-foreground truncate">{lastGrabbedName}</p>
              </div>
              <Link to="/queue" onClick={onClose} className="text-xs text-primary hover:underline shrink-0">View Queue →</Link>
            </div>
          )}
          {hasSearched && !isSearching && (
            <TooltipProvider>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8"></TableHead>
                    <SortTh field="release_name">Release</SortTh>
                    <SortTh field="age_hours">Age</SortTh>
                    <SortTh field="size">Size</SortTh>
                    <SortTh field="quality">Quality</SortTh>
                    <TableHead>Source</TableHead>
                    <TableHead>Indexer</TableHead>
                    <TableHead>Protocol</TableHead>
                    <SortTh field="seeders">Peers</SortTh>
                    <SortTh field="custom_format_score">Score</SortTh>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-24">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sorted.map(r => (
                    <TableRow key={r.id} className={cn(
                      blocklisted[r.id] && 'opacity-40 line-through',
                      !r.accepted && 'opacity-60'
                    )}>
                      <TableCell>
                        {r.accepted
                          ? <Check className="w-4 h-4 text-green-400" />
                          : (
                            <Tooltip>
                              <TooltipTrigger><AlertTriangle className="w-4 h-4 text-yellow-400" /></TooltipTrigger>
                              <TooltipContent className="max-w-xs">
                                <ul className="space-y-0.5 text-xs">
                                  {r.rejection_reasons.map((reason, i) => <li key={i}>• {reason}</li>)}
                                </ul>
                              </TooltipContent>
                            </Tooltip>
                          )
                        }
                      </TableCell>
                      <TableCell className="font-mono text-xs max-w-[220px] truncate">{r.release_name}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {r.age_hours < 24 ? `${r.age_hours}h` : `${Math.floor(r.age_hours / 24)}d`}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {r.size ? `${(r.size / 1e9).toFixed(1)} GB` : '—'}
                      </TableCell>
                      <TableCell><Badge variant="outline" className="text-[10px]">{r.quality}</Badge></TableCell>
                      <TableCell className="text-xs text-muted-foreground">{r.source}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{r.indexer}</TableCell>
                      <TableCell>
                        <Badge variant={r.protocol === 'torrent' ? 'secondary' : 'outline'} className="text-[10px] capitalize">
                          {r.protocol}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {r.protocol === 'torrent' ? r.seeders : '—'}
                      </TableCell>
                      <TableCell className={cn('text-xs font-medium', r.custom_format_score > 0 ? 'text-green-400' : r.custom_format_score < 0 ? 'text-red-400' : 'text-muted-foreground')}>
                        {r.custom_format_score > 0 ? '+' : ''}{r.custom_format_score}
                      </TableCell>
                      <TableCell>
                        {grabbed[r.id]
                          ? <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-[10px]">Grabbed</Badge>
                          : blocklisted[r.id]
                          ? <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-[10px]">Blocklisted</Badge>
                          : r.accepted
                          ? <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-[10px]">Accepted</Badge>
                          : (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 text-[10px] cursor-help">Rejected</Badge>
                              </TooltipTrigger>
                              <TooltipContent className="max-w-xs text-xs">
                                {r.rejection_reasons.join('; ')}
                              </TooltipContent>
                            </Tooltip>
                          )
                        }
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {!grabbed[r.id] && !blocklisted[r.id] && (
                            <>
                              <Button
                                size="sm"
                                variant={r.accepted ? 'default' : 'outline'}
                                className="h-7 px-2 text-xs gap-1"
                                onClick={() => grabRelease(r)}
                              >
                                {!r.accepted && <AlertCircle className="w-3 h-3 text-yellow-400" />}
                                Grab
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0"
                                title="Blocklist"
                                onClick={() => handleBlocklist(r)}
                              >
                                <Shield className="w-3 h-3" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TooltipProvider>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}