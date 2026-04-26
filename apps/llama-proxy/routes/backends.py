from fastapi import APIRouter, HTTPException

import config
from models import BackendPatchRequest

router = APIRouter()


@router.get("/health")
async def health() -> dict:
    return {"status": "ok", "active_backend": config.active_backend["id"]}


@router.get("/config/backends")
async def get_backends() -> dict:
    return {"backends": config.BACKENDS, "active_id": config.active_backend["id"]}


@router.patch("/config/backend")
async def set_backend(request: BackendPatchRequest) -> dict:
    backend = next((b for b in config.BACKENDS if b["id"] == request.id), None)
    if not backend:
        raise HTTPException(status_code=404, detail=f"Backend '{request.id}' not found")
    with config._backend_lock:
        config.active_backend = backend
    config.logger.info("Switched active backend to: %s (%s)", backend["name"], backend["url"])
    return {"active_id": backend["id"]}
