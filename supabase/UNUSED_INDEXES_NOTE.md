# Unused Indexes - Review and Removal Guide

## Overview

The database linter has identified many indexes that have not been used. These are **INFO** level warnings, meaning they're not critical but can be optimized.

## Important Notes

⚠️ **DO NOT blindly remove unused indexes!**

Unused indexes might be:
- Needed for future queries as your application evolves
- Used by queries that haven't been executed yet in production
- Required for specific reporting or analytics queries
- Used during peak times that haven't been captured in the usage statistics

## Recommended Approach

### 1. Review Each Index

Before removing any index, consider:
- **What column(s) does it index?** - Is this likely to be queried?
- **Is it a foreign key?** - Keep these even if unused (they help with JOINs and cascades)
- **Is it a unique constraint?** - Never remove these
- **Is it used in your application code?** - Check your queries

### 2. Safe to Remove

These types of indexes are generally safe to remove if truly unused:
- Single-column indexes on rarely-queried columns
- Composite indexes that are never used
- Indexes on columns that are only used in WHERE clauses with other conditions

### 3. Keep These

**Always keep:**
- Primary key indexes
- Unique constraint indexes
- Foreign key indexes (even if "unused" - they help with cascades)
- Indexes on frequently filtered columns

## Indexes Identified as Unused

The following indexes have been flagged as unused. Review each before removal:

### High Priority to Review
- `idx_drivers_company_id` - Likely used in RLS policies
- `idx_loads_company_id` - Likely used in RLS policies
- `idx_invoices_company_id` - Likely used in RLS policies
- `idx_expenses_company_id` - Likely used in RLS policies
- `idx_trucks_company_id` - Likely used in RLS policies
- `idx_routes_company_id` - Likely used in RLS policies

**Note**: These `company_id` indexes are likely used by RLS policies even if not directly in queries. Keep them!

### Medium Priority to Review
- Status indexes (`idx_loads_status`, `idx_invoices_status`, etc.) - May be used for filtering
- Date indexes (`idx_loads_pickup_date`, `idx_invoices_due_date`, etc.) - May be used for date range queries
- Foreign key indexes - Keep these for JOIN performance

### Low Priority (Safe to Remove if Confirmed Unused)
- Search indexes that were created but never used
- Composite indexes on rarely-queried combinations
- Indexes on columns that are only used in application code with different query patterns

## Removal Script

If you've reviewed and confirmed indexes are truly unused, you can remove them with:

```sql
-- Example: Remove a confirmed unused index
DROP INDEX IF EXISTS idx_example_unused_index;
```

## Recommendation

**For now, keep all indexes.** The storage cost is minimal compared to the potential performance benefit. Only remove indexes after:
1. Confirming they're not used in your application code
2. Confirming they're not used in RLS policies
3. Confirming they're not needed for future features
4. Monitoring query performance after removal

## Future Optimization

Consider:
- Using `pg_stat_user_indexes` to monitor index usage over time
- Setting up alerts for slow queries that might benefit from new indexes
- Reviewing indexes quarterly rather than removing them immediately


