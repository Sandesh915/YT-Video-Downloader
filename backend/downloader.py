import os
import re
import shutil
import subprocess
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
    """Raised when URL or input parameters are invalid (400)."""
    pass


class VideoUnavailableError(Exception):
    """Raised when video is deleted, not found, or unavailable (404)."""
    pass


class PrivateVideoError(Exception):
    """Raised when video is private, restricted, or requires authentication (422)."""
    pass


class RateLimitError(Exception):
    """Raised when YouTube or platform rate-limits or detects bot traffic (429)."""
    pass


class ExtractionFailedError(Exception):
    """Raised when extractor fails due to player changes needing yt-dlp update (502)."""
    pass


class FFmpegNotFoundError(Exception):
    """Raised when ffmpeg is not found on PATH or via FFMPEG_LOCATION (500)."""
    pass


class DownloaderException(Exception):
    """Raised for server or extractor errors (500)."""
    pass


def get_ffmpeg_info() -> Tuple[bool, Optional[str]]:
    """
    Locates ffmpeg on system PATH, via FFMPEG_LOCATION environment variable,
    or via bundled imageio_ffmpeg fallback.
    Returns: (is_installed: bool, resolved_path_or_location: str | None)
    """
    # 1. Check system PATH
    path_which = shutil.which("ffmpeg")
    if path_which:
        return True, path_which

    # 2. Check FFMPEG_LOCATION env var
    env_loc = os.getenv("FFMPEG_LOCATION")
    if env_loc and env_loc.strip():
        cleaned_env = env_loc.strip()
        if os.path.isdir(cleaned_env):
            for binary_name in ("ffmpeg.exe", "ffmpeg"):
                cand = os.path.join(cleaned_env, binary_name)
                if os.path.isfile(cand):
                    if cleaned_env not in os.environ.get("PATH", ""):
                        os.environ["PATH"] = cleaned_env + os.pathsep + os.environ.get("PATH", "")
                    return True, cand
            if cleaned_env not in os.environ.get("PATH", ""):
                os.environ["PATH"] = cleaned_env + os.pathsep + os.environ.get("PATH", "")
        return True, cleaned_env

    # 3. Fallback to imageio_ffmpeg if installed
    try:
        import imageio_ffmpeg
        exe = imageio_ffmpeg.get_ffmpeg_exe()
        if exe and os.path.isfile(exe):
            d = os.path.dirname(exe)
            std_binary = os.path.join(d, "ffmpeg.exe" if os.name == "nt" else "ffmpeg")
            if not os.path.exists(std_binary):
                try:
                    shutil.copyfile(exe, std_binary)
                except Exception:
                    pass
            if d not in os.environ.get("PATH", ""):
                os.environ["PATH"] = d + os.pathsep + os.environ.get("PATH", "")
            return True, d
    except (ImportError, Exception):
        pass

    return False, None


def get_base_ydl_opts() -> dict:
    """
    Common yt-dlp options required across all calls:
    - extractor_args with android + web + default player clients for YouTube extraction robustness
    - noplaylist, socket_timeout, retries
    - ffmpeg_location fallback
    - optional COOKIES_FILE or COOKIES_FROM_BROWSER
    """
    opts: Dict[str, Any] = {
        "extractor_args": {"youtube": {"player_client": ["android", "web", "default"]}},
        "noplaylist": True,
        "socket_timeout": 30,
        "retries": 3,
        "quiet": True,
        "no_warnings": True,
        "no_color": True,
    }

    # FFmpeg location fallback
    ffmpeg_found, ffmpeg_path = get_ffmpeg_info()
    env_ffmpeg = os.getenv("FFMPEG_LOCATION")
    if env_ffmpeg:
        opts["ffmpeg_location"] = env_ffmpeg.strip()
    elif ffmpeg_found and not shutil.which("ffmpeg") and ffmpeg_path:
        opts["ffmpeg_location"] = ffmpeg_path

    # Cookie support: COOKIES_FILE or COOKIES_FROM_BROWSER
    cookies_file = os.getenv("COOKIES_FILE")
    cookies_browser = os.getenv("COOKIES_FROM_BROWSER")
    if cookies_file and os.path.exists(cookies_file.strip()):
        opts["cookiefile"] = cookies_file.strip()
    elif cookies_browser:
        opts["cookiesfrombrowser"] = (cookies_browser.strip(),)

    return opts


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


