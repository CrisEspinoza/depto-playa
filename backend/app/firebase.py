"""Inicialización perezosa de Firebase Admin (Firestore + Auth)."""
import json
import firebase_admin
from firebase_admin import credentials, firestore, auth as fb_auth
from .config import get_settings

_app = None
_db = None


def _init():
    global _app, _db
    if _app is not None:
        return
    settings = get_settings()
    if settings.firebase_credentials_json:
        cred = credentials.Certificate(json.loads(settings.firebase_credentials_json))
    elif settings.google_credentials_file:
        cred = credentials.Certificate(settings.google_credentials_file)
    else:
        cred = credentials.ApplicationDefault()
    _app = firebase_admin.initialize_app(cred)
    _db = firestore.client()


def get_db():
    if _db is None:
        _init()
    return _db


def verify_id_token(token: str):
    if _app is None:
        _init()
    return fb_auth.verify_id_token(token)
