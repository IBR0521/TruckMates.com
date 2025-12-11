# Technical Capacity Limits (Platform Itself)

## 🗄️ Database Technical Limits (PostgreSQL)

### Maximum Database Size:
- **Unlimited** (limited only by available disk space)
- **Supabase Pro Plan:** Up to **60 TB** (auto-scaling)
- **Supabase Enterprise:** Custom limits (can exceed 60 TB)

### Maximum Table Size:
- **32 TB per table** (PostgreSQL default block size)
- Can be increased by recompiling PostgreSQL with larger block size

### Maximum Rows per Table:
- **Billions of rows** (theoretical limit: ~4.3 billion pages × rows per page)
- **Practical limit:** Depends on row size and available storage
- **Example:** If each row is 1 KB, you can store ~32 billion rows in a 32 TB table

### Maximum Columns per Table:
- **1,600 columns** (must fit within 8 KB page)
- **Columns in Result Set:** 1,664 maximum

### Maximum Field (Column) Size:
- **1 GB per field** (individual column value)

### Maximum Indexes per Table:
- **Unlimited** (limited by relations per database: 1.4 billion)

### Maximum Databases:
- **4.3 billion databases** per PostgreSQL instance

---

## 📁 File Storage Technical Limits

### Maximum File Size (Supabase Storage):
- **Free Tier:** 50 MB per file
- **Pro Tier:** 5 GB per file
- **Enterprise:** Custom limits

### Maximum Storage Capacity:
- **Free Tier:** 1 GB total
- **Pro Tier:** 100 GB (can scale)
- **Enterprise:** Unlimited (with proper plan)

### Current Application Limits:
- **File Upload Limit:** 10 MB (configured in `next.config.mjs`)
- **Server Action Body Limit:** 10 MB (Next.js limit)
- **Client-side Validation:** 10 MB (in `document-upload-analyzer.tsx`)

**Note:** The 10 MB limit is an application-level limit, not a database limit. You can increase this if needed.

---

## 🔢 Practical Capacity Examples

### How Many Records Can You Store?

#### Loads Table:
- **Average row size:** ~2-5 KB (with all fields)
- **In 32 TB table:** ~6-16 billion loads
- **In 1 TB table:** ~200 million - 500 million loads

#### Routes Table:
- **Average row size:** ~2-5 KB
- **In 32 TB table:** ~6-16 billion routes
- **In 1 TB table:** ~200 million - 500 million routes

#### Drivers Table:
- **Average row size:** ~1-2 KB
- **In 32 TB table:** ~16-32 billion drivers
- **In 1 TB table:** ~500 million - 1 billion drivers

#### ELD Logs Table:
- **Average row size:** ~500 bytes - 1 KB
- **In 32 TB table:** ~32-64 billion log entries
- **In 1 TB table:** ~1-2 billion log entries

#### Documents Table:
- **Average row size:** ~500 bytes (metadata only, files stored separately)
- **In 32 TB table:** ~64 billion document records
- **In 1 TB table:** ~2 billion document records

---

## ⚡ Concurrent Operations

### Maximum Concurrent Connections:
- **Free Tier:** 60 connections
- **Pro Tier:** 200 connections
- **Enterprise:** Custom (can scale to thousands)

### Maximum Query Parameters:
- **65,535 parameters** per query

### Maximum Function Arguments:
- **100 arguments** per function

---

## 📊 Real-World Capacity Scenarios

### Scenario 1: Small Fleet (10 trucks)
- **Loads:** 1,000/year × 10 years = 10,000 loads (~50 MB)
- **Routes:** 2,000/year × 10 years = 20,000 routes (~100 MB)
- **ELD Logs:** 1,000 logs/day × 365 days × 10 years = 3.65 million logs (~2 GB)
- **Total Database Size:** ~2.5 GB
- **Storage:** ~500 MB of documents
- **Status:** ✅ Well within free tier limits

### Scenario 2: Medium Fleet (100 trucks)
- **Loads:** 10,000/year × 10 years = 100,000 loads (~500 MB)
- **Routes:** 20,000/year × 10 years = 200,000 routes (~1 GB)
- **ELD Logs:** 10,000 logs/day × 365 days × 10 years = 36.5 million logs (~20 GB)
- **Total Database Size:** ~25 GB
- **Storage:** ~5 GB of documents
- **Status:** ✅ Needs Pro tier (exceeds free tier 500 MB database limit)

