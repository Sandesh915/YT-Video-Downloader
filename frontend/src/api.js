import axios from 'axios';

// Configure base API client
const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
  timeout: 300000, // 5 minutes timeout for large downloads and trims
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Parses timestamp strings into seconds (float).
 * Supports "HH:MM:SS", "MM:SS", and plain seconds ("90").
 * Returns null if invalid or negative.
 */
export function parseTimestamp(ts) {
  if (!ts || typeof ts !== 'string') return null;
  const cleaned = ts.trim();
  if (!cleaned || cleaned.startsWith('-')) return null;

  const parts = cleaned.split(':');
  if (parts.length === 1) {
    const val = parseFloat(parts[0]);
    return isNaN(val) || val < 0 ? null : val;
  }
  if (parts.length === 2) {
    const mins = parseInt(parts[0], 10);
    const secs = parseFloat(parts[1]);
    if (isNaN(mins) || isNaN(secs) || mins < 0 || secs < 0 || secs >= 60) return null;
    return mins * 60 + secs;
  }
  if (parts.length === 3) {
    const hrs = parseInt(parts[0], 10);
    const mins = parseInt(parts[1], 10);
    const secs = parseFloat(parts[2]);
    if (isNaN(hrs) || isNaN(mins) || isNaN(secs) || hrs < 0 || mins < 0 || mins >= 60 || secs < 0 || secs >= 60) {
      return null;
    }
    return hrs * 3600 + mins * 60 + secs;
  }
  return null;
}

/**
 * Formats seconds into MM:SS or HH:MM:SS string.
 */
export function formatSecondsToTime(seconds) {
  if (seconds === null || seconds === undefined || isNaN(seconds)) return '00:00';
  const total = Math.round(seconds);
  const hrs = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (hrs > 0) {
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Parses filename from Content-Disposition header.
 * Supports standard filename and RFC 5987 filename*=UTF-8''
 */
export function getFilenameFromResponse(response, fallback = 'video.mp4') {
  const header = response.headers?.['content-disposition'];
  if (!header) return fallback;

  // Check for RFC 5987 encoded filename
  const rfcMatch = header.match(/filename\*=UTF-8''([^;]+)/i);
  if (rfcMatch && rfcMatch[1]) {
    try {
      return decodeURIComponent(rfcMatch[1].trim());
    } catch {
      // fallback if decoding fails
    }
  }

  // Check for standard filename
  const standardMatch = header.match(/filename="?([^";]+)"?/i);
  if (standardMatch && standardMatch[1]) {
    return standardMatch[1].trim();
  }

  return fallback;
}

/**
 * Extracts a human-friendly error message from an Axios error,
 * including handling error blobs when responseType is 'blob'.
 */
export async function extractErrorMessage(error) {
  if (!error.response) {
    if (error.code === 'ECONNABORTED') {
      return 'Request timed out. Please try again.';
    }
    return error.message || 'Network error: Unable to reach the backend server.';
  }

  const { status, data } = error.response;

  // If response is a Blob (from /api/video/download), convert to JSON
  if (data instanceof Blob) {
    try {
      const text = await data.text();
      const parsed = JSON.parse(text);
      if (parsed.detail) return parsed.detail;
    } catch {
      // Not JSON or parse failed
    }
  }

  if (data?.detail) {
    return typeof data.detail === 'string' ? data.detail : JSON.stringify(data.detail);
  }

  switch (status) {
    case 400:
      return 'Invalid or unsupported request. Please check your URL and trim timestamps.';
    case 404:
      return 'The requested video was not found, is deleted, or is unavailable.';
    case 422:
      return 'This video is private, restricted, or requires authentication.';
    case 429:
      return 'YouTube is rate-limiting this server. Configure COOKIES_FROM_BROWSER or COOKIES_FILE.';
    case 502:
      return "Extraction failed — run 'pip install -U yt-dlp' to update, then retry.";
    case 500:
      return 'ffmpeg not found or internal server error. Install ffmpeg or set FFMPEG_LOCATION env var.';
    default:
      return `Request failed with status code ${status}.`;
  }
}

/**
 * Checks server health and ffmpeg status.
 * Returns: { status: "ok", ffmpeg: boolean, ffmpeg_path: string | null }
 */
export async function checkServerHealth() {
  const response = await apiClient.get('/api/health');
  return response.data;
}

/**
 * Fetches video metadata without downloading.
 */
export async function fetchVideoInfo(url) {
  try {
    const response = await apiClient.post('/api/video/info', { url: url.trim() });
    return response.data;
  } catch (error) {
    const message = await extractErrorMessage(error);
    throw new Error(message);
  }
}

/**
 * Downloads video (full or trimmed) and triggers browser file save.
 * @param {string} url
 * @param {string} quality - '720p' or '1080p'
 * @param {string} orientation - 'landscape' or 'portrait'
 * @param {string} videoTitle - Video title fallback
 * @param {{ startTime?: string, endTime?: string } | null} trim - Optional trim parameters
 */
export async function downloadVideoFile(url, quality, orientation = 'landscape', videoTitle = 'video', trim = null) {
  try {
    const payload = {
      url: url.trim(),
      quality,
      orientation,
      start_time: trim?.startTime ? trim.startTime.trim() : null,
      end_time: trim?.endTime ? trim.endTime.trim() : null,
    };

    const response = await apiClient.post('/api/video/download', payload, {
      responseType: 'blob',
    });

    // Determine filename
    const safeTitleFallback = `${videoTitle.replace(/[\\/*?:"<>|]/g, '').trim() || 'video'}.mp4`;
    const filename = getFilenameFromResponse(response, safeTitleFallback);

    // Create object URL and trigger browser download
    const blob = new Blob([response.data], { type: 'video/mp4' });
    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();

    // Clean up DOM and memory
    link.remove();
    setTimeout(() => {
      window.URL.revokeObjectURL(downloadUrl);
    }, 1000);

    return { success: true, filename };
  } catch (error) {
    const message = await extractErrorMessage(error);
    throw new Error(message);
  }
}

export default apiClient;
