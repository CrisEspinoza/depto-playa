#!/usr/bin/env python3
"""
Beach Accounting API Server
Provides REST endpoints for the React frontend to:
- List available CSV files
- Load specific CSV files
- Run the summary script
- Export monthly summaries
- Provide uncategorized transactions
- Parse Cuentas xlsx (Luz, Agua, Dividendo, Gastos Comunes, Internet)
- Upload a Cuentas xlsx file
"""

import os
import re
import sys
import json
import io
import cgi
import tempfile
import subprocess
import datetime
import math
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
import pandas as pd

# ── Paths ────────────────────────────────────────────────────────────────────
BASE_DIR       = os.path.dirname(os.path.abspath(__file__))
OUTPUT_DIR     = os.path.join(BASE_DIR, "output")
HISTORIAL_DIR  = os.path.join(BASE_DIR, "movement_historial")
SUMMARY_SCRIPT = os.path.join(BASE_DIR, "summary_app.py")

# Default cuentas file location
DEFAULT_CUENTAS = os.path.join(HISTORIAL_DIR, "cuentas_2026_03.xlsx")
CUSTOM_CATEGORIES_FILE = os.path.join(BASE_DIR, "custom_categories.json")

# All patterns from regex_categories.py / categories.js (kept in sync)
CATEGORY_PATTERNS = [
    ("Airbnb",                 r"angon|iol|radar|proveedor|airbnb|aibnb"),
    ("External Rent",          r"guzman|jesus|deposito en efectivo"),
    ("Cleaning Services (Old)",r"vidal"),
    ("Admin Services",         r"yuvi|yuviana|moreno|rentals"),
    ("Admin Monthly Account",  r"protecc"),
    ("Transfers to Cristian",  r"cristian"),
    ("Transfers to Keyla",     r"keyla"),
    ("Key Lock",               r"smart"),
]

def pattern_specificity(pattern):
    if not pattern:
        return 0
    return max((len(part.strip()) for part in str(pattern).split('|')), default=0)

def parse_category_patterns(raw_categories):
    parsed = []
    for category in raw_categories:
        if not isinstance(category, dict):
            continue
        name = str(category.get("name", "")).strip()
        pattern = str(category.get("pattern", "")).strip()
        if name and pattern:
            parsed.append((name, pattern))
    return parsed


def load_active_category_patterns():
    if not os.path.isfile(CUSTOM_CATEGORIES_FILE):
        return CATEGORY_PATTERNS
    try:
        with open(CUSTOM_CATEGORIES_FILE, "r", encoding="utf-8") as handle:
            raw_categories = json.load(handle)
        if not isinstance(raw_categories, list):
            return CATEGORY_PATTERNS
        return parse_category_patterns(raw_categories)
    except Exception:
        return CATEGORY_PATTERNS


def find_category(description, category_patterns=None):
    if not description:
        return None
    patterns = load_active_category_patterns() if category_patterns is None else category_patterns
    for name, pattern in sorted(patterns, key=lambda item: pattern_specificity(item[1]), reverse=True):
        if re.search(pattern, str(description), re.IGNORECASE):
            return name
    return None


# ── Cuentas parser ────────────────────────────────────────────────────────────

def parse_amount(val):
    """Normalise a cell value to a float.
    Handles: None, float, int, strings like '$10.767' (CLP thousands) or plain floats.
    Returns 0 for missing/invalid values.
    """
    if val is None:
        return 0
    if isinstance(val, (int, float)):
        return 0 if val != val else float(val)  # NaN → 0
    s = str(val).strip()
    if s in ('', '-', 'N/A'):
        return 0
    s = s.replace('$', '').replace(' ', '')
    if '.' in s and ',' in s:
        s = s.replace('.', '').replace(',', '.')
    elif '.' in s:
        parts = s.split('.')
        if len(parts) == 2 and len(parts[1]) == 3:
            s = s.replace('.', '')  # dot = thousands separator
    elif ',' in s:
        s = s.replace(',', '.')
    try:
        return float(s)
    except ValueError:
        return 0


