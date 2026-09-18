from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from .config import get_settings
from .auth import get_current_user
from .routers import transactions, categories, cuentas

app = FastAPI(title="Beach Accounting API", version="2.0.0")

_settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=_settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(transactions.router)
app.include_router(categories.router)
app.include_router(cuentas.router)


@app.get("/api/health")
def health():
    return {"status": "ok", "service": "beach-accounting-api", "version": "2.0.0"}


@app.get("/api/me")
def me(user=Depends(get_current_user)):
    return {"user": user}
