#!/bin/bash

# Script to package SQL files for Claude
# This creates a consolidated SQL file and a zip archive

echo "📦 Packaging SQL files for Claude..."

# Create consolidated SQL file
echo "-- ============================================" > ALL_SCHEMA.sql
echo "-- CONSOLIDATED DATABASE SCHEMA" >> ALL_SCHEMA.sql
echo "-- Generated: $(date)" >> ALL_SCHEMA.sql
echo "-- ============================================" >> ALL_SCHEMA.sql
echo "" >> ALL_SCHEMA.sql

# Add main schema first
if [ -f "supabase/schema.sql" ]; then
    echo "-- ============================================" >> ALL_SCHEMA.sql
    echo "-- MAIN SCHEMA (supabase/schema.sql)" >> ALL_SCHEMA.sql
    echo "-- ============================================" >> ALL_SCHEMA.sql
    cat supabase/schema.sql >> ALL_SCHEMA.sql
    echo "" >> ALL_SCHEMA.sql
    echo "" >> ALL_SCHEMA.sql
fi

# Add all other SQL files
echo "-- ============================================" >> ALL_SCHEMA.sql
echo "-- ADDITIONAL SCHEMAS AND MIGRATIONS" >> ALL_SCHEMA.sql
echo "-- ============================================" >> ALL_SCHEMA.sql
echo "" >> ALL_SCHEMA.sql

for file in supabase/*.sql; do
    if [ -f "$file" ] && [ "$(basename "$file")" != "schema.sql" ]; then
        echo "-- ============================================" >> ALL_SCHEMA.sql
        echo "-- FILE: $file" >> ALL_SCHEMA.sql
        echo "-- ============================================" >> ALL_SCHEMA.sql
        cat "$file" >> ALL_SCHEMA.sql
        echo "" >> ALL_SCHEMA.sql
        echo "" >> ALL_SCHEMA.sql
    fi
done

# Create zip archive
echo "📦 Creating zip archive..."
zip -r SQL_FILES.zip supabase/*.sql *.sql 2>/dev/null

# Create index file
echo "📋 Creating index file..."
cat > SQL_FILES_INDEX.txt << EOF
SQL FILES INDEX
===============

Generated: $(date)

MAIN SCHEMA:
- supabase/schema.sql (Main database schema - MOST IMPORTANT)

FEATURE SCHEMAS:
- supabase/eld_schema.sql (ELD service)
- supabase/marketplace_schema.sql (Marketplace)
- supabase/crm_schema_complete.sql (CRM)
- supabase/subscriptions_schema.sql (Subscriptions)
- supabase/customers_schema_extended.sql (Customers)
- supabase/trucks_schema_extended.sql (Trucks)
- supabase/drivers_schema_extended.sql (Drivers)
- supabase/loads_schema_extended.sql (Loads)

MIGRATIONS:
$(ls -1 supabase/*.sql | grep -v schema.sql | head -20)

TOTAL FILES: $(find supabase -name "*.sql" | wc -l | tr -d ' ')

FILES INCLUDED IN ALL_SCHEMA.sql:
$(ls -1 supabase/*.sql | wc -l | tr -d ' ') SQL files

EOF

echo "✅ Done!"
echo ""
echo "📁 Files created:"
echo "   - ALL_SCHEMA.sql (consolidated SQL file - send this to Claude)"
echo "   - SQL_FILES.zip (zip archive of all SQL files)"
echo "   - SQL_FILES_INDEX.txt (index of all SQL files)"
echo ""
echo "💡 Recommendation: Send ALL_SCHEMA.sql to Claude for best results"

