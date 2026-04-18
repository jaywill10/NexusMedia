import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Compass, MessageSquare, Film, Tv, Calendar,
  Activity, AlertCircle, FolderOpen, Users, Settings, Server,
  ChevronLeft, ChevronRight, Shield, Download, List, Clock, Layers
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const navItems = [
  { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/discover', icon: Compass, label: 'Discover' },
  { path: '/requests', icon: MessageSquare, label: 'Requests', badge: 'requests' },
  { type: 'divider' },
  { path: '/movies', icon: Film, label: 'Movies' },
  { path: '/series', icon: Tv, label: 'Series' },
  { path: '/calendar', icon: Calendar, label: 'Calendar' },
  { path: '/wanted', icon: AlertCircle, label: 'Wanted' },
  { type: 'divider' },
  { path: '/queue', icon: Download, label: 'Queue', badge: 'queue' },
  { path: '/activity', icon: Activity, label: 'Activity' },
  { path: '/blocklist', icon: Shield, label: 'Blocklist' },
  { path: '/files', icon: FolderOpen, label: 'Files' },
  { path: '/collections', icon: Layers, label: 'Collections' },
  { type: 'divider' },
  { path: '/users', icon: Users, label: 'Users' },
  { path: '/settings', icon: Settings, label: 'Settings' },
  { path: '/system', icon: Server, label: 'System' },
];

export default function Sidebar({ collapsed, setCollapsed, badgeCounts = {} }) {
  const location = useLocation();

  return (
    <aside className={cn(
      "fixed left-0 top-0 h-screen bg-sidebar border-r border-sidebar-border flex flex-col z-50 transition-all duration-300",
      collapsed ? "w-16" : "w-60"
    )}>
      {/* Logo */}
      <div className="h-14 flex items-center px-4 border-b border-sidebar-border shrink-0">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Film className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-bold text-lg text-foreground tracking-tight">MediaFlow</span>
          </div>
        )}
        {collapsed && (
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center mx-auto">
            <Film className="w-4 h-4 text-primary-foreground" />
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
        {navItems.map((item, i) => {
          if (item.type === 'divider') {
            return <div key={i} className="h-px bg-sidebar-border my-2 mx-2" />;
          }
          const Icon = item.icon;
          const isActive = item.path === '/' 
            ? location.pathname === '/' 
            : location.pathname.startsWith(item.path);
          const count = item.badge ? badgeCounts[item.badge] : null;

          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors relative group",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
              )}
            >
              <Icon className={cn("w-4 h-4 shrink-0", isActive && "text-primary")} />
              {!collapsed && (
                <>
                  <span className="truncate">{item.label}</span>
                  {count > 0 && (
                    <Badge variant="secondary" className="ml-auto text-[10px] h-5 min-w-5 flex items-center justify-center bg-primary/20 text-primary border-0">
                      {count}
                    </Badge>
                  )}
                </>
              )}
              {collapsed && count > 0 && (
                <div className="absolute top-1 right-1 w-2 h-2 rounded-full bg-primary" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Collapse toggle */}
      <div className="p-2 border-t border-sidebar-border shrink-0">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-full flex items-center justify-center py-2 rounded-md text-sidebar-foreground hover:bg-sidebar-accent/50 transition-colors"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>
    </aside>
  );
}