import axios from 'axios';

// Configure base API client
const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000',
  timeout: 300000, // 5 minutes timeout for large downloads
  headers: {
    'Content-Type': 'application/json',
  },
});

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
      return 'Invalid or unsupported video URL. Please provide a YouTube, Instagram, or Facebook link.';
    case 404:
      return 'The requested video was not found, is deleted, or is unavailable.';
    case 422:
      return 'This video is private, restricted, or requires authentication.';
    case 500:
      return 'Server error processing the video. Please check if FFmpeg is installed.';
    default:
      return `Request failed with status code ${status}.`;
  }
}

/**
 * Checks server health and ffmpeg status.
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
 * Downloads video and triggers browser file save.
 */
export async function downloadVideoFile(url, quality, videoTitle = 'video') {
  try {
    const response = await apiClient.post(
      '/api/video/download',
      { url: url.trim(), quality },
      { responseType: 'blob' }
    );

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
