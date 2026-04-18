import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Users, Plus, Pencil, Trash2, Shield, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import PageHeader from '@/components/shared/PageHeader';
import StatusBadge from '@/components/shared/StatusBadge';
import EmptyState from '@/components/shared/EmptyState';
import { toast } from 'sonner';

const ROLES = ['admin', 'manager', 'standard', 'restricted', 'readonly'];
const ROLE_COLORS = { admin: 'red', manager: 'orange', standard: 'blue', restricted: 'yellow', readonly: 'slate' };

const DEFAULT_PERMISSIONS = {
  can_request_movies: true,
  can_request_series: true,
  can_request_partial_seasons: true,
  can_auto_approve: false,
  can_manage_library: false,
  can_run_searches: false,
  can_manual_import: false,
  can_delete_files: false,
  can_edit_settings: false,
};

const PERM_LABELS = {
  can_request_movies: 'Request Movies',
  can_request_series: 'Request Series',
  can_request_partial_seasons: 'Partial Season Requests',
  can_auto_approve: 'Auto-Approve Own Requests',
  can_manage_library: 'Manage Library',
  can_run_searches: 'Run Manual Searches',
  can_manual_import: 'Manual Import',
  can_delete_files: 'Delete Files',
  can_edit_settings: 'Edit Settings',
};

function UserFormDialog({ user, onClose }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    email: user?.email || '',
    display_name: user?.display_name || '',
    role: user?.role || 'standard',
    auto_approve: user?.auto_approve || false,
    max_requests: user?.max_requests || 10,
    allowed_media_types: user?.allowed_media_types || 'both',
    permissions: { ...DEFAULT_PERMISSIONS, ...(user?.permissions || {}) },
  });
  const [permOpen, setPermOpen] = useState(false);

  const mutation = useMutation({
    mutationFn: () => user
      ? base44.entities.UserProfile.update(user.id, form)
      : base44.entities.UserProfile.create(form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-profiles'] });
      toast.success(user ? 'User updated' : 'User added');
      onClose();
    },
  });

  const setPermission = (key, val) => setForm(f => ({ ...f, permissions: { ...f.permissions, [key]: val } }));

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{user ? 'Edit User' : 'Add User'}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs">Display Name</Label><Input className="mt-1" value={form.display_name} onChange={e => setForm({ ...form, display_name: e.target.value })} /></div>
            <div><Label className="text-xs">Email</Label><Input className="mt-1" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
            <div>
              <Label className="text-xs">Role</Label>
              <Select value={form.role} onValueChange={v => setForm({ ...form, role: v })}>
                <SelectTrigger className="mt-1 h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLES.map(r => <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Allowed Media</Label>
              <Select value={form.allowed_media_types} onValueChange={v => setForm({ ...form, allowed_media_types: v })}>
                <SelectTrigger className="mt-1 h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="both">Movies & Series</SelectItem>
                  <SelectItem value="movie">Movies Only</SelectItem>
                  <SelectItem value="series">Series Only</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">Max Active Requests</Label><Input className="mt-1" type="number" value={form.max_requests} onChange={e => setForm({ ...form, max_requests: parseInt(e.target.value) })} /></div>
            <div className="flex items-center gap-2 mt-5"><Switch checked={form.auto_approve} onCheckedChange={v => setForm({ ...form, auto_approve: v })} /><Label className="text-sm">Auto-Approve</Label></div>
          </div>

          <Collapsible open={permOpen} onOpenChange={setPermOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="outline" size="sm" className="w-full gap-1.5 justify-between">
                <span className="flex items-center gap-1.5"><Shield className="w-3.5 h-3.5" /> Permissions</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform ${permOpen ? 'rotate-180' : ''}`} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mt-2 space-y-2 border border-border rounded-lg p-3">
                {Object.entries(PERM_LABELS).map(([key, label]) => (
                  <div key={key} className="flex items-center justify-between">
                    <Label className="text-xs cursor-pointer">{label}</Label>
                    <Switch
                      checked={form.permissions[key] !== false}
                      onCheckedChange={v => setPermission(key, v)}
                    />
                  </div>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={() => mutation.mutate()} disabled={!form.email || mutation.isPending}>
            {user ? 'Save Changes' : 'Add User'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function UsersPage() {
  const queryClient = useQueryClient();
  const [editingUser, setEditingUser] = useState(null);
  const [showForm, setShowForm] = useState(false);

  const { data: users = [] } = useQuery({
    queryKey: ['user-profiles'],
    queryFn: () => base44.entities.UserProfile.list('-created_date', 100),
    initialData: [],
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.UserProfile.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['user-profiles'] }); toast.success('User removed'); },
  });

  return (
    <div>
      <PageHeader title="Users" description="Manage user accounts and permissions">
        <Button size="sm" className="gap-1.5" onClick={() => { setEditingUser(null); setShowForm(true); }}>
          <Plus className="w-4 h-4" /> Add User
        </Button>
      </PageHeader>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Display Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Requests</TableHead>
              <TableHead>Auto-Approve</TableHead>
              <TableHead>Media</TableHead>
              <TableHead className="w-20">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.length === 0 ? (
              <TableRow><TableCell colSpan={7}><EmptyState icon={Users} title="No users configured" description="Add users to manage access and permissions" /></TableCell></TableRow>
            ) : users.map(u => (
              <TableRow key={u.id}>
                <TableCell className="font-medium text-sm">{u.display_name || '—'}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{u.email}</TableCell>
                <TableCell>
                  <Badge
                    variant="secondary"
                    className={`bg-${ROLE_COLORS[u.role] || 'slate'}-500/20 text-${ROLE_COLORS[u.role] || 'slate'}-400 border-${ROLE_COLORS[u.role] || 'slate'}-500/30 text-[10px] capitalize`}
                  >
                    {u.role}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{u.request_count || 0} / {u.max_requests || 10}</TableCell>
                <TableCell>
                  {u.auto_approve ? <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-[10px]">Yes</Badge> : <Badge variant="secondary" className="text-[10px]">No</Badge>}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground capitalize">{u.allowed_media_types || 'both'}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditingUser(u); setShowForm(true); }}>
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete User?</AlertDialogTitle>
                          <AlertDialogDescription>Remove {u.display_name || u.email} from the system? This cannot be undone.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteMutation.mutate(u.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {showForm && (
        <UserFormDialog
          user={editingUser}
          onClose={() => { setShowForm(false); setEditingUser(null); }}
        />
      )}
    </div>
  );
}