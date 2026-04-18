import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { Shield, Search, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function BlocklistPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');

  const { data: entries = [] } = useQuery({
    queryKey: ['blocklist'],
    queryFn: () => base44.entities.BlocklistEntry.list('-created_date', 200),
    initialData: [],
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.BlocklistEntry.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['blocklist'] }); toast.success('Entry removed'); },
  });

  const filtered = entries.filter(e => {
    const matchSearch = !search || e.release_name?.toLowerCase().includes(search.toLowerCase()) || e.media_title?.toLowerCase().includes(search.toLowerCase());
    const matchType = typeFilter === 'all' || e.media_type === typeFilter;
    return matchSearch && matchType;
  });

  const deleteAllMutation = useMutation({
    mutationFn: async () => {
      await Promise.all(filtered.map(e => base44.entities.BlocklistEntry.delete(e.id)));
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['blocklist'] }); toast.success('Blocklist cleared'); },
  });

  return (
    <div>
      <PageHeader title="Blocklist" description="Releases that will never be grabbed again">
        {filtered.length > 0 && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" className="text-red-400 border-red-500/40 gap-1.5">
                <Trash2 className="w-4 h-4" /> Remove All
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Clear Blocklist?</AlertDialogTitle>
                <AlertDialogDescription>This will remove all {filtered.length} entries. This action cannot be undone.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => deleteAllMutation.mutate()} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Remove All</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </PageHeader>

      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by release or title..." className="pl-9 h-9 bg-secondary border-0" />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-36 h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="movie">Movies</SelectItem>
            <SelectItem value="series">Series</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Release Name</TableHead>
              <TableHead>Media</TableHead>
              <TableHead>Indexer</TableHead>
              <TableHead>Protocol</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow><TableCell colSpan={7}><EmptyState icon={Shield} title="Blocklist is empty" description="Releases you blocklist during searches will appear here" /></TableCell></TableRow>
            ) : filtered.map(entry => (
              <TableRow key={entry.id}>
                <TableCell className="font-mono text-xs max-w-[240px] truncate">{entry.release_name}</TableCell>
                <TableCell>
                  {entry.media_title && (
                    <Link
                      to={entry.media_type === 'movie' ? `/movies/${entry.media_id}` : `/series/${entry.media_id}`}
                      className="text-sm hover:text-primary transition-colors"
                    >
                      {entry.media_title}
                    </Link>
                  )}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{entry.indexer || '—'}</TableCell>
                <TableCell>
                  {entry.protocol && <Badge variant="outline" className="text-[10px] capitalize">{entry.protocol}</Badge>}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground max-w-[180px] truncate">{entry.reason || '—'}</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {entry.created_date ? format(new Date(entry.created_date), 'MMM d, yyyy') : '—'}
                </TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => deleteMutation.mutate(entry.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}