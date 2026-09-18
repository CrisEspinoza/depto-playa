# Beach Accounting - React Application

A React application for tracking and analyzing expense and income transactions from CSV bank statements. The application categorizes transactions based on configurable regex patterns and displays detailed summaries by month.

## Features

- 📊 **Category-based Analysis**: Automatically categorizes transactions based on regex patterns
- 📅 **Monthly Filtering**: Filter transactions by specific months or view all
- 💰 **Income & Expense Tracking**: Separate views for income and expense categories
- 📈 **Summary Statistics**: View total income, expenses, and net income
- 🔍 **Detailed Transaction Views**: Expand categories to see individual transactions
- 📤 **CSV Upload**: Upload new CSV files directly in the browser
- 📱 **Responsive Design**: Works on desktop and mobile devices

## Project Structure

```
react-app/
├── public/
│   ├── index.html              # HTML template
│   └── summary_12_2025.csv     # Sample data file
├── src/
│   ├── components/
│   │   ├── CategorySummary.js   # Displays categories with totals
│   │   ├── MonthSelector.js     # Month selection dropdown
│   │   └── TransactionList.js   # Displays transaction details
│   ├── config/
│   │   └── categories.js        # Category definitions and patterns
│   ├── utils/
│   │   └── dataParser.js        # CSV parsing and data utilities
│   ├── App.js                   # Main application component
│   ├── App.css                  # Application styles
│   ├── index.js                 # Application entry point
│   └── index.css                # Global styles
├── package.json                 # Dependencies and scripts
└── README.md                    # This file
```

## Getting Started

### Prerequisites

- Node.js (version 14 or higher)
- npm or yarn

### Installation

1. Navigate to the react-app directory:
   ```bash
   cd react-app
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm start
   ```

4. Open your browser and navigate to:
   ```
   http://localhost:3000
   ```

## Usage

### Viewing Data

1. The application loads with the default CSV file (`summary_12_2025.csv`)
2. Use the month selector to filter transactions by month
3. Click on any category to expand and view detailed transactions
4. View summary statistics at the top showing total income, expenses, and net income

### Uploading New Data

1. Click the "Upload CSV" button in the header
2. Select a CSV file with the following format:
   ```
   Fecha,N° de operación,Movimientos,Cargos,Abonos,Saldo
   2025-12-01,000000000,Transaction Description,100.00,0,1000.00
   ```

## Adding New Categories

Categories are easily extensible. To add a new category:

1. Open `src/config/categories.js`
2. Add a new object to the `CATEGORIES` array:

```javascript
{
  name: 'Category Name',           // Display name
  type: 'income' or 'expense',     // Category type
  pattern: 'regex|pattern|here',   // Regex pattern to match
  description: 'Description here'  // Optional description
}
```

### Example: Adding a "Utilities" Category

```javascript
{
  name: 'Utilities',
  type: 'expense',
  pattern: 'electricidad|agua|gas|water|electric',
  description: 'Utility bills and services'
}
```

### Current Categories

**Income:**
- Airbnb (matches: angon, Angon, Iol, radar, Radar, iol)
- External Rent (matches: Guzman, guzman, Jesus, Deposito En Efectivo)

**Expenses:**
- Cleaning Services (Old) (matches: vidal, Vidal)
- Admin Services (matches: yuvi, yuviana, Yuviana, moreno, Moreno, Yuvi, rentals)
- Admin Monthly Account (matches: protecc, Protecc)
- Transfers to Cristian (matches: Cristian, cristian)
- Transfers to Keyla (matches: Keyla, keyla)
- Key Lock (matches: smart, Smart)

## CSV Format

The application expects CSV files with the following columns:

| Column | Description |
|--------|-------------|
| Fecha | Transaction date (YYYY-MM-DD) |
| N° de operación | Operation number |
| Movimientos | Transaction description |
| Cargos | Charges (expenses) |
| Abonos | Credits (income) |
| Saldo | Balance |

## Customization

### Styling

All styles are in `src/App.css`. Key sections:
- `.app-header` - Header styling
- `.summary-overview` - Summary cards
- `.category-summary` - Category sections
- `.transactions-table` - Transaction table

### Colors

The application uses a purple gradient theme. To change:
- Primary color: `#667eea`
- Secondary color: `#764ba2`
- Expense color: `#f5576c`
- Income color: `#667eea`

### Date and Currency Formats

Date and currency formats are configured in `src/utils/dataParser.js`:
- Currency: Chilean Peso (CLP)
- Date format: Spanish (es-ES)

To change, modify the `formatCurrency` and `formatDate` functions.

## Building for Production

To create a production build:

```bash
npm run build
```

This creates an optimized build in the `build/` folder ready for deployment.

## Deployment

The application can be deployed to:
- **Netlify**: Drag and drop the `build` folder
- **Vercel**: Connect your git repository
- **GitHub Pages**: Use `gh-pages` package
- **Any static hosting**: Upload the `build` folder

## Technologies Used

- **React 18**: UI framework
- **JavaScript ES6+**: Programming language
- **CSS3**: Styling with flexbox and grid
- **React Scripts**: Build tooling

## Future Enhancements

Potential improvements:
- [ ] Add data visualization (charts/graphs)
- [ ] Export filtered data to CSV
- [ ] Multiple file support
- [ ] Category management UI
- [ ] Search and filter transactions
- [ ] Dark mode support
- [ ] Print-friendly views

## License

This project is private and for internal use only.

## Support

For questions or issues, please contact the development team.

---

**Beach Accounting** © 2026
