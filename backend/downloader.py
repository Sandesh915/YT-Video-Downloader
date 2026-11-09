import os
import re
import shutil
import tempfile
import logging
from typing import Dict, Any, Tuple, Optional
import yt_dlp

logger = logging.getLogger("video_downloader")

# Regex patterns for supported platforms
YOUTUBE_REGEX = re.compile(
    r"^(https?://)?((www|m)\.)?(youtube\.com/(watch\?.*v=|shorts/|embed/|live/)|youtu\.be/)([a-zA-Z0-9_-]{11})",
    re.IGNORECASE
)

INSTAGRAM_REGEX = re.compile(
    r"^(https?://)?(www\.)?instagram\.com/(p|reel|reels|tv|share)/([a-zA-Z0-9_-]+)",
    re.IGNORECASE
)

FACEBOOK_REGEX = re.compile(
    r"^(https?://)?([a-zA-Z0-9_.]+\.)?(facebook\.com/(watch/?\?v=\d+|.+/videos/\d+|reel/\d+|share/[rv]/\w+)|fb\.watch/[\w-]+)",
    re.IGNORECASE
)


class InvalidURLError(Exception):
    """Raised when URL is invalid or not from a supported platform."""
    pass


class VideoUnavailableError(Exception):
    """Raised when video is deleted, not found, or unavailable (404)."""
    pass


class PrivateVideoError(Exception):
    """Raised when video is private, restricted, or requires authentication (422)."""
    pass


class DownloaderException(Exception):
    """Raised for server or extractor errors (500)."""
    pass


def detect_platform(url: str) -> Optional[str]:
    """
    Detects the platform (YouTube, Instagram, Facebook) based on regex.
    Returns the platform name or None if not supported.
    """
    url = url.strip()
    if YOUTUBE_REGEX.search(url):
        return "YouTube"
    if INSTAGRAM_REGEX.search(url):
        return "Instagram"
    if FACEBOOK_REGEX.search(url):
        return "Facebook"
    return None


def validate_url(url: str) -> str:
    """
    Validates URL and returns detected platform name.
    Raises InvalidURLError if invalid or unsupported.
    """
    if not url or not isinstance(url, str):
        raise InvalidURLError("URL must be a non-empty string.")
    
    cleaned_url = url.strip()
    platform = detect_platform(cleaned_url)
    if not platform:
        raise InvalidURLError(
            "Unsupported or invalid URL. Only YouTube, Instagram, and Facebook URLs are supported."
        )
    return platform


def classify_download_error(e: yt_dlp.utils.DownloadError) -> Exception:
    """Classifies a yt-dlp DownloadError into structured custom exceptions."""
    msg = str(e).lower()
    
    if any(k in msg for k in [
        "private video",
        "this video is private",
        "login required",
        "sign in if you've been granted access",
        "sign in to confirm you’re not a bot",
        "requires authentication",
        "only followers",
        "members-only",
        "account is private"
    ]):
        return PrivateVideoError("This video is private, restricted, or requires login credentials.")
    
    if any(k in msg for k in [
        "video unavailable",
        "not found",
        "does not exist",
        "has been removed",
        "deleted by the user",
        "is no longer available",
        "page not found",
        "404"
    ]):
        return VideoUnavailableError("The requested video is unavailable, deleted, or was not found.")
    
    if any(k in msg for k in [
        "unsupported url",
        "is not a valid url",
        "invalid url",
        "url is not supported"
    ]):
        return InvalidURLError("The provided video URL is invalid or unsupported.")
    
    return DownloaderException(f"Video extraction error: {str(e)}")


