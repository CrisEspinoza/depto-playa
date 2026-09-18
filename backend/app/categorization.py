"""Categorización por patrones regex. DEFAULT sincronizado con el frontend."""
import re

DEFAULT_CATEGORIES = [
    {"name": "Airbnb", "type": "income", "pattern": "angon|iol|radar|proveedor|airbnb|aibnb", "description": "Ingresos de arriendos Airbnb"},
    {"name": "External Rent", "type": "income", "pattern": "guzman|jesus|deposito en efectivo", "description": "Ingresos de arriendos externos"},
    {"name": "Cleaning Services (Old)", "type": "expense", "pattern": "vidal", "description": "Servicio de aseo antiguo"},
    {"name": "Admin Services", "type": "expense", "pattern": "yuvi|yuviana|moreno|rentals", "description": "Servicios de administración"},
    {"name": "Admin Monthly Account", "type": "expense", "pattern": "protecc", "description": "Cuenta mensual de administración"},
    {"name": "Transfers to Cristian", "type": "expense", "pattern": "cristian", "description": "Transferencias a Cristian"},
    {"name": "Transfers to Keyla", "type": "expense", "pattern": "keyla", "description": "Transferencias a Keyla"},
    {"name": "Key Lock", "type": "expense", "pattern": "smart", "description": "Cerradura inteligente"},
]


def pattern_specificity(pattern):
    if not pattern:
        return 0
    return max((len(part.strip()) for part in str(pattern).split('|')), default=0)


def categorize(description, categories):
    """Devuelve (nombre, tipo) de la categoría que calce, o (None, None)."""
    if not description:
        return (None, None)
    ordered = sorted(categories, key=lambda c: pattern_specificity(c.get('pattern', '')), reverse=True)
    for cat in ordered:
        pattern = cat.get('pattern', '')
        if not pattern:
            continue
        try:
            if re.search(pattern, str(description), re.IGNORECASE):
                return (cat.get('name'), cat.get('type'))
        except re.error:
            continue
    return (None, None)