def parse_cuentas_xlsx(xlsx_path):
    """
    Parse a Cuentas xlsx file.
        Returns:
            - monthly_totals: dict keyed by sheet name, each value is {'YYYY-MM': amount}
            - details: dict keyed by sheet name, each value is a list of
                {'date': 'YYYY-MM-DD', 'month': 'YYYY-MM', 'amount': float}
        Multiple entries per month are summed in monthly_totals.
    """
    import openpyxl
    wb = openpyxl.load_workbook(xlsx_path, data_only=True)
    monthly_totals = {}
    details = {}

    for sheet_name in wb.sheetnames:
        ws = wb[sheet_name]
        monthly = {}
        payment_rows = []
        last_date = None

        for row in ws.iter_rows(min_row=2, values_only=True):
            if not row or len(row) < 2:
                continue
            date_val, amount_val = row[0], row[1]

            if isinstance(date_val, datetime.datetime):
                last_date = date_val
            elif date_val is not None and str(date_val).strip() not in ('', '-'):
                try:
                    last_date = datetime.datetime.strptime(str(date_val).strip(), '%Y-%m-%d')
                except ValueError:
                    pass

            if last_date is None:
                continue

            amount = parse_amount(amount_val)
            if amount == 0:
                continue

            key = last_date.strftime('%Y-%m')
            monthly[key] = monthly.get(key, 0) + amount
            payment_rows.append({
                "date": last_date.strftime('%Y-%m-%d'),
                "month": key,
                "amount": amount,
            })

        monthly_totals[sheet_name] = monthly
        details[sheet_name] = payment_rows

    return monthly_totals, details


def get_output_files():
    """Return sorted list of CSV files in the output directory."""
    files = []
    if os.path.isdir(OUTPUT_DIR):
        for fname in sorted(os.listdir(OUTPUT_DIR)):
            if fname.lower().endswith(".csv"):
                fpath = os.path.join(OUTPUT_DIR, fname)
                stat = os.stat(fpath)
                files.append({
                    "name": fname,
                    "path": fpath,
                    "size": stat.st_size,
                    "modified": datetime.datetime.fromtimestamp(stat.st_mtime).isoformat(),
                })
    return files


def get_historial_files():
    """Return sorted list of files in the movement_historial directory."""
    files = []
    if os.path.isdir(HISTORIAL_DIR):
        for fname in sorted(os.listdir(HISTORIAL_DIR)):
            # Skip hidden / system files
            if fname.startswith('.'):
                continue
            fpath = os.path.join(HISTORIAL_DIR, fname)
            if os.path.isfile(fpath):
                stat = os.stat(fpath)
                files.append({
                    "name": fname,
                    "path": fpath,
                    "size": stat.st_size,
                    "modified": datetime.datetime.fromtimestamp(stat.st_mtime).isoformat(),
                })
    return files


def load_csv_with_uncategorized(csv_path):
    """
    Load a transactions CSV and annotate each row with its category.
    Returns (all_rows_json, uncategorized_rows_json).
    """
    df = pd.read_csv(csv_path)
    # Normalise column names
    col_map = {}
    for col in df.columns:
        lc = col.lower()
        if "fecha" in lc or "date" in lc:
            col_map[col] = "Fecha"
        elif "operaci" in lc or "operation" in lc:
            col_map[col] = "Operacion"
        elif "movimiento" in lc or "description" in lc:
            col_map[col] = "Movimientos"
        elif "cargo" in lc or "charge" in lc:
            col_map[col] = "Cargos"
        elif "abono" in lc or "credit" in lc:
            col_map[col] = "Abonos"
        elif "saldo" in lc or "balance" in lc:
            col_map[col] = "Saldo"
    df.rename(columns=col_map, inplace=True)

    required = {"Fecha", "Movimientos", "Cargos", "Abonos", "Saldo"}
    missing = required - set(df.columns)
    if missing:
        return None, None, f"Missing columns: {missing}"

    df["Cargos"] = pd.to_numeric(df["Cargos"], errors="coerce").fillna(0)
    df["Abonos"] = pd.to_numeric(df["Abonos"], errors="coerce").fillna(0)
    df["Saldo"]  = pd.to_numeric(df["Saldo"],  errors="coerce").fillna(0)

    if "category" not in df.columns:
        df["category"] = df["Movimientos"].apply(find_category)

    df["category"] = df["category"].apply(
        lambda value: value if isinstance(value, str) and value.strip() and value != "Uncategorized" else None
    )

    uncat = df[df["category"].isna()].copy()
    uncat["category"] = "Uncategorized"

    df = df.where(pd.notna(df), None)
    uncat = uncat.where(pd.notna(uncat), None)

    return df.to_dict(orient="records"), uncat.to_dict(orient="records"), None


