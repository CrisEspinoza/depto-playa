# Beach Accounting - Movement Extraction Tool

This tool extracts financial movements from XLS files and processes them for accounting analysis.

## Prerequisites

Make sure you have the required Python packages installed:

```bash
pip install pandas openpyxl xlrd
```

## Files

- `summary_app.py` - Main script that processes XLS files from a directory
- `movements_extraction.py` - Module containing the extraction logic

## Usage

### Basic Usage

Extract movements from all XLS files in a directory:

```bash
python3 summary_app.py /path/to/directory/with/xls/files
```

### Save to CSV

Extract movements and save the results to a CSV file:

```bash
python3 summary_app.py /path/to/directory/with/xls/files --output movements.csv
# or
python3 summary_app.py /path/to/directory/with/xls/files -o movements.csv
```

## What the script does

1. **Scans directory** for XLS files
2. **Finds header rows** containing the columns: `Fecha`, `N° de operación`, `Movimientos`, `Cargos`, `Abonos`, `Saldo`
3. **Extracts data** from those columns
4. **Filters out invalid entries** (removes rows where `Saldo` is 0, NaN, None, or non-numeric)
5. **Converts dates** from "dd/mm/yyyy" format to datetime
6. **Sorts by date** chronologically
7. **Displays results** and optionally saves to CSV

## Output

The script will display all extracted movements sorted by date. If you specify an output file, it will also save the data in CSV format for further analysis.

## Example

```bash
python3 summary_app.py ~/Documents/bank-statements --output all_movements.csv
```

This will process all XLS files in the `~/Documents/bank-statements` directory and save the results to `all_movements.csv`.

Example: python3 summary_app.py movement_historial -o output/summary_10_2025.xml