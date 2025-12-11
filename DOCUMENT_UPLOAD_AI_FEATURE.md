# Document Upload & AI Analysis Feature

## Overview

This feature allows users to upload business documents (PDFs, images, Word docs) and automatically extract structured data using AI. The system analyzes the document, determines its type (driver, vehicle, load, route, maintenance, invoice, expense), extracts relevant information, and creates records in the appropriate database tables.

## Features

✅ **Intelligent Document Analysis**
- Automatically detects document type
- Extracts structured data using AI (OpenAI GPT-4)
- Supports multiple document types: PDF, images (JPG, PNG), Word documents

✅ **Smart Data Routing**
- Driver documents → Creates driver records
- Vehicle documents → Creates vehicle records
- Load documents → Creates load records
- Route documents → Creates route records
- Maintenance documents → Creates maintenance records
- Invoice documents → Creates invoice records
- Expense documents → Creates expense records

✅ **Review & Edit Interface**
- Users can review extracted data before saving
- All fields are editable
- Validation ensures required fields are filled

✅ **Seamless Integration**
- Records are created in existing database tables
- Fully integrated with existing pages
- Records are immediately available in lists

## Setup Instructions

### 1. Environment Variables

Add to your `.env.local` file:

```env
OPENAI_API_KEY=your_openai_api_key_here
```

**How to get OpenAI API Key:**
1. Go to https://platform.openai.com/api-keys
2. Sign up or log in
3. Create a new API key
4. Copy and paste it into your `.env.local` file

### 2. Supabase Storage Setup

Make sure you have a `documents` bucket in Supabase Storage:

1. Go to Supabase Dashboard → Storage
2. Create a bucket named `documents` (if it doesn't exist)
3. Set it as **Private** (not public)
4. Add storage policies (if not already set):

```sql
-- Allow authenticated users to upload documents
CREATE POLICY "Users can upload documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'documents');

-- Allow users to read documents
CREATE POLICY "Users can read documents"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'documents');

-- Allow users to delete documents
CREATE POLICY "Users can delete documents"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'documents');
```

### 3. Database Schema

The feature uses existing tables:
- `drivers`
- `trucks`
- `loads`
- `routes`
- `maintenance`
- `invoices`
- `expenses`
- `documents` (for storing document metadata)

All these tables should already exist from your previous schema setup.

## How It Works

### 1. User Uploads Document

- User clicks "Upload Document" in sidebar
- Selects a file (PDF, image, or Word document)
- File is uploaded to Supabase Storage

### 2. AI Analysis

- Document is sent to OpenAI API for analysis
- AI determines document type and extracts structured data
- Returns JSON with extracted fields

### 3. Review & Edit

- Extracted data is displayed in an editable form
- User can review and modify any field
- Form is customized based on document type

### 4. Create Record

- User clicks "Create Record"
- Data is validated and saved to appropriate table
- User is redirected to the relevant list page

## Usage

### Access the Feature

1. **From Sidebar:**
   - Click "Upload Document" in the sidebar navigation

2. **Direct URL:**
   - Navigate to `/dashboard/upload-document`

### Upload Process

1. Click "Choose File" and select your document
2. Click "Upload & Analyze Document"
3. Wait for AI analysis (usually 5-15 seconds)
4. Review the extracted data
5. Edit any fields as needed
6. Click "Create [Type] Record"
7. You'll be redirected to the relevant list page

## Supported Document Types

### Driver Documents
- Driver license information
- Employee records
- Driver applications
- **Extracted Fields:**
  - Name, Email, Phone
  - License Number, License Expiry
  - Status

### Vehicle Documents
- Vehicle registration
- Title documents
- Vehicle specifications
- **Extracted Fields:**
  - Truck Number, Make, Model, Year
  - VIN, License Plate
  - Status

### Load Documents
- Shipping manifests
- Bill of lading
- Delivery orders
- **Extracted Fields:**
  - Shipment Number, Origin, Destination
  - Weight, Contents, Value
  - Status

### Route Documents
- Route plans
- Delivery schedules
- **Extracted Fields:**
  - Route Name, Origin, Destination
  - Distance, Estimated Time
  - Priority, Status

### Maintenance Documents
- Service records
- Repair invoices
- Maintenance schedules
- **Extracted Fields:**
  - Truck Number/ID, Service Type
  - Scheduled Date, Estimated Cost
  - Vendor, Notes

### Invoice Documents
- Customer invoices
- Billing statements
- **Extracted Fields:**
  - Invoice Number, Customer Name
  - Amount, Issue Date, Due Date
  - Status

### Expense Documents
- Receipts
- Expense reports
- **Extracted Fields:**
  - Category, Description
  - Amount, Date, Vendor

## Technical Details

### File Processing

Currently, the implementation uses OpenAI's vision capabilities for image analysis. For production, you may want to:

1. **For PDFs:** Use a PDF parsing library like `pdf-parse` or `pdfjs-dist`
2. **For Images:** Use OCR (Tesseract.js) or Google Vision API
3. **For Word Docs:** Use `mammoth` or `docx` libraries

The current implementation sends the document URL to OpenAI. For better results, extract text first and send both text and document context.

### AI Model

- **Default:** `gpt-4o-mini` (cost-effective, fast)
- **Alternative:** `gpt-4` (more accurate, slower, more expensive)

You can change the model in `app/actions/document-analysis.ts`:

```typescript
model: "gpt-4o-mini", // Change to "gpt-4" for better accuracy
```

### Error Handling

- If document analysis fails, user can still manually enter data
- All errors are displayed with helpful messages
- Document is still saved even if analysis fails

## Cost Considerations

### OpenAI API Costs

- **gpt-4o-mini:** ~$0.15 per 1M input tokens, ~$0.60 per 1M output tokens
- **gpt-4:** ~$2.50-10 per 1M input tokens (depending on model)

**Estimated cost per document:**
- Small document (1 page): ~$0.01-0.05
- Medium document (5 pages): ~$0.05-0.25
- Large document (20 pages): ~$0.20-1.00

### Optimization Tips

1. Use `gpt-4o-mini` for most documents (good balance)
2. Extract text from PDFs/images first to reduce token usage
3. Cache analysis results for duplicate documents
4. Set rate limits to prevent abuse

## Future Enhancements

- [ ] Batch document upload
- [ ] Document templates for better extraction
- [ ] OCR integration for scanned documents
- [ ] Support for more document types
- [ ] Automatic field mapping customization
- [ ] Document validation rules
- [ ] Integration with document storage services
- [ ] Multi-language support

## Troubleshooting

### "OpenAI API key not configured"

**Solution:** Add `OPENAI_API_KEY` to your `.env.local` file

### "Failed to analyze document"

**Possible causes:**
- Document is too large
- Document format not supported
- API rate limit exceeded
- Network error

**Solution:** 
- Try a smaller document
- Check your OpenAI API quota
- Verify network connection

### "Document uploaded but could not be analyzed"

**Solution:** 
- The document was saved but AI couldn't extract data
- You can manually enter the data
- Try a clearer/higher quality document

### Records not appearing in lists

**Solution:**
- Check browser console for errors
- Verify database permissions
- Check if record was actually created in Supabase

## Security Notes

- Documents are stored in private Supabase Storage buckets
- Only authenticated users can upload documents
- RLS policies ensure users only see their company's documents
- OpenAI API key should be kept secret (server-side only)

## Support

If you encounter issues:
1. Check the browser console for errors
2. Verify environment variables are set
3. Check Supabase Storage bucket exists and has correct policies
4. Verify OpenAI API key is valid and has credits
