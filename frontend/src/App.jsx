import React, { useState, useEffect } from 'react';
import { 
  Download, 
  Loader2, 
  CheckCircle2, 
  Sparkles, 
  ShieldCheck, 
  AlertTriangle,
  RefreshCw,
  Video,
  Scissors
} from 'lucide-react';

import UrlInput from './components/UrlInput';
import VideoCard from './components/VideoCard';
import QualitySelector from './components/QualitySelector';
import OrientationSelector from './components/OrientationSelector';
import Toast from './components/Toast';
import { 
  fetchVideoInfo, 
  downloadVideoFile, 
  checkServerHealth,
  parseTimestamp,
  formatSecondsToTime
} from './api';

export default function App() {
  const [url, setUrl] = useState('');
  const [videoInfo, setVideoInfo] = useState(null);
  const [quality, setQuality] = useState('720p');
  const [orientation, setOrientation] = useState('landscape'); // 'landscape' | 'portrait'
  
  // Trimming states
  const [isTrimEnabled, setIsTrimEnabled] = useState(false);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [trimError, setTrimError] = useState(null);

  // Status & Progress states
  const [isFetchingInfo, setIsFetchingInfo] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [toast, setToast] = useState(null); // { message, type: 'error' | 'success' | 'info' }
  const [serverStatus, setServerStatus] = useState(null); // { status, ffmpeg, ffmpeg_path }

  // Check backend server health on mount
  useEffect(() => {
    checkHealth();
  }, []);

  // Validate trim inputs in real-time when changed
  useEffect(() => {
    if (!isTrimEnabled) {
      setTrimError(null);
      return;
    }
    // Only run live validation if the user has touched end time
    if (endTime && endTime.trim()) {
      validateTrimInputs();
    } else {
      setTrimError(null);
    }
  }, [isTrimEnabled, startTime, endTime, videoInfo]);

  const checkHealth = async () => {
    try {
      const data = await checkServerHealth();
      setServerStatus(data);
    } catch {
      setServerStatus({ status: 'offline', ffmpeg: false, ffmpeg_path: null });
    }
  };

  const showToast = (message, type = 'error') => {
    setToast({ message, type });
  };

  // Client-side trim validation
  const validateTrimInputs = () => {
    if (!isTrimEnabled) return true;

    if (!endTime || !endTime.trim()) {
      const err = 'Please enter an End time (e.g. 01:30).';
      setTrimError(err);
      return false;
    }

    const startSec = startTime && startTime.trim() ? parseTimestamp(startTime) : 0;
    const endSec = parseTimestamp(endTime);

    if (startSec === null) {
      const err = 'Invalid Start time format. Use MM:SS, HH:MM:SS, or seconds.';
      setTrimError(err);
      return false;
    }

    if (endSec === null) {
      const err = 'Invalid End time format. Use MM:SS, HH:MM:SS, or seconds.';
      setTrimError(err);
      return false;
    }

    if (startSec < 0) {
      const err = 'Start time cannot be negative.';
      setTrimError(err);
      return false;
    }

    if (endSec <= startSec) {
      const err = 'End time must be strictly greater than start time.';
      setTrimError(err);
      return false;
    }

    if (videoInfo?.duration && endSec > videoInfo.duration) {
      const err = `End time (${formatSecondsToTime(endSec)}) cannot exceed total duration (${formatSecondsToTime(videoInfo.duration)}).`;
      setTrimError(err);
      return false;
    }

    setTrimError(null);
    return true;
  };

  // Fetch video metadata
  const handleFetchInfo = async () => {
    if (!url.trim()) {
      showToast('Please enter a valid video link.', 'error');
      return;
    }

    setIsFetchingInfo(true);
    setVideoInfo(null);
    setOrientation('landscape');
    setIsTrimEnabled(false);
    setStartTime('');
    setEndTime('');
    setTrimError(null);
    setDownloadSuccess(false);

    try {
      const data = await fetchVideoInfo(url);
      setVideoInfo(data);
      showToast(`Found "${data.title}"`, 'success');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setIsFetchingInfo(false);
    }
  };

  // Download video (full or trimmed)
  const handleDownload = async () => {
    if (!url.trim()) {
      showToast('Please enter a video URL first.', 'error');
      return;
    }

    // Client-side validation before submit when trimming
    if (isTrimEnabled) {
      const isValid = validateTrimInputs();
      if (!isValid) {
        showToast(trimError || 'Please fix invalid trim timestamps.', 'error');
        return;
      }
    }

    setIsDownloading(true);
    setDownloadSuccess(false);

    try {
      const trimParams = isTrimEnabled
        ? {
            startTime: startTime && startTime.trim() ? startTime.trim() : '00:00',
            endTime: endTime.trim(),
          }
        : null;

      const result = await downloadVideoFile(
        url, 
        quality,
        orientation,
        videoInfo?.title, 
        trimParams
      );

      setDownloadSuccess(true);
      showToast(`Saved ${result.filename} to your downloads!`, 'success');
      setTimeout(() => setDownloadSuccess(false), 4500);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col justify-between p-4 sm:p-6 md:p-8">
      {/* Toast Notification Container */}
      <Toast toast={toast} onClose={() => setToast(null)} />

      {/* Main Container */}
      <main className="max-w-2xl w-full mx-auto my-auto space-y-6">
        {/* Header */}
        <header className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-950/80 border border-indigo-700/50 text-indigo-300 text-xs font-semibold shadow-inner">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span>Fast, High-Definition Media Downloader & Clipper</span>
          </div>

          <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight text-white">
            Vid<span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400">Flow</span>
          </h1>

          <p className="text-sm sm:text-base text-slate-400 max-w-md mx-auto">
            Download or trim videos from <span className="text-red-400 font-semibold">YouTube</span>,{' '}
            <span className="text-pink-400 font-semibold">Instagram</span>, and{' '}
            <span className="text-blue-400 font-semibold">Facebook</span> in 720p or 1080p MP4.
          </p>

          {/* Server / FFmpeg status banner */}
          <div className="flex items-center justify-center gap-2 pt-1">
            {serverStatus?.status === 'ok' || serverStatus?.status === 'healthy' ? (
              <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400/90 font-medium bg-emerald-950/40 border border-emerald-800/40 px-2.5 py-0.5 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Backend Online
                {serverStatus.ffmpeg ? (
                  <span className="text-emerald-500 font-normal">| FFmpeg Active</span>
                ) : (
                  <span className="text-amber-400/90 font-normal">| FFmpeg Missing</span>
                )}
              </span>
            ) : serverStatus?.status === 'offline' ? (
              <button
                onClick={checkHealth}
                className="inline-flex items-center gap-1.5 text-xs text-rose-400 font-medium bg-rose-950/40 border border-rose-800/40 px-2.5 py-0.5 rounded-full hover:bg-rose-950/60 transition-colors"
                title="Click to retry connecting to backend"
              >
                <AlertTriangle className="w-3 h-3 text-rose-400" />
                Backend Offline (Click to retry)
                <RefreshCw className="w-3 h-3 ml-1" />
              </button>
            ) : null}
          </div>
        </header>

        {/* Card Wrapper */}
        <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-3xl p-5 sm:p-7 shadow-2xl space-y-6">
          {/* Step 1: URL Input */}
          <UrlInput
            url={url}
            setUrl={(newUrl) => {
              setUrl(newUrl);
              // Clear previous video card if user changes input
              if (videoInfo) {
                setVideoInfo(null);
                setIsTrimEnabled(false);
                setStartTime('');
                setEndTime('');
                setTrimError(null);
              }
            }}
            onFetch={handleFetchInfo}
            isLoading={isFetchingInfo}
            onShowToast={showToast}
          />

          {/* Loading Skeleton */}
          {isFetchingInfo && (
            <div className="w-full bg-slate-900/50 rounded-2xl border border-slate-800/70 p-5 space-y-4 animate-pulse">
              <div className="flex flex-col sm:flex-row gap-4 items-center">
                <div className="w-full sm:w-48 aspect-video bg-slate-800 rounded-xl" />
                <div className="flex-1 w-full space-y-3">
                  <div className="h-4 bg-slate-800 rounded w-1/4" />
                  <div className="h-5 bg-slate-800 rounded w-3/4" />
                  <div className="h-4 bg-slate-800 rounded w-1/2" />
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Video Metadata Card + Trimming Toggle */}
          {videoInfo && !isFetchingInfo && (
            <div className="transition-opacity duration-300">
              <VideoCard 
                videoInfo={videoInfo}
                isTrimEnabled={isTrimEnabled}
                setIsTrimEnabled={setIsTrimEnabled}
                startTime={startTime}
                setStartTime={setStartTime}
                endTime={endTime}
                setEndTime={setEndTime}
                trimError={trimError}
              />
            </div>
          )}

          {/* Step 3: Quality Selector */}
          <QualitySelector
            quality={quality}
            setQuality={setQuality}
            disabled={!videoInfo || isFetchingInfo || isDownloading}
          />

          {/* Step 4: Orientation Selector */}
          <OrientationSelector
            orientation={orientation}
            setOrientation={setOrientation}
            disabled={!videoInfo || isFetchingInfo || isDownloading}
          />

          {/* Step 5: Download Button */}
          <div className="pt-2">
            <button
              type="button"
              onClick={handleDownload}
              disabled={!videoInfo || isDownloading || isFetchingInfo}
              className={`w-full py-4 px-6 rounded-2xl font-bold text-base flex items-center justify-center gap-2.5 transition-all shadow-xl active:scale-[0.99] ${
                downloadSuccess
                  ? 'bg-emerald-600 text-white shadow-emerald-900/40'
                  : 'bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-indigo-950/60 hover:shadow-indigo-600/30'
              } disabled:opacity-40 disabled:pointer-events-none disabled:shadow-none`}
            >
              {isDownloading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin text-white" />
                  <span>
                    {isTrimEnabled
                      ? `Trimming & Merging Clip (${quality})...`
                      : `Downloading & Merging Streams (${quality})...`}
                  </span>
                </>
              ) : downloadSuccess ? (
                <>
                  <CheckCircle2 className="w-5 h-5 text-white animate-bounce" />
                  <span>Download Started!</span>
                </>
              ) : (
                <>
                  {isTrimEnabled ? (
                    <Scissors className="w-5 h-5 text-indigo-200" />
                  ) : (
                    <Download className="w-5 h-5 text-indigo-200" />
                  )}
                  <span>
                    {videoInfo
                      ? isTrimEnabled
                        ? `Download clip (${quality})`
                        : `Download Video (${quality})`
                      : 'Fetch Video to Enable Download'}
                  </span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Feature Badges */}
        <footer className="pt-2">
          <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-slate-500">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              <span>Safe & Ad-free</span>
            </div>
            <span>•</span>
            <div className="flex items-center gap-1.5">
              <Scissors className="w-4 h-4 text-indigo-400" />
              <span>Frame-accurate Video Trimming</span>
            </div>
            <span>•</span>
            <div className="flex items-center gap-1.5">
              <Video className="w-4 h-4 text-indigo-400" />
              <span>Direct MP4 Browser Save</span>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
