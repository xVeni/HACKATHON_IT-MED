"""
FastAPI main application — Hip Dysplasia DICOM Analyzer
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers import upload, recalculate
from services.neural_service import ensure_orchestrator, stop_orchestrator


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Start neural orchestrator on startup, stop on shutdown."""
    try:
        ensure_orchestrator()
    except Exception as e:
        print(f"[WARNING] Neural orchestrator failed to start: {e}. Demo mode active.")
    yield
    stop_orchestrator()


app = FastAPI(
    title="Hip Dysplasia Analyzer API",
    description="Medical imaging API for analyzing hip joint X-rays to detect dysplasia",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS - allow frontend dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(upload.router, tags=["Analysis"])
app.include_router(recalculate.router, tags=["Analysis"])


@app.get("/health")
async def health():
    return {"status": "ok", "service": "hip-dysplasia-analyzer"}
