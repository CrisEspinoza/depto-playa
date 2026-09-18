"""Categorización por patrones regex. DEFAULT sincronizado con el frontend."""
import re

DEFAULT_CATEGORIES = [
    {"name": "Airbnb", "type": "income", "pattern": "angon|iol|radar|proveedor|airbnb|aibnb", "description": "Ingresos Airbnb"},
    {"name": "External Rent", "type": "income", "pattern": "guzman|jesus|deposito en efectivo", "description": "Arriendos externos"},
    {"name": "Aporte Michael", "type": "income", "pattern": "de michael", "description": "Recibido de Michael"},
    {"name": "Cristian income", "type": "income", "pattern": "de cristian", "description": "Recibido de Cristian"},
    {"name": "Administracion", "type": "expense", "pattern": "yuvi|yuviana|moreno|rentals", "description": "Administracion"},
    {"name": "Admin Monthly Account", "type": "expense", "pattern": "protecc", "description": "Cuenta admin mensual"},
    {"name": "Transferencia a Cristian", "type": "expense", "pattern": "a cristian", "description": "Enviado a Cristian"},
    {"name": "Transferencia a Keyla", "type": "expense", "pattern": "a keyla", "description": "Enviado a Keyla"},
    {"name": "Transferencia a Michael", "type": "expense", "pattern": "a michael", "description": "Enviado a Michael"},
    {"name": "Tarjeta de Credito", "type": "expense", "pattern": "tarjeta de credito|tarjeta credito|deuda inter|pago automat", "description": "Pago de tarjeta"},
    {"name": "Key Lock", "type": "expense", "pattern": "smart", "description": "Cerradura inteligente"},
    {"name": "Aseo", "type": "expense", "pattern": "vidal", "description": "Aseo"},
    {"name": "Servicios (en Cuentas)", "type": "ignore", "pattern": "chilquinta|esval|movistar|aguas", "description": "Luz/Agua/Internet van del Excel de Cuentas"},
    {"name": "Deposito a Plazo (DAP)", "type": "ignore", "pattern": "inversion dap|pago dap|deposito a plazo", "description": "Ahorro interno"},
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
