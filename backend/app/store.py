"""Acceso a datos en Firestore: categorías, transacciones y cuentas."""
import re
import hashlib
from google.cloud.firestore_v1.base_query import FieldFilter
from . import firebase
from .categorization import DEFAULT_CATEGORIES


def _slug(name):
    s = re.sub(r'[^a-zA-Z0-9]+', '-', str(name).strip().lower()).strip('-')
    return s or 'x'


# ── Categorías ────────────────────────────────────────────────────────────
def get_categories():
    db = firebase.get_db()
    docs = list(db.collection('categories').stream())
    if not docs:
        save_categories(DEFAULT_CATEGORIES)
        return DEFAULT_CATEGORIES
    return [d.to_dict() for d in docs]


def save_categories(categories):
    db = firebase.get_db()
    col = db.collection('categories')
    batch = db.batch()
    for d in col.stream():
        batch.delete(d.reference)
    for c in categories:
        batch.set(col.document(_slug(c['name'])), {
            'name': c['name'],
            'type': c.get('type'),
            'pattern': c.get('pattern', ''),
            'description': c.get('description', ''),
        })
    batch.commit()
    return categories


# ── Transacciones ─────────────────────────────────────────────────────────
def _tx_id(rec):
    key = f"{rec['Fecha']}|{rec['Operacion']}|{rec['Movimientos']}|{rec['Cargos']}|{rec['Abonos']}|{rec['Saldo']}"
    return hashlib.sha1(key.encode('utf-8')).hexdigest()


def upsert_transactions(records, source_name):
    """Guarda movimientos evitando duplicados (id determinístico)."""
    db = firebase.get_db()
    col = db.collection('transactions')
    batch = db.batch()
    n = 0
    stored = 0
    for rec in records:
        data = dict(rec)
        data['sourceFile'] = source_name
        batch.set(col.document(_tx_id(rec)), data)
        n += 1
        stored += 1
        if n >= 400:
            batch.commit()
            batch = db.batch()
            n = 0
    if n:
        batch.commit()
    return stored


def get_transactions(month=None):
    db = firebase.get_db()
    col = db.collection('transactions')
    if month:
        docs = col.where(filter=FieldFilter('month', '==', month)).stream()
    else:
        docs = col.stream()
    return [d.to_dict() for d in docs]


def count_transactions():
    db = firebase.get_db()
    return len(list(db.collection('transactions').select([]).stream()))


# ── Cuentas fijas ─────────────────────────────────────────────────────────
def save_cuentas(monthly, details, source):
    db = firebase.get_db()
    col = db.collection('cuentas')
    batch = db.batch()
    for d in col.stream():
        batch.delete(d.reference)
    for sheet, m in monthly.items():
        batch.set(col.document(_slug(sheet)), {
            'name': sheet,
            'monthly': m,
            'details': details.get(sheet, []),
        })
    batch.commit()
    db.collection('meta').document('cuentas').set({'source': source})


def get_cuentas():
    db = firebase.get_db()
    monthly = {}
    details = {}
    for d in db.collection('cuentas').stream():
        data = d.to_dict()
        monthly[data['name']] = data.get('monthly', {})
        details[data['name']] = data.get('details', [])
    source = None
    meta = db.collection('meta').document('cuentas').get()
    if meta.exists:
        source = meta.to_dict().get('source')
    return monthly, details, source