def run_summary_script(month_str=None, categories=None):
    """
    Run summary_app.py to regenerate the CSV for the given month (YYYY_MM).
    Defaults to current month.
    """
    if not month_str:
        now = datetime.datetime.now()
        month_str = now.strftime("%Y_%m")

    out_filename = f"summary_{month_str}.csv"
    out_path = os.path.join(OUTPUT_DIR, out_filename)

    cmd = [sys.executable, SUMMARY_SCRIPT, HISTORIAL_DIR, "-o", out_path]
    categories_file = None

    if categories is not None:
        with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False, encoding="utf-8") as handle:
            json.dump(categories, handle, ensure_ascii=False)
            categories_file = handle.name
        cmd.extend(["--categories-file", categories_file])
    elif os.path.isfile(CUSTOM_CATEGORIES_FILE):
        cmd.extend(["--categories-file", CUSTOM_CATEGORIES_FILE])

    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            cwd=BASE_DIR,
            timeout=120,
        )
        if result.returncode != 0:
            return False, result.stderr or result.stdout, out_filename
        return True, result.stdout, out_filename
    except subprocess.TimeoutExpired:
        return False, "Script timed out after 120 seconds", out_filename
    except Exception as e:
        return False, str(e), out_filename
    finally:
        if categories_file and os.path.exists(categories_file):
            os.unlink(categories_file)


# ── HTTP Handler ─────────────────────────────────────────────────────────────

def sanitize_for_json(value):
    """Recursively replace NaN/NA/Inf values with None so JSON encoding succeeds."""
    if isinstance(value, dict):
        return {str(k): sanitize_for_json(v) for k, v in value.items()}
    if isinstance(value, (list, tuple)):
        return [sanitize_for_json(v) for v in value]
    if value is None or isinstance(value, (str, bool)):
        return value
    if isinstance(value, (int, float)):
        if isinstance(value, bool):
            return value
        try:
            if pd.isna(value):
                return None
            if isinstance(value, float) and (math.isnan(value) or math.isinf(value)):
                return None
        except Exception:
            pass
        return value
    if isinstance(value, pd.Timestamp):
        return value.isoformat()
    if hasattr(value, "item"):
        try:
            item = value.item()
            if isinstance(item, (int, float, str, bool)) or item is None:
                return sanitize_for_json(item)
        except Exception:
            pass
    try:
        if pd.isna(value):
            return None
    except Exception:
        pass
    return value


