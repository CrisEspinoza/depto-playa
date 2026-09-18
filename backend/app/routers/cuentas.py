import os
import tempfile
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from ..auth import get_current_user
from ..cuentas import parse_cuentas_xlsx
from .. import store

router = APIRouter(prefix="/api/cuentas", tags=["cuentas"])


@router.get("")
def get_cuentas(user=Depends(get_current_user)):
    monthly, details, source = store.get_cuentas()
    return {"cuentas": monthly, "cuentasDetails": details, "source": source}


@router.post("/upload")
async def upload_cuentas(file: UploadFile = File(...), user=Depends(get_current_user)):
    suffix = os.path.splitext(file.filename or "")[1] or ".xlsx"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(await file.read())
        path = tmp.name
    try:
        monthly, details = parse_cuentas_xlsx(path)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"No se pudo procesar cuentas: {e}")
    finally:
        os.unlink(path)
    store.save_cuentas(monthly, details, file.filename)
    return {"cuentas": monthly, "cuentasDetails": details, "source": file.filename}
