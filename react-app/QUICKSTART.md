# Quick Start Guide

## Getting Started in 3 Steps

### 1. Install Dependencies
```bash
cd react-app
npm install
```

### 2. Start the Application
```bash
npm start
```

### 3. View in Browser
The application will automatically open at: `http://localhost:3000`

## What You'll See

- **Header**: Shows the application title and an "Upload CSV" button
- **Month Selector**: Dropdown to filter transactions by month
- **Summary Cards**: Three cards showing:
  - Total Income (purple)
  - Total Expenses (pink/red)
  - Net Income (blue)
- **Income Categories**: Expandable list of all income categories with totals
- **Expense Categories**: Expandable list of all expense categories with totals
- **Transaction Details**: Click any category to see individual transactions

## Key Features

### 1. Month Filtering
- Select "All Months" to see all transactions
- Select a specific month to filter data for that period
- The most recent month is selected by default

### 2. Category Expansion
- Click on any category header to expand/collapse
- Shows all transactions that match that category
- Displays transaction details: date, description, charges, credits, and balance

### 3. CSV Upload
- Click "Upload CSV" in the header
- Select a new CSV file from your computer
- The application will automatically parse and display the new data

## Adding New Categories

Edit `src/config/categories.js` and add entries to the `CATEGORIES` array:

```javascript
{
  name: 'Your Category Name',
  type: 'income', // or 'expense'
  pattern: 'keyword1|keyword2|keyword3',
  description: 'Optional description'
}
```

The pattern is a regex that will be matched against transaction descriptions.

## Troubleshooting

### Port Already in Use
If port 3000 is already in use:
```bash
# Find and kill the process
lsof -ti:3000 | xargs kill -9

# Or use a different port
PORT=3001 npm start
```

### Module Not Found
If you get module errors:
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

### CSV Not Loading
- Ensure `summary_12_2025.csv` is in the `public/` folder
- Check browser console (F12) for error messages
- Try uploading the CSV manually using the "Upload CSV" button

## Building for Production

```bash
npm run build
```

This creates a `build/` folder with optimized production files.

## Need Help?

Check the full README.md for detailed documentation.
