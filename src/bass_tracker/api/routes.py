from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

router = APIRouter()


class ImportRequest(BaseModel):
    source_type: str = Field(description="local_file または youtube")
    display_title: str = Field(min_length=1, max_length=200)


@router.get("/practice-tracks", tags=["practice tracks"])
def list_practice_tracks() -> list[dict[str, str]]:
    """Return mock data until persistent storage is implemented."""
    return [
        {"id": "demo-1", "display_title": "Sample Song Official Video", "status": "ready"},
        {"id": "demo-2", "display_title": "Practice Track 01", "status": "partial"},
    ]


@router.post("/imports", status_code=status.HTTP_501_NOT_IMPLEMENTED, tags=["imports"])
def import_track(request: ImportRequest) -> None:
    """Reserved boundary for LocalFileImporter and YouTubeImporter."""
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail=f"Import is not implemented yet (source_type={request.source_type}).",
    )
