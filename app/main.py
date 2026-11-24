from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.database import Base, SessionLocal, engine
from app.routers import atributos, auth, homologacoes
from app.seed import inicializar_dados_iniciais

FRONTEND_DIR = Path(__file__).resolve().parent.parent / "frontend"


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        inicializar_dados_iniciais(db)
    yield


app = FastAPI(
    title=settings.app_name,
    description=(
        "Aplicação web para gerenciamento, consulta, submissão, acompanhamento "
        "e homologação de atributos."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

app.include_router(auth.router)
app.include_router(atributos.router)
app.include_router(homologacoes.router)


@app.get("/api/health", tags=["Sistema"])
def healthcheck() -> dict[str, str]:
    return {"status": "ok"}


if FRONTEND_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(FRONTEND_DIR)), name="static")


@app.get("/", include_in_schema=False)
def pagina_inicial() -> FileResponse:
    return FileResponse(FRONTEND_DIR / "index.html")
