import importlib
import os

# Import regex categories
regex_categories = importlib.import_module('regex_categories')
# Import extraction methods
movements_extraction = importlib.import_module('movements_extraction')

def get_category_totals():
    # Assume movements_extraction.get_movements() returns a list of movement dicts
    movements = movements_extraction.get_movements()
    totals = {}

    # Iterate over all variables in regex_categories
    for attr in dir(regex_categories):
        # Skip private and non-regex variables
        if attr.startswith('_'):
            continue
        pattern = getattr(regex_categories, attr)
        if not isinstance(pattern, str):
            continue

        # Filter movements by regex
        filtered = [
            m for m in movements
            if movements_extraction.match_regex(m, pattern)
        ]
        # Sum amounts for this category
        total = sum(m['amount'] for m in filtered)
        totals[attr] = total

    return totals

if __name__ == "__main__":
    totals = get_category_totals()
    for category, total in totals.items():
        print(f"{category}: {total}")