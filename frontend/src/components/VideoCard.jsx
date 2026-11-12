import React, { useState } from 'react';
import { 
  Clock, 
  User, 
  Film, 
  Youtube, 
  Instagram, 
  Facebook, 
  PlayCircle,
  Scissors,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Info
} from 'lucide-react';
import { formatSecondsToTime } from '../api';

export default function VideoCard({ 
  videoInfo,
  isTrimEnabled,
  setIsTrimEnabled,
  startTime,
  setStartTime,
  endTime,
  setEndTime,
  trimError,
}) {
  const [imageError, setImageError] = useState(false);

  if (!videoInfo) return null;

  const { title, thumbnail, duration, uploader, platform } = videoInfo;

  // Formatted duration string
  const formattedDuration = formatSecondsToTime(duration);

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
    <div className="w-full bg-slate-900/90 rounded-2xl border border-slate-800/90 p-4 md:p-5 shadow-xl transition-all duration-300 hover:border-slate-700/80 space-y-4">
      {/* Video Details Row */}
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
          {duration !== null && duration !== undefined && (
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

      {/* NEW FEATURE: Trim video toggle & section */}
      <div className="border-t border-slate-800/80 pt-3">
        <button
          type="button"
          onClick={() => setIsTrimEnabled(!isTrimEnabled)}
          className="w-full flex items-center justify-between p-2.5 rounded-xl bg-slate-950/40 hover:bg-slate-800/50 border border-slate-800 hover:border-slate-700/80 transition-all text-left group"
        >
          <div className="flex items-center gap-2.5">
            <div
              className={`p-1.5 rounded-lg border transition-colors ${
                isTrimEnabled
                  ? 'bg-indigo-600/20 border-indigo-500/40 text-indigo-400'
                  : 'bg-slate-800 border-slate-700 text-slate-400 group-hover:text-slate-200'
              }`}
            >
              <Scissors className="w-4 h-4" />
            </div>
            <div>
              <span className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                Trim video
                {isTrimEnabled && (
                  <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                    Active
                  </span>
                )}
              </span>
              <span className="text-xs text-slate-400 block">
                {isTrimEnabled
                  ? 'Choose specific start and end timestamps'
                  : 'Download only a section of the video (optional)'}
              </span>
            </div>
          </div>

          <div className="text-slate-400 group-hover:text-slate-200">
            {isTrimEnabled ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </div>
        </button>

        {/* Collapsible Trim Controls */}
        {isTrimEnabled && (
          <div className="mt-3 p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3">
            {/* Duration Hint */}
            <div className="flex flex-wrap items-center justify-between text-xs text-slate-400">
              <span className="flex items-center gap-1 font-medium text-slate-300">
                <Clock className="w-3.5 h-3.5 text-indigo-400" />
                Total video duration:
              </span>
              <span className="font-semibold text-slate-200">
                {formattedDuration} {duration ? `(${duration}s)` : ''}
              </span>
            </div>

            {/* Inputs: Start time and End time */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              {/* Start Time */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                  <span>Start time</span>
                  <button
                    type="button"
                    onClick={() => setStartTime('00:00')}
                    className="text-[11px] text-indigo-400 hover:text-indigo-300 transition-colors"
                  >
                    Reset (00:00)
                  </button>
                </label>
                <input
                  type="text"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  placeholder="MM:SS (e.g. 00:30)"
                  className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700/80 rounded-lg text-slate-100 placeholder-slate-500 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none transition-colors"
                />
              </div>

              {/* End Time */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                  <span>End time</span>
                  {duration && (
                    <button
                      type="button"
                      onClick={() => setEndTime(formattedDuration)}
                      className="text-[11px] text-indigo-400 hover:text-indigo-300 transition-colors"
                    >
                      Full ({formattedDuration})
                    </button>
                  )}
                </label>
                <input
                  type="text"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  placeholder="MM:SS (e.g. 01:45)"
                  className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700/80 rounded-lg text-slate-100 placeholder-slate-500 text-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 focus:outline-none transition-colors"
                />
              </div>
            </div>

            {/* Inline Error Message */}
            {trimError && (
              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-red-950/50 border border-red-800/60 text-red-300 text-xs font-medium">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                <span>{trimError}</span>
              </div>
            )}

            {/* Note about re-encoding */}
            <div className="flex items-start gap-2 pt-1 text-[11px] text-slate-400">
              <Info className="w-4 h-4 text-indigo-400/90 shrink-0 mt-0.5" />
              <span>
                Frame-accurate trimming re-encodes the clip — long clips may take a minute.
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
