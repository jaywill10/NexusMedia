import React from 'react';
import { Link } from 'react-router-dom';
import StatusBadge from './StatusBadge';
import { cn } from '@/lib/utils';
import { Film, Tv, Star } from 'lucide-react';

export default function MediaCard({ item, type = 'movie', linkPrefix, showStatus = true }) {
  const href = linkPrefix
    ? `${linkPrefix}/${item.id}`
    : type === 'movie' ? `/movies/${item.id}` : `/series/${item.id}`;

  return (
    <Link to={href} className="group block">
      <div className="relative aspect-[2/3] rounded-lg overflow-hidden bg-secondary">
        {item.poster_url ? (
          <img
            src={item.poster_url}
            alt={item.title}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            {type === 'movie' ? <Film className="w-8 h-8 text-muted-foreground" /> : <Tv className="w-8 h-8 text-muted-foreground" />}
          </div>
        )}

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

        {/* Top badges */}
        <div className="absolute top-2 left-2 flex gap-1">
          {showStatus && item.library_status && (
            <StatusBadge status={item.library_status} />
          )}
          {showStatus && item.status && !item.library_status && (
            <StatusBadge status={item.status} />
          )}
        </div>

        {/* Rating */}
        {item.rating > 0 && (
          <div className="absolute top-2 right-2 flex items-center gap-1 bg-black/60 rounded-full px-1.5 py-0.5">
            <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
            <span className="text-[10px] font-semibold text-white">{item.rating?.toFixed(1)}</span>
          </div>
        )}

        {/* Bottom info on hover */}
        <div className="absolute bottom-0 left-0 right-0 p-3 translate-y-full group-hover:translate-y-0 transition-transform duration-300">
          {item.year && <p className="text-xs text-white/60">{item.year}</p>}
          {item.genres && (
            <p className="text-[10px] text-white/40 truncate mt-0.5">
              {(item.genres || []).slice(0, 3).join(' · ')}
            </p>
          )}
        </div>
      </div>

      <div className="mt-2">
        <h3 className="text-sm font-medium truncate group-hover:text-primary transition-colors">
          {item.title}
        </h3>
        {item.year && (
          <p className="text-xs text-muted-foreground mt-0.5">{item.year}</p>
        )}
      </div>
    </Link>
  );
}