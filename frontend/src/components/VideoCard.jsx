import React, { useState } from 'react';
import { 
  Clock, 
  User, 
  Film, 
  Youtube, 
  Instagram, 
  Facebook, 
  PlayCircle 
} from 'lucide-react';

export default function VideoCard({ videoInfo }) {
  const [imageError, setImageError] = useState(false);

  if (!videoInfo) return null;

  const { title, thumbnail, duration, uploader, platform } = videoInfo;

  // Format seconds into HH:MM:SS or MM:SS
  const formattedDuration = (() => {
    if (duration === null || duration === undefined || isNaN(duration)) {
      return null;
    }
    const hrs = Math.floor(duration / 3600);
    const mins = Math.floor((duration % 3600) / 60);
    const secs = Math.floor(duration % 60);

    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  })();

  const renderPlatformIcon = () => {
    switch (platform) {
      case 'YouTube':
        return <Youtube className="w-3.5 h-3.5 text-red-500" />;
      case 'Instagram':
        return <Instagram className="w-3.5 h-3.5 text-pink-400" />;
      case 'Facebook':
        return <Facebook className="w-3.5 h-3.5 text-blue-400" />;
      default:
        return <Film className="w-3.5 h-3.5 text-indigo-400" />;
    }
  };

  return (
    <div className="w-full bg-slate-900/90 rounded-2xl border border-slate-800/90 p-4 md:p-5 shadow-xl transition-all duration-300 hover:border-slate-700/80">
      <div className="flex flex-col sm:flex-row gap-4 sm:gap-5 items-start">
        {/* Thumbnail with duration badge */}
        <div className="relative w-full sm:w-48 sm:h-32 aspect-video shrink-0 rounded-xl overflow-hidden bg-slate-800 border border-slate-700/60 shadow-md group">
          {thumbnail && !imageError ? (
            <img
              src={thumbnail}
              alt={title || 'Video Thumbnail'}
              onError={() => setImageError(true)}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center bg-slate-800/80 text-slate-500 gap-2">
              <Film className="w-8 h-8 text-slate-600" />
              <span className="text-xs">No Preview</span>
            </div>
          )}

          {/* Overlay Play Icon Indicator */}
          <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <PlayCircle className="w-10 h-10 text-white/90 drop-shadow-lg" />
          </div>

          {/* Duration Badge */}
          {formattedDuration && (
            <div className="absolute bottom-2 right-2 bg-black/85 backdrop-blur-sm text-white text-[11px] font-semibold px-2 py-0.5 rounded-md flex items-center gap-1 border border-white/10 shadow-sm">
              <Clock className="w-3 h-3 text-indigo-400" />
              <span>{formattedDuration}</span>
            </div>
          )}
        </div>

        {/* Video Metadata Info */}
        <div className="flex-1 min-w-0 space-y-2.5">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-800 border border-slate-700 text-slate-300">
              {renderPlatformIcon()}
              {platform}
            </span>
          </div>

          <h3
            className="text-base sm:text-lg font-bold text-slate-100 line-clamp-2 leading-snug hover:text-indigo-300 transition-colors"
            title={title}
          >
            {title}
          </h3>

          <div className="flex items-center gap-2 text-xs sm:text-sm text-slate-400">
            <User className="w-4 h-4 text-slate-500 shrink-0" />
            <span className="truncate font-medium text-slate-300">
              {uploader}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
