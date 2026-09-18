import pandas as pd
import os
import re
import sys
import argparse
import json
from movements_extraction import get_all_movements_from_directory

# Category patterns – keep in sync with regex_categories.py and categories.js
CATEGORY_PATTERNS = [
    ("Airbnb",                  r"angon|iol|radar|proveedor|airbnb|aibnb"),
    ("External Rent",           r"guzman|jesus|deposito en efectivo"),
    ("Cleaning Services (Old)", r"vidal"),
    ("Admin Services",          r"yuvi|yuviana|moreno|rentals"),
    ("Admin Monthly Account",   r"protecc"),
    ("Transfers to Cristian",   r"cristian"),
    ("Transfers to Keyla",      r"keyla"),
    ("Key Lock",                r"smart"),
]

def pattern_specificity(pattern):
    if not pattern:
        return 0
    return max((len(part.strip()) for part in str(pattern).split('|')), default=0)

def load_category_patterns(categories_file=None):
    if not categories_file:
        return CATEGORY_PATTERNS

    with open(categories_file, 'r', encoding='utf-8') as handle:
        raw_categories = json.load(handle)

    parsed = []
    for category in raw_categories:
        if not isinstance(category, dict):
            continue
        name = str(category.get('name', '')).strip()
        pattern = str(category.get('pattern', '')).strip()
        if name and pattern:
            parsed.append((name, pattern))

    return parsed

def find_category(description, category_patterns=None):
    if not description:
        return None
    patterns = CATEGORY_PATTERNS if category_patterns is None else category_patterns
    for name, pattern in sorted(patterns, key=lambda item: pattern_specificity(item[1]), reverse=True):
        if re.search(pattern, str(description), re.IGNORECASE):
            return name
    return None

if __name__ == "__main__":

    parser = argparse.ArgumentParser(description="Extract movements from XLS files in a directory.")
    parser.add_argument("directory", help="Path to directory containing XLS files")
    parser.add_argument("--output", "-o", help="Optional output file to write all transactions (CSV format)")
    parser.add_argument("--categories-file", help="Optional JSON file with categories from the UI")

    args = parser.parse_args()
    category_patterns = load_category_patterns(args.categories_file)

    data = get_all_movements_from_directory(args.directory)
    # Convert 'Fecha' to datetime using format "dd/mm/yyyy"
    data['Fecha'] = pd.to_datetime(data['Fecha'], format='%d/%m/%Y', errors='coerce')
    # Sort by 'Fecha' column
    data = data.sort_values(by='Fecha')
    data['category'] = data['Movimientos'].apply(lambda description: find_category(description, category_patterns))
    print(data)

    if args.output:
        data.to_csv(args.output, index=False)
        print(f"All transactions written to {args.output}")

        # ── Generate uncategorized transactions CSV ──────────────────────
        uncategorized = data[data['category'].isna()].copy()

        base, ext = os.path.splitext(args.output)
        uncat_path = f"{base}_uncategorized{ext}"
        uncategorized.to_csv(uncat_path, index=False)
        print(f"Uncategorized transactions ({len(uncategorized)}) written to {uncat_path}")


## Podria tomar todas las formulas que tengo en la otra hoja y hacer un script que las aplique a este dataframe
## para obtener los mismos resultados que en el excel, pero de forma automatizada y reproducible
# 

