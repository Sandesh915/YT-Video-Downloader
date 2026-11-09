import React, { useMemo } from 'react';
import { 
  Clipboard, 
  Search, 
  X, 
  Loader2, 
  Youtube, 
  Instagram, 
  Facebook, 
  Globe 
} from 'lucide-react';

// Regex patterns for client-side platform detection
const YOUTUBE_REGEX = /^(https?:\/\/)?((www|m)\.)?(youtube\.com\/(watch\?.*v=|shorts\/|embed\/|live\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i;
const INSTAGRAM_REGEX = /^(https?:\/\/)?(www\.)?instagram\.com\/(p|reel|reels|tv|share)\/([a-zA-Z0-9_-]+)/i;
const FACEBOOK_REGEX = /^(https?:\/\/)?([a-zA-Z0-9_.]+\.)?(facebook\.com\/(watch\/?\?v=\d+|.+\/videos\/\d+|reel\/\d+|share\/[rv]\/\w+)|fb\.watch\/[\w-]+)/i;

export default function UrlInput({ 
  url, 
  setUrl, 
  onFetch, 
  isLoading, 
  onShowToast 
}) {
  // Real-time detected platform
  const detectedPlatform = useMemo(() => {
    if (!url || !url.trim()) return null;
    const clean = url.trim();
    if (YOUTUBE_REGEX.test(clean)) return 'YouTube';
    if (INSTAGRAM_REGEX.test(clean)) return 'Instagram';
    if (FACEBOOK_REGEX.test(clean)) return 'Facebook';
    return 'Unknown';
  }, [url]);

  // Handle Clipboard Paste
  const handlePaste = async () => {
    try {
      if (!navigator.clipboard?.readText) {
        onShowToast('Clipboard access is not supported by your browser.', 'error');
        return;
      }
      const text = await navigator.clipboard.readText();
      if (text) {
        setUrl(text.trim());
      } else {
        onShowToast('Clipboard is empty.', 'info');
      }
    } catch {
      onShowToast('Could not access clipboard. Please paste manually.', 'error');
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !isLoading && url.trim()) {
      onFetch();
    }
  };

  return (
    <div className="w-full space-y-3">
      {/* Input container */}
      <div className="relative flex items-center">
        <div className="absolute left-4 text-slate-400 pointer-events-none">
          <Search className="w-5 h-5" />
        </div>

        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isLoading}
          placeholder="Paste YouTube, Instagram, or Facebook link here..."
          className="w-full pl-12 pr-28 py-4 bg-slate-900/90 text-slate-100 placeholder-slate-500 rounded-xl border border-slate-700/80 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none transition-all shadow-inner text-sm md:text-base disabled:opacity-60"
        />

        {/* Action buttons inside input */}
        <div className="absolute right-3 flex items-center gap-1.5">
          {url && !isLoading && (
            <button
              type="button"
              onClick={() => setUrl('')}
              className="p-1.5 text-slate-400 hover:text-slate-200 rounded-lg hover:bg-slate-800 transition-colors"
              title="Clear input"
            >
              <X className="w-4 h-4" />
            </button>
          )}

          <button
            type="button"
            onClick={handlePaste}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 hover:border-slate-600 transition-all active:scale-95 disabled:opacity-50"
            title="Paste from clipboard"
          >
            <Clipboard className="w-3.5 h-3.5 text-indigo-400" />
            <span className="hidden sm:inline">Paste</span>
          </button>
        </div>
      </div>

      {/* Meta Bar: Platform Badge & Fetch Button */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
        {/* Platform Badge */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-slate-400">Platform:</span>
          {detectedPlatform === 'YouTube' && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-950/80 text-red-300 border border-red-700/60 shadow-sm animate-in fade-in">
              <Youtube className="w-3.5 h-3.5 text-red-500" />
              YouTube
            </span>
          )}

          {detectedPlatform === 'Instagram' && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-gradient-to-r from-purple-950/80 via-pink-950/80 to-amber-950/80 text-pink-300 border border-pink-700/60 shadow-sm animate-in fade-in">
              <Instagram className="w-3.5 h-3.5 text-pink-400" />
              Instagram
            </span>
          )}

          {detectedPlatform === 'Facebook' && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-950/80 text-blue-300 border border-blue-700/60 shadow-sm animate-in fade-in">
              <Facebook className="w-3.5 h-3.5 text-blue-400" />
              Facebook
            </span>
          )}

          {detectedPlatform === 'Unknown' && (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-950/50 text-amber-300 border border-amber-800/40">
              <Globe className="w-3.5 h-3.5 text-amber-400" />
              Unsupported URL
            </span>
          )}

          {!detectedPlatform && (
            <span className="text-xs text-slate-500 italic">
              Waiting for link...
            </span>
          )}
        </div>

        {/* Fetch Info Button */}
        <button
          type="button"
          onClick={onFetch}
          disabled={isLoading || !url.trim() || detectedPlatform === 'Unknown'}
          className="flex items-center justify-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-medium text-sm rounded-xl shadow-lg shadow-indigo-600/25 transition-all hover:shadow-indigo-600/40 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none disabled:shadow-none"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-white" />
              <span>Fetching info...</span>
            </>
          ) : (
            <span>Fetch Video</span>
          )}
        </button>
      </div>
    </div>
  );
}