def parse_timestamp(ts: str) -> float:
    """
    Parses timestamps into float seconds.
    Accepts:
      - "HH:MM:SS" (e.g. "01:23:45", "1:02:03")
      - "MM:SS" (e.g. "02:30", "4:15")
      - Plain seconds (e.g. "90", "90.5")
    Raises ValueError on negative values or invalid formatting.
    """
    if ts is None or not isinstance(ts, str):
        raise ValueError("Timestamp must be a non-empty string.")
    
    cleaned = ts.strip()
    if not cleaned:
        raise ValueError("Timestamp cannot be blank.")
    
    if cleaned.startswith("-"):
        raise ValueError("Timestamp cannot be negative.")

    parts = cleaned.split(":")
    if len(parts) == 1:
        try:
            val = float(parts[0])
            if val < 0:
                raise ValueError
            return val
        except ValueError:
            raise ValueError(f"Invalid seconds format: '{ts}'")
    elif len(parts) == 2:
        try:
            mins = int(parts[0])
            secs = float(parts[1])
            if mins < 0 or secs < 0 or secs >= 60:
                raise ValueError
            return mins * 60.0 + secs
        except ValueError:
            raise ValueError(f"Invalid MM:SS timestamp: '{ts}'")
    elif len(parts) == 3:
        try:
            hrs = int(parts[0])
            mins = int(parts[1])
            secs = float(parts[2])
            if hrs < 0 or mins < 0 or mins >= 60 or secs < 0 or secs >= 60:
                raise ValueError
            return hrs * 3600.0 + mins * 60.0 + secs
        except ValueError:
            raise ValueError(f"Invalid HH:MM:SS timestamp: '{ts}'")
    else:
        raise ValueError(f"Unsupported timestamp format: '{ts}'")


def format_timestamp_filename(seconds: float) -> str:
    """
    Formats seconds into a clean filesystem-safe representation: HH-MM-SS.
    Example: 90 -> 00-01-30
    """
    total = int(round(seconds))
    hrs = total // 3600
    mins = (total % 3600) // 60
    secs = total % 60
    return f"{hrs:02d}-{mins:02d}-{secs:02d}"


def classify_download_error(e: yt_dlp.utils.DownloadError) -> Exception:
    """
    Classifies a yt-dlp DownloadError into structured custom exceptions:
    - 429 RateLimitError (Sign in to confirm / bot detection)
    - 502 ExtractionFailedError (Player needs to be reloaded / extraction failed)
    - 422 PrivateVideoError (Private / restricted video)
    - 404 VideoUnavailableError (Deleted / missing video)
    - 400 InvalidURLError (Unsupported / malformed URL)
    """
    msg = str(e).lower()
    
    # 429: Rate-limiting / bot verification / sign in required
    if any(k in msg for k in [
        "sign in to confirm",
        "bot",
        "confirm you're not a bot",
        "confirm you’re not a bot",
        "please sign in",
        "http error 429",
    ]):
        return RateLimitError(
            "YouTube is rate-limiting this server. Configure COOKIES_FROM_BROWSER or COOKIES_FILE."
        )

    # 502: Player reload / extraction failed
    if any(k in msg for k in [
        "needs to be reloaded",
        "failed to extract",
        "the page needs to be reloaded",
        "unable to extract",
    ]):
        return ExtractionFailedError(
            "Extraction failed — run 'pip install -U yt-dlp' to update, then retry."
        )

    # 422: Private video / login required
    if any(k in msg for k in [
        "private video",
        "this video is private",
        "login required",
        "requires authentication",
        "only followers",
        "members-only",
        "account is private"
    ]):
        return PrivateVideoError("This video is private, restricted, or requires authentication.")

    # 404: Video unavailable / deleted / not found
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
        return VideoUnavailableError("The requested video was not found or is no longer available.")

    # 400: Invalid / unsupported URL
    if any(k in msg for k in [
        "unsupported url",
        "is not a valid url",
        "invalid url",
        "url is not supported"
    ]):
        return InvalidURLError("The provided video URL is invalid or unsupported.")

    return DownloaderException(f"Failed to process video: {str(e)}")


def extract_video_info(url: str) -> Dict[str, Any]:
    """
    Extracts video metadata WITHOUT downloading using yt-dlp.
    Returns: {"title", "thumbnail", "duration", "uploader", "platform"}
    """
    platform = validate_url(url)
    
    ydl_opts = get_base_ydl_opts()
    ydl_opts.update({
        "skip_download": True,
        "extract_flat": False,
        "ignore_no_formats_error": True,
    })
    
    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url.strip(), download=False)
            
            if not info:
                raise VideoUnavailableError("Could not retrieve video information.")
                
            if "entries" in info and info["entries"]:
                info = info["entries"][0]
                
            title = info.get("title") or "Untitled Video"
            thumbnail = info.get("thumbnail")
            
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
    except (InvalidURLError, VideoUnavailableError, PrivateVideoError, RateLimitError, ExtractionFailedError):
        raise
    except Exception as e:
        logger.exception("Unexpected error extracting video info")
        raise DownloaderException(f"An unexpected error occurred: {str(e)}")


