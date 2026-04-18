import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import ApprovalModal from '@/components/requests/ApprovalModal';
import RequestDetailSheet from '@/components/requests/RequestDetailSheet';
import { useNavigate } from 'react-router-dom';
import {
  MessageSquare, CheckCircle, XCircle, Search,
  MoreHorizontal, ChevronDown
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import { format } from 'date-fns';
import PageHeader from '@/components/shared/PageHeader';
import StatusBadge from '@/components/shared/StatusBadge';
import EmptyState from '@/components/shared/EmptyState';
import { toast } from 'sonner';

const statusFilters = [
  { value: 'all', label: 'All Requests' },
  { value: 'pending_approval', label: 'Pending Approval' },
  { value: 'approved', label: 'Approved' },
  { value: 'processing', label: 'Processing' },
  { value: 'available', label: 'Available' },
  { value: 'declined', label: 'Declined' },
  { value: 'failed', label: 'Failed' },
];

function BulkApproveDialog({ count, requests, selectedIds, onConfirm, onClose }) {
  const [profileId, setProfileId] = useState('');
  const [rootFolderId, setRootFolderId] = useState('');
  const [autoSearch, setAutoSearch] = useState(true);
  const { data: profiles = [] } = useQuery({ queryKey: ['quality-profiles'], queryFn: () => base44.entities.QualityProfile.list(), initialData: [] });
  const { data: rootFolders = [] } = useQuery({ queryKey: ['root-folders'], queryFn: () => base44.entities.RootFolder.list(), initialData: [] });

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Approve {count} Request{count !== 1 ? 's' : ''}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">These settings will be applied to all selected requests.</p>
          <div>
            <Label className="text-xs">Quality Profile</Label>
            <Select value={profileId} onValueChange={setProfileId}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Use request default" /></SelectTrigger>
              <SelectContent>
                {profiles.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Root Folder</Label>
            <Select value={rootFolderId} onValueChange={setRootFolderId}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Use request default" /></SelectTrigger>
              <SelectContent>
                {rootFolders.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-sm">Auto Search</Label>
            <Switch checked={autoSearch} onCheckedChange={setAutoSearch} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onConfirm({ profileId, rootFolderId, autoSearch })}>
            Approve All
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function Requests() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || 'all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);
  const [reviewingRequest, setReviewingRequest] = useState(null);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [showBulkApprove, setShowBulkApprove] = useState(false);
  const queryClient = useQueryClient();

  const { data: requests = [] } = useQuery({
    queryKey: ['requests', statusFilter, typeFilter],
    queryFn: async () => {
      const filter = {};
      if (statusFilter !== 'all') filter.status = statusFilter;
      if (typeFilter !== 'all') filter.media_type = typeFilter;
      return Object.keys(filter).length > 0
        ? base44.entities.Request.filter(filter, '-created_date', 200)
        : base44.entities.Request.list('-created_date', 200);
    },
    initialData: [],
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Request.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requests'] });
      queryClient.invalidateQueries({ queryKey: ['all-requests'] });
    },
  });

  const filteredRequests = requests.filter(r =>
    !search || r.title?.toLowerCase().includes(search.toLowerCase())
  );

  const handleDecline = (request) => {
    updateMutation.mutate(
      { id: request.id, data: { status: 'declined', declined_date: new Date().toISOString() } },
      { onSuccess: () => toast.success(`Declined: ${request.title}`) }
    );
  };

  const handleBulkApproveConfirm = ({ profileId, rootFolderId, autoSearch }) => {
    selectedIds.forEach(id => {
      const update = { status: 'approved', approved_date: new Date().toISOString(), auto_search: autoSearch };
      if (profileId) update.quality_profile_id = profileId;
      if (rootFolderId) update.root_folder_id = rootFolderId;
      updateMutation.mutate({ id, data: update });
    });
    toast.success(`Approved ${selectedIds.length} requests`);
    setSelectedIds([]);
    setShowBulkApprove(false);
  };

  const handleBulkDecline = () => {
    selectedIds.forEach(id => {
      updateMutation.mutate({ id, data: { status: 'declined', declined_date: new Date().toISOString() } });
    });
    toast.success(`Declined ${selectedIds.length} requests`);
    setSelectedIds([]);
  };

  const toggleSelect = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const toggleAll = () => {
    setSelectedIds(selectedIds.length === filteredRequests.length ? [] : filteredRequests.map(r => r.id));
  };

  const pendingCount = requests.filter(r => r.status === 'pending_approval').length;

  return (
    <div>
      <PageHeader title="Requests" description={`${pendingCount} pending approval`}>
        {selectedIds.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" className="gap-1">
                Bulk Actions ({selectedIds.length}) <ChevronDown className="w-3 h-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => setShowBulkApprove(true)}>
                <CheckCircle className="w-4 h-4 mr-2 text-green-400" /> Approve Selected
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleBulkDecline}>
                <XCircle className="w-4 h-4 mr-2 text-red-400" /> Decline Selected
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </PageHeader>

      {/* Filters */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter requests..."
            className="pl-9 h-9 bg-secondary border-0"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44 h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            {statusFilters.map(s => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-32 h-9"><SelectValue placeholder="All Types" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="movie">Movies</SelectItem>
            <SelectItem value="series">Series</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox checked={selectedIds.length === filteredRequests.length && filteredRequests.length > 0} onCheckedChange={toggleAll} />
              </TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Requested By</TableHead>
              <TableHead>Seasons</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredRequests.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8}>
                  <EmptyState icon={MessageSquare} title="No requests yet" description="Users can discover and request movies or series">
                    <Button size="sm" variant="outline" onClick={() => navigate('/discover')}>Open Discover</Button>
                  </EmptyState>
                </TableCell>
              </TableRow>
            ) : (
              filteredRequests.map(request => (
                <TableRow key={request.id} className="group">
                  <TableCell>
                    <Checkbox checked={selectedIds.includes(request.id)} onCheckedChange={() => toggleSelect(request.id)} />
                  </TableCell>
                  <TableCell>
                    <button
                      className="flex items-center gap-3 text-left hover:text-primary transition-colors"
                      onClick={() => { setSelectedRequest(request); setDetailOpen(true); }}
                    >
                      <div className="w-8 h-12 rounded bg-secondary overflow-hidden shrink-0">
                        {request.poster_url && <img src={request.poster_url} alt="" className="w-full h-full object-cover" />}
                      </div>
                      <div>
                        <p className="font-medium text-sm">{request.title}</p>
                        {request.year && <p className="text-xs text-muted-foreground">{request.year}</p>}
                      </div>
                    </button>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[10px]">
                      {request.media_type === 'movie' ? 'Movie' : 'Series'}
                    </Badge>
                  </TableCell>
                  <TableCell><StatusBadge status={request.status} /></TableCell>
                  <TableCell className="text-sm text-muted-foreground">{request.requested_by || request.created_by}</TableCell>
                  <TableCell>
                    {request.requested_seasons?.length > 0 ? (
                      <span className="text-xs text-muted-foreground">S{request.requested_seasons.join(', S')}</span>
                    ) : request.media_type === 'movie' ? '—' : 'All'}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {request.created_date ? format(new Date(request.created_date), 'MMM d, HH:mm') : '—'}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {(request.status === 'pending_approval' || request.status === 'submitted') && (
                          <>
                            <DropdownMenuItem onClick={() => setReviewingRequest(request)}>
                              <CheckCircle className="w-4 h-4 mr-2 text-green-400" /> Review & Approve
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleDecline(request)}>
                              <XCircle className="w-4 h-4 mr-2 text-red-400" /> Quick Decline
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                          </>
                        )}
                        <DropdownMenuItem onClick={() => updateMutation.mutate({ id: request.id, data: { status: 'canceled' } })}>
                          Cancel Request
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <RequestDetailSheet
        request={selectedRequest}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        onApprove={(r) => setReviewingRequest(r)}
        onDecline={handleDecline}
      />

      {reviewingRequest && (
        <ApprovalModal
          request={reviewingRequest}
          onClose={() => setReviewingRequest(null)}
          currentUser={null}
        />
      )}

      {showBulkApprove && (
        <BulkApproveDialog
          count={selectedIds.length}
          selectedIds={selectedIds}
          requests={requests}
          onConfirm={handleBulkApproveConfirm}
          onClose={() => setShowBulkApprove(false)}
        />
      )}
    </div>
  );
}