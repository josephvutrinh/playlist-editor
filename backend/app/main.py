import anthropic
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .config import settings
from .routers import auth, playlists

app = FastAPI(title="Playlist Editor API")


@app.exception_handler(anthropic.APIStatusError)
async def anthropic_error_handler(request: Request, exc: anthropic.APIStatusError) -> JSONResponse:
    return JSONResponse(status_code=502, content={"detail": f"Claude API error: {exc.message}"})


@app.exception_handler(anthropic.APIConnectionError)
async def anthropic_connection_error_handler(
    request: Request, exc: anthropic.APIConnectionError
) -> JSONResponse:
    return JSONResponse(status_code=502, content={"detail": "Could not reach the Claude API"})

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(playlists.router)


@app.get("/health")
async def health() -> dict:
    return {"ok": True}
