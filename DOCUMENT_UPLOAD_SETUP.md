# Document Upload Function Setup Guide

## Overview
The document upload feature allows users to upload business documents (PDFs, images, Word docs) and automatically extract structured data using AI (OpenAI).

## Prerequisites

### 1. Supabase Storage Bucket Setup
The `documents` storage bucket must be created with proper policies. Run this SQL in your Supabase SQL Editor:

```sql
-- See: supabase/storage_bucket_setup.sql
```

This will:
- Create the `documents` bucket (private)
- Set up RLS policies for authenticated users
- Allow users to upload/view/delete their own documents
- Allow managers to view company documents

### 2. OpenAI API Key Configuration
The document analysis feature requires an OpenAI API key. Add this to your `.env.local` file:

```env
OPENAI_API_KEY=sk-your-openai-api-key-here
```

**Note:** Without this key, document analysis will fail with an error message.

### 3. Supported File Types
- **Images:** JPG, JPEG, PNG, GIF, WEBP (analyzed using OpenAI Vision API)
- **PDFs:** Currently NOT supported for text extraction (returns error)
- **Word Documents:** DOC, DOCX (limited support)

**Recommendation:** Use images (JPG/PNG) for best results, as PDF text extraction is not yet implemented.

## How It Works

1. **Upload:** User selects a file → File is uploaded to Supabase Storage in `{user_id}/{timestamp}.{ext}` format
2. **Analysis:** File URL is sent to OpenAI API for analysis
3. **Extraction:** AI extracts structured data (driver, vehicle, load, route, etc.)
4. **Review:** User can review and edit extracted data
5. **Create:** User confirms → Record is created in the appropriate table

## Current Limitations

1. **PDF Support:** PDF text extraction is not implemented. PDFs will return an error suggesting to use images or Word documents.
2. **File Size:** Maximum 10MB per file
3. **OpenAI Dependency:** Requires valid OpenAI API key and internet connection
4. **Rate Limits:** Subject to OpenAI API rate limits

## Troubleshooting

### Upload Fails
- **Error:** "Upload failed: ..."
- **Solution:** 
  - Ensure the storage bucket exists (run `storage_bucket_setup.sql`)
  - Check that storage policies are set correctly
  - Verify user is authenticated

### Analysis Fails
- **Error:** "OpenAI API key not configured"
- **Solution:** Add `OPENAI_API_KEY` to `.env.local` and restart the dev server

### PDF Not Supported
- **Error:** "PDF text extraction not yet implemented"
- **Solution:** Convert PDF to image (JPG/PNG) or use Word document format

### Rate Limit Error
- **Error:** "OpenAI rate limit reached"
- **Solution:** Wait a few minutes and try again, or upgrade OpenAI plan

## Testing

1. Navigate to `/dashboard/upload-document`
2. Select an image file (JPG/PNG) containing business document data
3. Click "Upload & Analyze Document"
4. Review extracted data
5. Edit if needed
6. Click "Create [Type] Record" to save

## Future Enhancements

- [ ] Implement PDF text extraction using `pdf-parse` or similar library
- [ ] Add support for Excel/CSV files
- [ ] Batch upload multiple documents
- [ ] Improve OCR accuracy for handwritten documents
- [ ] Add document templates for common formats