### Scenario 3: Large Fleet (1,000 trucks)
- **Loads:** 100,000/year × 10 years = 1 million loads (~5 GB)
- **Routes:** 200,000/year × 10 years = 2 million routes (~10 GB)
- **ELD Logs:** 100,000 logs/day × 365 days × 10 years = 365 million logs (~200 GB)
- **Total Database Size:** ~220 GB
- **Storage:** ~50 GB of documents
- **Status:** ✅ Works on Pro tier (within 60 TB limit)

### Scenario 4: Enterprise Fleet (10,000 trucks)
- **Loads:** 1 million/year × 10 years = 10 million loads (~50 GB)
- **Routes:** 2 million/year × 10 years = 20 million routes (~100 GB)
- **ELD Logs:** 1 million logs/day × 365 days × 10 years = 3.65 billion logs (~2 TB)
- **Total Database Size:** ~2.2 TB
- **Storage:** ~500 GB of documents
- **Status:** ✅ Works on Pro tier (within 60 TB limit)

### Scenario 5: Massive Scale (100,000 trucks)
- **Loads:** 10 million/year × 10 years = 100 million loads (~500 GB)
- **Routes:** 20 million/year × 10 years = 200 million routes (~1 TB)
- **ELD Logs:** 10 million logs/day × 365 days × 10 years = 36.5 billion logs (~20 TB)
- **Total Database Size:** ~22 TB
- **Storage:** ~5 TB of documents
- **Status:** ✅ Works on Pro tier (within 60 TB limit)

---

## 🚀 Performance Considerations

### Query Performance:
- **Small tables (< 1 million rows):** Fast queries (< 100ms)
- **Medium tables (1-10 million rows):** Good with indexes (< 500ms)
- **Large tables (10-100 million rows):** Requires proper indexing (< 2 seconds)
- **Very large tables (> 100 million rows):** May need partitioning or archiving

### Indexing:
- **Recommended:** Index frequently queried columns
- **Current indexes:** `company_id` on all main tables (good!)
- **Additional indexes:** Consider indexing `status`, `created_at`, `date` fields

### Archiving Strategy:
- **Option 1:** Move old records (> 1 year) to archive tables
- **Option 2:** Use table partitioning by date
- **Option 3:** Export old data to cold storage

---

## 📋 Current Application Configuration

### File Upload Limits:
```javascript
// next.config.mjs
serverActions: {
  bodySizeLimit: '10mb', // Can be increased to 4.5 MB (Vercel max)
}

// document-upload-analyzer.tsx
if (selectedFile.size > 10 * 1024 * 1024) { // 10 MB limit
```

### Database Queries:
- **No pagination** on most list queries (loads all records)
- **Limited queries:** ELD logs (1,000), ELD events (500)
- **Unlimited queries:** Loads, routes, drivers, trucks (fetches all)

### Storage:
- **Bucket:** `documents` (private)
- **File size tracking:** Yes (stored in `file_size` column)
- **File URL:** Stored in `file_url` column

---

## 🎯 Summary

### Technical Capacity (Platform Itself):

**Database:**
- ✅ **Unlimited database size** (up to 60 TB on Pro tier)
- ✅ **32 TB per table** (PostgreSQL limit)
- ✅ **Billions of rows per table** (theoretical)
- ✅ **1 GB per field** (individual column value)

**Storage:**
- ✅ **5 GB per file** (Pro tier)
- ✅ **100 GB+ total storage** (Pro tier, can scale)
- ⚠️ **10 MB limit** in current app (can be increased)

**Concurrent Operations:**
- ✅ **200 concurrent connections** (Pro tier)
- ✅ **65,535 query parameters** per query

### Real-World Capacity:
- ✅ **Small fleet (10 trucks):** Works on free tier
- ✅ **Medium fleet (100 trucks):** Needs Pro tier (~25 GB database)
- ✅ **Large fleet (1,000 trucks):** Works on Pro tier (~220 GB database)
- ✅ **Enterprise (10,000 trucks):** Works on Pro tier (~2.2 TB database)
- ✅ **Massive (100,000 trucks):** Works on Pro tier (~22 TB database)

### Bottom Line:
**The platform can technically handle:**
- **Billions of records** in database tables
- **Tens of terabytes** of database storage
- **Hundreds of gigabytes** of file storage
- **Millions of files** (with proper storage plan)

**The main limitation is subscription tier limits, not technical limits!**
