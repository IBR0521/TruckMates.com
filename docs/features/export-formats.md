# Export Formats Documentation

TruckMates supports multiple export formats for data analysis, reporting, and integration with external systems.

## Supported Export Formats

### 1. **CSV (Comma-Separated Values)**
**Use Case**: Data analysis in Excel, Google Sheets, or database imports

**Features**:
- UTF-8 encoding for international characters
- Comma-separated values
- Headers included in first row
- Date format: ISO 8601 (YYYY-MM-DD)
- Numbers formatted without thousand separators

**Available For**:
- Loads list
- Drivers list
- Vehicles list
- Invoices
- Expenses
- Maintenance records
- ELD logs
- Reports

**Example**:
```csv
id,load_number,origin,destination,status,amount,created_at
123,LD-001,New York,Los Angeles,delivered,5000.00,2024-01-15T10:30:00Z
```

---

### 2. **Excel (XLSX)**
**Use Case**: Advanced analysis with formulas, charts, and formatting

**Features**:
- Multiple sheets support (for related data)
- Formatted numbers and dates
- Column headers with styling
- Auto-width columns
- Preserves data types (numbers, dates, text)

**Available For**:
- Financial reports
- Load reports
- Driver performance reports
- Maintenance schedules
- IFTA reports

**Structure**:
- Sheet 1: Main data
- Sheet 2: Summary/Statistics (if applicable)
- Sheet 3: Metadata (export date, filters applied)

---

### 3. **PDF**
**Use Case**: Official reports, invoices, compliance documents

**Features**:
- Professional formatting
- Company branding (logo, header, footer)
- Page numbers and date stamps
- Print-ready layout
- Password protection option (for sensitive data)

**Available For**:
- Invoices
- Load confirmations
- Driver settlement reports
- IFTA reports
- Compliance reports
- Maintenance records

**Layout**:
- Header: Company name, logo, report title
- Body: Data tables or formatted content
- Footer: Page numbers, export date, confidentiality notice

---

### 4. **JSON**
**Use Case**: API integration, data migration, programmatic access

**Features**:
- Structured data format
- Nested objects for relationships
- Metadata included (export date, version, filters)
- UTF-8 encoding

**Available For**:
- All data types
- API responses
- Webhook payloads
- Data backups

**Structure**:
```json
{
  "metadata": {
    "export_date": "2024-01-15T10:30:00Z",
    "format_version": "1.0",
    "filters_applied": {...}
  },
  "data": [...],
  "summary": {...}
}
```

---

## Export Options

### Date Range Selection
- **Preset Ranges**: Today, This Week, This Month, This Quarter, This Year, Custom
- **Custom Range**: Select start and end dates
- **Timezone**: All dates exported in UTC (converted from user's timezone)

### Filtering
- Apply filters before export
- Filters are preserved in export metadata
- Only filtered data is exported

### Column Selection
- **All Columns**: Export all available fields
- **Selected Columns**: Choose specific columns to export
- **Custom Views**: Save column selections for future exports

### File Naming
**Format**: `{entity_type}_{date_range}_{timestamp}.{extension}`

**Examples**:
- `loads_2024-01-01_to_2024-01-31_20240115-103000.csv`
- `invoices_this_month_20240115-103000.xlsx`
- `driver_settlement_2024-Q1_20240115-103000.pdf`

---

## Export Limits

### File Size Limits
- **CSV**: Up to 1,000,000 rows
- **Excel**: Up to 100,000 rows per sheet
- **PDF**: Up to 10,000 rows (paginated)
- **JSON**: Up to 500,000 records

### Rate Limits
- **Free Tier**: 10 exports per day
- **Pro Tier**: 100 exports per day
- **Enterprise**: Unlimited exports

### Data Retention
- Exports are available for download for 7 days
- After 7 days, files are automatically deleted
- Export history is retained for 90 days

---

## Export Locations

### Where to Find Exports

1. **Dashboard → Reports**
   - Financial reports
   - Performance reports
   - Compliance reports

2. **Entity Pages** (Loads, Drivers, Vehicles, etc.)
   - Export button in top-right corner
   - Bulk export for selected items

3. **Settings → Data Export**
   - Scheduled exports
   - Export history
   - Download previous exports

---

## Scheduled Exports

### Automatic Exports
- **Daily**: Financial summaries, compliance reports
- **Weekly**: Performance reports, maintenance schedules
- **Monthly**: IFTA reports, driver settlements

### Email Delivery
- Exports can be automatically emailed
- Supports multiple recipients
- Password-protected PDFs for sensitive data

---

## API Exports

### REST API
**Endpoint**: `GET /api/exports/{entity_type}`

**Query Parameters**:
- `format`: csv, xlsx, pdf, json
- `start_date`: ISO 8601 date
- `end_date`: ISO 8601 date
- `filters`: JSON-encoded filter object
- `columns`: Comma-separated column names

**Response**:
- Direct download (for CSV, XLSX, PDF)
- JSON response (for JSON format)

### Webhook Exports
- Configure webhooks to receive exports automatically
- Supports all formats
- Delivered as file attachments or JSON payloads

---

## Best Practices

### For Large Exports
1. Use CSV format for maximum compatibility
2. Export in smaller date ranges
3. Use scheduled exports for regular reports
4. Filter data before exporting to reduce file size

### For Financial Data
1. Use PDF for official documents
2. Use Excel for analysis and calculations
3. Include metadata and filters in exports
4. Password-protect sensitive PDFs

### For Integration
1. Use JSON format for API integration
2. Use CSV for database imports
3. Include all related data in nested structures
4. Validate data format before import

---

## Troubleshooting

### Export Fails
- **Check file size limits**: Reduce date range or apply filters
- **Check rate limits**: Wait before retrying
- **Check permissions**: Ensure you have export access

### Data Format Issues
- **Dates**: All dates in UTC, convert to local timezone
- **Numbers**: Use locale-specific formatting in Excel
- **Encoding**: Ensure UTF-8 encoding for international characters

### Missing Data
- **Filters**: Check if filters are excluding data
- **Permissions**: Some data may be restricted
- **Date Range**: Verify date range includes desired data

---

## Support

For export-related questions or issues:
- **Email**: support@truckmates.com
- **Documentation**: [Full API Documentation](/docs/api)
- **Help Center**: [Export Guide](https://help.truckmates.com/exports)