def extract_video_info(url: str) -> Dict[str, Any]:
    """
    Extracts video metadata WITHOUT downloading using yt-dlp.
    Returns: {"title", "thumbnail", "duration", "uploader", "platform"}
    """
    platform = validate_url(url)
    
    ydl_opts = {
        "skip_download": True,
        "quiet": True,
        "no_warnings": True,
        "extract_flat": False,
        "noplaylist": True,
        "no_color": True,
    }
    
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url.strip(), download=False)
            
            if not info:
                raise VideoUnavailableError("Could not retrieve video information.")
                
            # Handle playlist entries if returned
            if "entries" in info and info["entries"]:
                info = info["entries"][0]
                
            title = info.get("title") or "Untitled Video"
            thumbnail = info.get("thumbnail")
            
            # Select best thumbnail if thumbnails list exists and thumbnail is empty
            if not thumbnail and info.get("thumbnails"):
                thumbnail = info["thumbnails"][-1].get("url")
                
            duration = info.get("duration")
            if duration is not None:
                try:
                    duration = int(duration)
                except (ValueError, TypeError):
                    duration = None
                    
            uploader = (
                info.get("uploader")
                or info.get("channel")
                or info.get("creator")
                or info.get("uploader_id")
                or "Unknown Creator"
            )
            
            return {
                "title": title,
                "thumbnail": thumbnail,
                "duration": duration,
                "uploader": uploader,
                "platform": platform,
            }
            
    except yt_dlp.utils.DownloadError as e:
        raise classify_download_error(e)
    except (InvalidURLError, VideoUnavailableError, PrivateVideoError):
        raise
    except Exception as e:
        logger.exception("Unexpected error extracting video info")
        raise DownloaderException(f"An unexpected error occurred: {str(e)}")


def download_video(url: str, quality: str = "720p") -> Tuple[str, str, str]:
    """
    Downloads video with specified quality (720p or 1080p).
    Downloads into a TemporaryDirectory.
    Returns: (file_path, filename, temp_dir)
    """
    validate_url(url)
    
    # Parse quality height
    height = 1080 if quality == "1080p" else 720
    format_selector = f"bestvideo[height<={height}]+bestaudio/best[height<={height}]/best"
    
    temp_dir = tempfile.mkdtemp(prefix="video_downloader_")
    outtmpl = os.path.join(temp_dir, "%(title).150B.%(ext)s")
    
    ydl_opts = {
        "format": format_selector,
        "merge_output_format": "mp4",
        "outtmpl": outtmpl,
        "quiet": True,
        "no_warnings": True,
        "noplaylist": True,
        "no_color": True,
    }
    
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url.strip(), download=True)
            
            if not info:
                raise VideoUnavailableError("Failed to download video content.")
                
            # If playlist entry
            if "entries" in info and info["entries"]:
                info = info["entries"][0]
                
            # Find the downloaded file inside temp_dir
            downloaded_files = [
                f for f in os.listdir(temp_dir)
                if not f.endswith((".part", ".ytdl")) and os.path.isfile(os.path.join(temp_dir, f))
            ]
            
            if not downloaded_files:
                raise DownloaderException("Download completed but media file was not found.")
                
            # Pick the primary media file
            chosen_file = downloaded_files[0]
            file_path = os.path.join(temp_dir, chosen_file)
            
            # Generate a clean, user-friendly filename
            raw_title = info.get("title") or "video"
            safe_title = re.sub(r'[\\/*?:"<>|]', "", raw_title).strip() or "video"
            ext = os.path.splitext(chosen_file)[1] or ".mp4"
            filename = f"{safe_title}{ext}"
            
            return file_path, filename, temp_dir
            
    except yt_dlp.utils.DownloadError as e:
        # Clean up temp directory on failure
        shutil.rmtree(temp_dir, ignore_errors=True)
        raise classify_download_error(e)
    except Exception as e:
        shutil.rmtree(temp_dir, ignore_errors=True)
        if isinstance(e, (InvalidURLError, VideoUnavailableError, PrivateVideoError, DownloaderException)):
            raise
        logger.exception("Unexpected error during video download")
        raise DownloaderException(f"Failed to download video: {str(e)}")

