from typing import List
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from ..auth import get_current_user
from .. import store

router = APIRouter(prefix="/api/categories", tags=["categories"])


class Category(BaseModel):
    name: str
    type: str
    pattern: str = ""
    description: str = ""


class CategoriesPayload(BaseModel):
    categories: List[Category]


@router.get("")
def get_categories(user=Depends(get_current_user)):
    return {"categories": store.get_categories()}


@router.post("")
def save_categories(payload: CategoriesPayload, user=Depends(get_current_user)):
    cats = [c.model_dump() for c in payload.categories]
    store.save_categories(cats)
    return {"success": True, "count": len(cats)}
