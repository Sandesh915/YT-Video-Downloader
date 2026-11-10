import os
import shutil
import logging
from typing import Literal, Optional

from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from starlette.background import BackgroundTask

from downloader import (
    extract_video_info,
    download_video,
    get_ffmpeg_info,
    InvalidURLError,
    VideoUnavailableError,
    PrivateVideoError,
    RateLimitError,
    ExtractionFailedError,
    FFmpegNotFoundError,
    DownloaderException,
)

# Logging configuration
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("main")

app = FastAPI(
    title="Video Downloader API",
    description="Production-ready API to fetch video metadata and download videos from YouTube, Instagram, and Facebook.",
    version="1.1.0"
)

# Enable CORS for frontend development
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"],
)


# Request & Response Schemas
class VideoInfoRequest(BaseModel):
    url: str = Field(..., description="URL of the video to fetch info for (YouTube, Instagram, Facebook)")


class VideoInfoResponse(BaseModel):
    title: str
    thumbnail: Optional[str] = None
    duration: Optional[int] = None
    uploader: str
    platform: str


class VideoDownloadRequest(BaseModel):
    url: str = Field(..., description="URL of the video to download")
    quality: Literal["720p", "1080p"] = Field("720p", description="Target video resolution quality")
    start_time: Optional[str] = Field(None, description="Start timestamp (e.g. '01:30', '00:01:30', '90')")
    end_time: Optional[str] = Field(None, description="End timestamp (e.g. '02:45', '00:02:45', '165')")


class HealthResponse(BaseModel):
    status: str
    ffmpeg: bool
    ffmpeg_path: Optional[str] = None
    supported_platforms: list[str] = ["YouTube", "Instagram", "Facebook"]


def cleanup_temp_dir(path: str) -> None:
    """Removes temporary directory after streaming response finishes."""
    try:
        if os.path.exists(path):
            shutil.rmtree(path, ignore_errors=True)
            logger.info(f"Successfully cleaned up temporary directory: {path}")
    except Exception as e:
        logger.warning(f"Failed to cleanup temp directory {path}: {e}")


@app.get("/api/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint indicating server and ffmpeg status."""
    ffmpeg_available, ffmpeg_path = get_ffmpeg_info()
    return {
        "status": "ok",
        "ffmpeg": ffmpeg_available,
        "ffmpeg_path": ffmpeg_path,
        "supported_platforms": ["YouTube", "Instagram", "Facebook"]
    }


@app.post("/api/video/info", response_model=VideoInfoResponse)
async def get_video_info_endpoint(payload: VideoInfoRequest):
    """
    Fetches video metadata without downloading the media.
    Validates URL format, identifies platform, and queries yt-dlp metadata.
    """
    try:
        info = extract_video_info(payload.url)
        return info
    except InvalidURLError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except VideoUnavailableError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except PrivateVideoError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e)
        )
    except RateLimitError as e:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=str(e)
        )
    except ExtractionFailedError as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(e)
        )
    except DownloaderException as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )
    except Exception as e:
        logger.exception("Unexpected error in /api/video/info")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An unexpected internal error occurred: {str(e)}"
        )


@app.post("/api/video/download")
async def download_video_endpoint(payload: VideoDownloadRequest):
    """
    Downloads video using yt-dlp with the specified quality (720p/1080p),
    optional start/end trimming, merges streams via ffmpeg to mp4,
    and returns the file as a stream.
    Cleans up temporary directory after streaming via Starlette BackgroundTask.
    """
    try:
        file_path, filename, temp_dir = download_video(
            url=payload.url,
            quality=payload.quality,
            start_time=payload.start_time,
            end_time=payload.end_time
        )
        
        # Return FileResponse with background task cleanup
        return FileResponse(
            path=file_path,
            media_type="video/mp4",
            filename=filename,
            background=BackgroundTask(cleanup_temp_dir, temp_dir)
        )
    except InvalidURLError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except VideoUnavailableError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except PrivateVideoError as e:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e)
        )
    except RateLimitError as e:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=str(e)
        )
    except ExtractionFailedError as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(e)
        )
    except FFmpegNotFoundError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )
    except DownloaderException as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )
    except Exception as e:
        logger.exception("Unexpected error in /api/video/download")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An unexpected download error occurred: {str(e)}"
        )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