def get_format_selector(quality: str, orientation: str = "landscape") -> str:
    """
    Returns a yt-dlp format selector string based on quality and orientation.

    Landscape (16:9): uses height-based quality selector (standard).
      - 720p  → bestvideo[height<=720]+bestaudio …
      - 1080p → bestvideo[height<=1080]+bestaudio …

    Portrait (9:16): also selects the best-quality SOURCE by height.
    Landscape sources are center-cropped to 9:16 afterwards via ffmpeg
    (crop_to_portrait), so we always grab the highest-quality source.
    Natively-portrait sources (Shorts/Reels) skip the crop step.
    """
    dim = 1080 if quality == "1080p" else 720

    # Both orientations select by height for max source quality;
    # portrait conversion happens in post-processing via ffmpeg.
    return (
        f"bestvideo[height<={dim}][vcodec!*=none]+bestaudio[acodec!*=none]"
        f"/bestvideo[height<={dim}]+bestaudio"
        f"/best[height<={dim}]"
        f"/best"
    )


def crop_to_portrait(file_path: str, ffmpeg_path: str, out_width: int = 720, out_height: int = 1280) -> str:
    """
    Center-crops a landscape video to 9:16 and scales to out_width x out_height
    (default 720x1280) using ffmpeg. Returns the path to the cropped file.
    The original file is removed after successful encoding.
    Raises DownloaderException on ffmpeg failure.
    """
    if not ffmpeg_path:
        raise FFmpegNotFoundError("ffmpeg binary not found for portrait conversion.")

    # ffmpeg_path may be a directory (e.g. imageio_ffmpeg location)
    if os.path.isdir(ffmpeg_path):
        candidate = os.path.join(ffmpeg_path, "ffmpeg.exe" if os.name == "nt" else "ffmpeg")
        if os.path.isfile(candidate):
            ffmpeg_path = candidate

    if not os.path.isfile(ffmpeg_path):
        raise FFmpegNotFoundError("ffmpeg binary not found for portrait conversion.")

    base, _ = os.path.splitext(file_path)
    out_path = f"{base}_portrait_cropped.mp4"

    cmd = [
        ffmpeg_path,
        "-y",
        "-i", file_path,
        "-vf", f"crop=ih*9/16:ih,scale={out_width}:{out_height}:flags=lanczos",
        "-c:v", "libx264",
        "-preset", "veryfast",
        "-crf", "23",
        "-c:a", "aac",
        "-b:a", "128k",
        "-movflags", "+faststart",
        out_path,
    ]

    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=900,
            creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0,
        )
        if result.returncode != 0 or not os.path.isfile(out_path):
            stderr_tail = (result.stderr or "")[-800:]
            raise DownloaderException(f"ffmpeg portrait crop failed: {stderr_tail}")
    except subprocess.TimeoutExpired:
        raise DownloaderException("ffmpeg portrait crop timed out (15 min limit).")

    # Remove the original landscape file, keep only the cropped one
    try:
        os.remove(file_path)
    except OSError:
        pass

    return out_path


