import pandas as pd
import os
import re
import sys
import argparse
import unicodedata


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
            # assume thousands separator or decimal depending on content
            if s.count(',') == 1 and len(s.split(',')[1]) == 3:
                s = s.replace(',', '')
            else:
                s = s.replace(',', '.')
        elif '.' in s:
            # keep as-is
            pass

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
            dt = value.to_pydatetime()
            return dt.strftime('%d/%m/%Y')
        except Exception:
            pass

    if isinstance(value, str):
        s = value.strip()
        if not s:
            return None

        if re.match(r'^\d{4}[-/]\d{1,2}[-/]\d{1,2}', s):
            try:
                dt = pd.to_datetime(s, dayfirst=True, errors='coerce')
                if pd.notna(dt):
                    return dt.strftime('%d/%m/%Y')
            except Exception:
                pass

        if re.match(r'^\d{1,2}[-/]\d{1,2}(?:[-/]\d{2,4})?$', s):
            # Try to infer year from file if missing
            if re.search(r'\d{4}$', s):
                try:
                    dt = pd.to_datetime(s, dayfirst=True, errors='coerce')
                    if pd.notna(dt):
                        return dt.strftime('%d/%m/%Y')
                except Exception:
                    pass
            else:
                try:
                    dt = pd.to_datetime(f"{s}/{fallback_year}", dayfirst=True, errors='coerce')
                    if pd.notna(dt):
                        return dt.strftime('%d/%m/%Y')
                except Exception:
                    pass

    try:
        dt = pd.to_datetime(value, dayfirst=True, errors='coerce')
        if pd.notna(dt):
            return dt.strftime('%d/%m/%Y')
    except Exception:
        return None


def find_header_row(xls_path, columns):
    # Read the Excel file without header
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
        raise ValueError("Header row with specified columns not found.")
    # Read again, setting header to the found row
    df = pd.read_excel(xls_path, header=header_row)
    source_to_canonical = {}
    for col in df.columns:
        canonical = _match_canonical_column(col)
        if canonical and canonical not in source_to_canonical.values():
            source_to_canonical[col] = canonical

    canonical_present = set(source_to_canonical.values())
    if not all(col in canonical_present for col in required_columns):
        raise ValueError("Header row with specified columns not found.")

    extracted_df = df[list(source_to_canonical.keys())].rename(columns=source_to_canonical)

    # Ensure canonical schema/order expected by downstream code.
    if 'N° de operación' not in extracted_df.columns:
        extracted_df['N° de operación'] = ''
    extracted_df = extracted_df[CANONICAL_COLUMNS]

    # Extract year from filename
    filename = os.path.basename(xls_path)
    year_match = re.search(r'(\d{4})', filename)
    if year_match:
        year = year_match.group(1)
    else:
        raise ValueError(f"Year not found in filename: {filename}")

    # Normalize dates and numeric columns.
    if 'Fecha' in extracted_df.columns:
        extracted_df['Fecha'] = extracted_df['Fecha'].apply(lambda v: _normalize_date(v, year))

    for col in ['Cargos', 'Abonos', 'Saldo']:
        if col in extracted_df.columns:
            extracted_df[col] = extracted_df[col].apply(_parse_numeric)

    # Drop rows without a valid date or with zero balance
    extracted_df = extracted_df.dropna(subset=['Fecha'])
    extracted_df = extracted_df[extracted_df['Saldo'] != 0]

    # Convert numeric columns to int where possible
    for col in ['Cargos', 'Abonos', 'Saldo']:
        if col in extracted_df.columns:
            extracted_df[col] = pd.to_numeric(extracted_df[col], errors='coerce').fillna(0)

    # Keep the original column order and return the cleaned dataframe.
    return extracted_df[CANONICAL_COLUMNS]


def multiple_files_extraction(file_list):
    all_data = []
    for file in file_list:
        try:
            data = extract_columns(file)
            all_data.append(data)
        except Exception as e:
            print(f"Error processing {file}: {e}")
    if all_data:
        return pd.concat(all_data, ignore_index=True)
    else:
        return pd.DataFrame()


def get_files_from_directory(directory_path):
    xls_files = [os.path.join(directory_path, f) for f in os.listdir(directory_path)]

    return xls_files


def get_all_movements_from_directory(directory_path):
    files = get_files_from_directory(directory_path)
    return multiple_files_extraction(files)


def extraction_totals(dataframe):
    total_cargos = dataframe['Cargos'].sum()
    total_abonos = dataframe['Abonos'].sum()
    return total_cargos, total_abonos


def extraction_by_regex(dataframe, pattern):
    regex = re.compile(pattern)
    filtered_df = dataframe[dataframe['Movimientos'].str.contains(regex, na=False)]
    return filtered_df
