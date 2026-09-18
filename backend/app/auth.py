from fastapi import HTTPException, Header
from .config import get_settings
from . import firebase


async def get_current_user(authorization: str = Header(None)):
    """Valida el ID token de Firebase y la lista de correos autorizados."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Falta el token de autenticacion")
    token = authorization.split(" ", 1)[1]
    try:
        decoded = firebase.verify_id_token(token)
    except Exception:
        raise HTTPException(status_code=401, detail="Token invalido o expirado")

    email = (decoded.get("email") or "").lower()
    settings = get_settings()
    if settings.allowed_emails and email not in settings.allowed_emails:
        raise HTTPException(status_code=403, detail="Tu cuenta no esta autorizada para esta app")

    return {"uid": decoded.get("uid"), "email": email, "name": decoded.get("name")}
