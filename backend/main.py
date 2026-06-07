"""FastAPI application entry point for VectorSearchWithRerank."""

import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from backend.config import PORT, RERANK_MODEL
from backend.database import init_pool, wait_for_database
from backend.migrate import run_migrations
from backend.reranker import init_ranker
from backend.auth import router as auth_router
from backend.routers.documents import router as documents_router
from backend.routers.search import router as search_router


# ---------------------------------------------------------------------------
# Lifespan — startup / shutdown hooks
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    print('[startup] Waiting for database...')
    wait_for_database()
    print('[startup] Initializing database pool...')
    init_pool()
    print('[startup] Running migrations...')
    run_migrations()
    print('[startup] Initializing FlashRank reranker...')
    init_ranker(RERANK_MODEL)
    print('[startup] ✅ Application ready!')
    yield
    # Shutdown
    print('[shutdown] Application shutting down.')


# ---------------------------------------------------------------------------
# Application
# ---------------------------------------------------------------------------

app = FastAPI(title='VectorSearchWithRerank', lifespan=lifespan)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=['http://localhost:5173', 'http://localhost:3000'],
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)


# Request logging
@app.middleware('http')
async def log_requests(request: Request, call_next):
    path = request.url.path
    if path.startswith('/api') or path == '/':
        print(f'[HTTP] 📥 {request.method} {path}')
    response = await call_next(request)
    if path.startswith('/api') or path == '/':
        print(f'[HTTP] 📤 {request.method} {path} - Status: {response.status_code}')
    return response


# ---------------------------------------------------------------------------
# API Routes
# ---------------------------------------------------------------------------

app.include_router(auth_router)
app.include_router(documents_router)
app.include_router(search_router)

# ---------------------------------------------------------------------------
# Static files — serve built frontend
# ---------------------------------------------------------------------------

FRONTEND_DIST = os.path.join(
    os.path.dirname(os.path.dirname(__file__)), 'frontend', 'dist'
)

if os.path.isdir(os.path.join(FRONTEND_DIST, 'assets')):
    app.mount(
        '/assets',
        StaticFiles(directory=os.path.join(FRONTEND_DIST, 'assets')),
        name='assets',
    )


# ---------------------------------------------------------------------------
# SPA fallback — serves index.html for all non-API paths
# ---------------------------------------------------------------------------

@app.get('/{full_path:path}')
async def serve_spa(request: Request, full_path: str):
    if full_path.startswith('api'):
        return JSONResponse(status_code=404, content={'error': 'Not Found'})
    index_path = os.path.join(FRONTEND_DIST, 'index.html')
    if os.path.isfile(index_path):
        return FileResponse(index_path)
    return JSONResponse(status_code=404, content={'error': 'Frontend not built'})