def download_video(
    url: str,
    quality: str = "720p",
    orientation: str = "landscape",
    start_time: Optional[str] = None,
    end_time: Optional[str] = None
) -> Tuple[str, str, str]:
    """
    Downloads video with specified quality (720p or 1080p).
    Supports optional start_time and end_time range trimming via ffmpeg.
    Downloads into a TemporaryDirectory.
    Returns: (file_path, filename, temp_dir)
    """
    validate_url(url)

    # Ensure ffmpeg is available
    ffmpeg_available, ffmpeg_path = get_ffmpeg_info()
    if not ffmpeg_available:
        raise FFmpegNotFoundError(
            "ffmpeg not found. Install it or set FFMPEG_LOCATION env var."
        )

    # Determine if trimming is requested
    is_trimming = bool(
        (start_time and start_time.strip()) or (end_time and end_time.strip())
    )
    start_sec: float = 0.0
    end_sec: Optional[float] = None

    if is_trimming:
        # Parse start_time (treat missing start as 0)
        if start_time and start_time.strip():
            try:
                start_sec = parse_timestamp(start_time)
            except ValueError as e:
                raise InvalidURLError(f"Invalid start_time: {str(e)}")
        else:
            start_sec = 0.0

        # end_time is required when trimming
        if not end_time or not end_time.strip():
            raise InvalidURLError(
                "end_time is required when specifying a trim range."
            )

        try:
            end_sec = parse_timestamp(end_time)
        except ValueError as e:
            raise InvalidURLError(f"Invalid end_time: {str(e)}")

        # Validation: start >= 0, end > start
        if start_sec < 0:
            raise InvalidURLError("start_time must be greater than or equal to 0.")
        if end_sec <= start_sec:
            raise InvalidURLError("end_time must be strictly greater than start_time.")

    # Build format selector based on orientation
    format_selector = get_format_selector(quality, orientation)
    
    temp_dir = tempfile.mkdtemp(prefix="video_downloader_")
    outtmpl = os.path.join(temp_dir, "%(title).150B.%(ext)s")
    
    ydl_opts = get_base_ydl_opts()
    ydl_opts.update({
        "format": format_selector,
        "merge_output_format": "mp4",
        "outtmpl": outtmpl,
    })

    # For portrait, sort formats by ascending aspect_ratio so the most
    # vertical (portrait-like) format is preferred when candidates tie.
    if orientation == "portrait":
        ydl_opts["format_sort"] = ["aspect_ratio"]

    # Add trimming options if requested
    if is_trimming and end_sec is not None:
        ydl_opts["download_ranges"] = yt_dlp.utils.download_range_func(
            None, [(start_sec, end_sec)]
        )
        ydl_opts["force_keyframes_at_cuts"] = True

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            # First extract metadata to validate duration if trimming
            info = ydl.extract_info(url.strip(), download=False)
            if not info:
                raise VideoUnavailableError("Failed to retrieve video stream.")
                
            if "entries" in info and info["entries"]:
                info = info["entries"][0]

            duration = info.get("duration")
            if is_trimming and duration and end_sec is not None:
                if end_sec > float(duration):
                    raise InvalidURLError(
                        f"end_time ({end_sec:g}s) cannot exceed total video duration ({duration}s)."
                    )

            # Proceed to download
            ydl.download([url.strip()])
                
            downloaded_files = [
                f for f in os.listdir(temp_dir)
                if not f.endswith((".part", ".ytdl")) and os.path.isfile(os.path.join(temp_dir, f))
            ]
            
            if not downloaded_files:
                raise DownloaderException("Download completed but media file was not found.")
                
            chosen_file = downloaded_files[0]
            file_path = os.path.join(temp_dir, chosen_file)

            # Portrait conversion: center-crop landscape sources to 9:16
            if orientation == "portrait":
                src_w = info.get("width")
                src_h = info.get("height")
                if src_w and src_h and src_w > src_h:
                    _, ffmpeg_bin = get_ffmpeg_info()
                    if ffmpeg_bin:
                        file_path = crop_to_portrait(file_path, ffmpeg_bin)
                    else:
                        raise FFmpegNotFoundError(
                            "ffmpeg not found — cannot convert landscape source to 9:16."
                        )

            raw_title = info.get("title") or "video"
            safe_title = re.sub(r'[\\/*?:"<>|]', "", raw_title).strip() or "video"
            ext = os.path.splitext(chosen_file)[1] or ".mp4"
            orient_tag = "_portrait" if orientation == "portrait" else ""

            if is_trimming and end_sec is not None:
                start_label = format_timestamp_filename(start_sec)
                end_label = format_timestamp_filename(end_sec)
                filename = f"{safe_title}{orient_tag}_{start_label}-{end_label}{ext}"
            else:
                filename = f"{safe_title}{orient_tag}{ext}"
            
            return file_path, filename, temp_dir
            
    except yt_dlp.utils.DownloadError as e:
        shutil.rmtree(temp_dir, ignore_errors=True)
        raise classify_download_error(e)
    except Exception as e:
        shutil.rmtree(temp_dir, ignore_errors=True)
        if isinstance(e, (
            InvalidURLError, 
            VideoUnavailableError, 
            PrivateVideoError, 
            RateLimitError, 
            ExtractionFailedError, 
            FFmpegNotFoundError, 
            DownloaderException
        )):
            raise
        logger.exception("Unexpected error during video download")
        raise DownloaderException(f"Failed to download video: {str(e)}")
