import os
import tempfile
from typing import Optional
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from ..auth import get_current_user
from ..extraction import extract_records_from_file
from ..categorization import categorize
from .. import store

router = APIRouter(prefix="/api/transactions", tags=["transactions"])


@router.post("/upload")
async def upload_transactions(file: UploadFile = File(...), user=Depends(get_current_user)):
    suffix = os.path.splitext(file.filename or "")[1] or ".xls"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(await file.read())
        path = tmp.name
    try:
        records = extract_records_from_file(path)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"No se pudo procesar el archivo: {e}")
    finally:
        os.unlink(path)
    if not records:
        raise HTTPException(status_code=400, detail="No se encontraron movimientos válidos en el archivo")
    stored = store.upsert_transactions(records, file.filename)
    return {"success": True, "processed": len(records), "stored": stored, "source": file.filename}


@router.get("")
def list_transactions(month: Optional[str] = None, user=Depends(get_current_user)):
    categories = store.get_categories()
    rows = store.get_transactions(month)
    rows.sort(key=lambda r: r.get("Fecha", ""))
    transactions = []
    uncategorized = []
    for r in rows:
        name, _ = categorize(r.get("Movimientos"), categories)
        item = {
            "Fecha": r.get("Fecha"),
            "Operacion": r.get("Operacion"),
            "Movimientos": r.get("Movimientos"),
            "Cargos": r.get("Cargos", 0),
            "Abonos": r.get("Abonos", 0),
            "Saldo": r.get("Saldo", 0),
            "category": name,
        }
        transactions.append(item)
        if not name:
            u = dict(item)
            u["category"] = "Uncategorized"
            uncategorized.append(u)
    return {"transactions": transactions, "uncategorized": uncategorized}