class Handler(BaseHTTPRequestHandler):

    def log_message(self, format, *args):
        pass  # suppress default access log spam

    def send_json(self, data, status=200):
        payload = sanitize_for_json(data)
        body = json.dumps(payload, ensure_ascii=False, allow_nan=False).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", len(body))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def send_csv_download(self, csv_content, filename):
        body = csv_content.encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "text/csv; charset=utf-8")
        self.send_header("Content-Disposition", f'attachment; filename="{filename}"')
        self.send_header("Content-Length", len(body))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, X-Requested-With")
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        path   = parsed.path
        params = parse_qs(parsed.query)

        # GET /api/files  — list output CSVs
        if path == "/api/files":
            self.send_json({"files": get_output_files()})

        # GET /api/historial  — list source XLS/CSV files used as input
        elif path == "/api/historial":
            self.send_json({"files": get_historial_files()})

        # GET /api/cuentas  — parse the default cuentas xlsx and return per-month data
        elif path == "/api/cuentas":
            if not os.path.isfile(DEFAULT_CUENTAS):
                self.send_json({"error": f"Default cuentas file not found: {DEFAULT_CUENTAS}"}, 404)
                return
            try:
                monthly, details = parse_cuentas_xlsx(DEFAULT_CUENTAS)
                self.send_json({
                    "cuentas": monthly,
                    "cuentasDetails": details,
                    "source": os.path.basename(DEFAULT_CUENTAS)
                })
            except Exception as e:
                self.send_json({"error": str(e)}, 500)

        # GET /api/transactions?file=<filename>
        elif path == "/api/transactions":
            filename = params.get("file", [None])[0]
            if not filename:
                self.send_json({"error": "Missing 'file' query parameter"}, 400)
                return
            csv_path = os.path.join(OUTPUT_DIR, os.path.basename(filename))
            if not os.path.isfile(csv_path):
                self.send_json({"error": f"File not found: {filename}"}, 404)
                return
            all_rows, uncat_rows, err = load_csv_with_uncategorized(csv_path)
            if err:
                self.send_json({"error": err}, 500)
                return
            self.send_json({"transactions": all_rows, "uncategorized": uncat_rows})

        # GET /api/export?file=<filename>&month=<YYYY-MM>  — download monthly CSV
        elif path == "/api/export":
            filename = params.get("file", [None])[0]
            month    = params.get("month", [None])[0]

            if not filename:
                self.send_json({"error": "Missing 'file' query parameter"}, 400)
                return

            csv_path = os.path.join(OUTPUT_DIR, os.path.basename(filename))
            if not os.path.isfile(csv_path):
                self.send_json({"error": f"File not found: {filename}"}, 404)
                return

            df = pd.read_csv(csv_path)
            if month:
                date_col = next((c for c in df.columns if "fecha" in c.lower() or "date" in c.lower()), None)
                if date_col:
                    df[date_col] = df[date_col].astype(str)
                    df = df[df[date_col].str.startswith(month)]

            dl_name = f"export_{month or 'all'}_{os.path.basename(filename)}"
            self.send_csv_download(df.to_csv(index=False), dl_name)

        # GET /api/export-uncategorized?file=<filename>&month=<YYYY-MM>
        elif path == "/api/export-uncategorized":
            filename = params.get("file", [None])[0]
            month    = params.get("month", [None])[0]

            if not filename:
                self.send_json({"error": "Missing 'file' query parameter"}, 400)
                return

            csv_path = os.path.join(OUTPUT_DIR, os.path.basename(filename))
            if not os.path.isfile(csv_path):
                self.send_json({"error": f"File not found: {filename}"}, 404)
                return

            all_rows, uncat_rows, err = load_csv_with_uncategorized(csv_path)
            if err:
                self.send_json({"error": err}, 500)
                return

            uncat_df = pd.DataFrame(uncat_rows)
            if month and not uncat_df.empty:
                date_col = next((c for c in uncat_df.columns if "fecha" in c.lower() or "date" in c.lower()), None)
                if date_col:
                    uncat_df[date_col] = uncat_df[date_col].astype(str)
                    uncat_df = uncat_df[uncat_df[date_col].str.startswith(month)]

            dl_name = f"uncategorized_{month or 'all'}_{os.path.basename(filename)}"
            self.send_csv_download(uncat_df.to_csv(index=False) if not uncat_df.empty else "", dl_name)

        else:
            self.send_json({"error": "Not found"}, 404)

    def do_POST(self):
        parsed = urlparse(self.path)
        path   = parsed.path

        # POST /api/run-script  — body: {"month": "2026_03", "categories": [...]} (optional)
        if path == "/api/run-script":
            length = int(self.headers.get("Content-Length", 0))
            body   = self.rfile.read(length) if length else b"{}"
            try:
                payload = json.loads(body)
            except Exception:
                payload = {}

            month_str = payload.get("month")
            categories = payload.get("categories") if isinstance(payload.get("categories"), list) else None
            ok, output, out_file = run_summary_script(month_str, categories)
            self.send_json({
                "success": ok,
                "message": output,
                "outputFile": out_file,
            }, 200 if ok else 500)

        # POST /api/categories  — body: {"categories": [...]} 
        elif path == "/api/categories":
            length = int(self.headers.get("Content-Length", 0))
            body   = self.rfile.read(length) if length else b"{}"
            try:
                payload = json.loads(body)
            except Exception:
                self.send_json({"error": "Invalid JSON payload"}, 400)
                return

            categories = payload.get("categories")
            if not isinstance(categories, list):
                self.send_json({"error": "Expected 'categories' to be a list"}, 400)
                return

            try:
                with open(CUSTOM_CATEGORIES_FILE, "w", encoding="utf-8") as handle:
                    json.dump(categories, handle, ensure_ascii=False, indent=2)
                self.send_json({"success": True})
            except Exception as e:
                self.send_json({"error": str(e)}, 500)

        # POST /api/upload-cuentas  — multipart upload of a cuentas xlsx file
        elif path == "/api/upload-cuentas":
            content_type = self.headers.get("Content-Type", "")
            if "multipart/form-data" not in content_type:
                self.send_json({"error": "Expected multipart/form-data"}, 400)
                return

            length = int(self.headers.get("Content-Length", 0))
            raw_body = self.rfile.read(length)

            environ = {
                "REQUEST_METHOD": "POST",
                "CONTENT_TYPE": content_type,
                "CONTENT_LENGTH": str(length),
            }
            fs = cgi.FieldStorage(
                fp=io.BytesIO(raw_body),
                environ=environ,
                keep_blank_values=True,
            )

            if "file" not in fs:
                self.send_json({"error": "No 'file' field in form data"}, 400)
                return

            file_item = fs["file"]
            file_bytes = file_item.file.read()
            safe_name = os.path.basename(file_item.filename or "cuentas_upload.xlsx")
            dest_path = os.path.join(HISTORIAL_DIR, safe_name)
            with open(dest_path, "wb") as f:
                f.write(file_bytes)

            try:
                monthly, details = parse_cuentas_xlsx(dest_path)
                self.send_json({
                    "cuentas": monthly,
                    "cuentasDetails": details,
                    "source": safe_name
                })
            except Exception as e:
                self.send_json({"error": str(e)}, 500)

        else:
            self.send_json({"error": "Not found"}, 404)


# ── Entry Point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 5050
    server = HTTPServer(("localhost", port), Handler)
    print(f"Beach Accounting API server running on http://localhost:{port}", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServer stopped.")
