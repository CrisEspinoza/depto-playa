"""Extracción de movimientos desde cartolas .xls/.xlsx (portado y validado)."""
import os
import re
import unicodedata
import pandas as pd

CANONICAL_COLUMNS = ['Fecha', 'N° de operación', 'Movimientos', 'Cargos', 'Abonos', 'Saldo']


def _normalize_header_name(value):
    if value is None:
        return ''
    text = str(value).strip().lower()
    text = unicodedata.normalize('NFKD', text)
    text = ''.join(ch for ch in text if not unicodedata.combining(ch))
    text = re.sub(r'[^a-z0-9]+', ' ', text)
    return re.sub(r'\s+', ' ', text).strip()


def _match_canonical_column(value):
    n = _normalize_header_name(value)
    if n == 'fecha':
        return 'Fecha'
    if n in {'n de operacion', 'numero de operacion', 'documentos', 'documento'}:
        return 'N° de operación'
    if n == 'movimientos':
        return 'Movimientos'
    if n == 'cargos':
        return 'Cargos'
    if n == 'abonos':
        return 'Abonos'
    if n == 'saldo':
        return 'Saldo'
    return None


def _parse_numeric(value):
    if pd.isna(value):
        return 0
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        s = value.strip()
        if not s or s.lower() in {'nan', 'none', 'n/a', '-', '–'}:
            return 0
        negative = False
        if s.startswith('(') and s.endswith(')'):
            negative = True
            s = s[1:-1].strip()
        s = s.replace('$', '').replace(' ', '')
        if ',' in s and '.' in s:
            s = s.replace('.', '').replace(',', '.')
        elif ',' in s:
            if s.count(',') == 1 and len(s.split(',')[1]) == 3:
                s = s.replace(',', '')
            else:
                s = s.replace(',', '.')
        try:
            amount = float(s)
            return -amount if negative else amount
        except ValueError:
            return 0
    return 0


def _normalize_date(value, fallback_year):
    if pd.isna(value):
        return None
    if hasattr(value, 'to_pydatetime'):
        try:
            return value.to_pydatetime().strftime('%d/%m/%Y')
        except Exception:
            pass
    if isinstance(value, str):
        s = value.strip()
        if not s:
            return None
        if re.match(r'^\d{4}[-/]\d{1,2}[-/]\d{1,2}', s):
            dt = pd.to_datetime(s, dayfirst=True, errors='coerce')
            if pd.notna(dt):
                return dt.strftime('%d/%m/%Y')
        if re.match(r'^\d{1,2}[-/]\d{1,2}(?:[-/]\d{2,4})?$', s):
            if re.search(r'\d{4}$', s):
                dt = pd.to_datetime(s, dayfirst=True, errors='coerce')
                if pd.notna(dt):
                    return dt.strftime('%d/%m/%Y')
            else:
                dt = pd.to_datetime(f"{s}/{fallback_year}", dayfirst=True, errors='coerce')
                if pd.notna(dt):
                    return dt.strftime('%d/%m/%Y')
    dt = pd.to_datetime(value, dayfirst=True, errors='coerce')
    if pd.notna(dt):
        return dt.strftime('%d/%m/%Y')
    return None


def find_header_row(xls_path, columns):
    df = pd.read_excel(xls_path, header=None)
    for idx, row in df.iterrows():
        mapped = set()
        for v in row.tolist():
            if pd.notna(v):
                canonical = _match_canonical_column(v)
                if canonical:
                    mapped.add(canonical)
        if all(col in mapped for col in columns):
            return idx
    return None


def extract_columns(xls_path):
    required_columns = ['Fecha', 'Movimientos', 'Cargos', 'Abonos', 'Saldo']
    header_row = find_header_row(xls_path, required_columns)
    if header_row is None:
        raise ValueError("No se encontró la fila de encabezados con las columnas esperadas.")
    df = pd.read_excel(xls_path, header=header_row)
    source_to_canonical = {}
    for col in df.columns:
        canonical = _match_canonical_column(col)
        if canonical and canonical not in source_to_canonical.values():
            source_to_canonical[col] = canonical
    canonical_present = set(source_to_canonical.values())
    if not all(col in canonical_present for col in required_columns):
        raise ValueError("Faltan columnas requeridas en el archivo.")
    extracted_df = df[list(source_to_canonical.keys())].rename(columns=source_to_canonical)
    if 'N° de operación' not in extracted_df.columns:
        extracted_df['N° de operación'] = ''
    extracted_df = extracted_df[CANONICAL_COLUMNS]

    filename = os.path.basename(xls_path)
    year_match = re.search(r'(\d{4})', filename)
    year = year_match.group(1) if year_match else str(pd.Timestamp.now().year)

    extracted_df['Fecha'] = extracted_df['Fecha'].apply(lambda v: _normalize_date(v, year))
    for col in ['Cargos', 'Abonos', 'Saldo']:
        extracted_df[col] = extracted_df[col].apply(_parse_numeric)

    extracted_df = extracted_df.dropna(subset=['Fecha'])
    extracted_df = extracted_df[extracted_df['Saldo'] != 0]
    for col in ['Cargos', 'Abonos', 'Saldo']:
        extracted_df[col] = pd.to_numeric(extracted_df[col], errors='coerce').fillna(0)
    return extracted_df[CANONICAL_COLUMNS]


def extract_records_from_file(xls_path):
    """Devuelve una lista de dicts listos para Firestore (fecha ISO + mes)."""
    df = extract_columns(xls_path)
    records = []
    for _, row in df.iterrows():
        dt = pd.to_datetime(row['Fecha'], format='%d/%m/%Y', errors='coerce')
        if pd.isna(dt):
            continue
        records.append({
            'Fecha': dt.strftime('%Y-%m-%d'),
            'Operacion': str(row.get('N° de operación') or ''),
            'Movimientos': str(row.get('Movimientos') or ''),
            'Cargos': float(row.get('Cargos') or 0),
            'Abonos': float(row.get('Abonos') or 0),
            'Saldo': float(row.get('Saldo') or 0),
            'month': dt.strftime('%Y-%m'),
        })
    return records
