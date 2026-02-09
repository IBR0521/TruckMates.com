# Quick Test Guide - Alerts & Reminders

## ✅ Pre-Test Checklist

1. **Dependencies Installed**
   - ✅ `date-fns` is installed (v4.1.0)
   - ✅ All React components compile

2. **Database Tables Required**
   - `alerts` table exists
   - `reminders` table exists
   - `users` table has `role` and `driver_id` columns
   - `crm_documents` table exists (for document expiration alerts)
   - `maintenance` table exists (for maintenance reminders)

3. **SQL Migration**
   - Run `supabase/alerts_smart_triggers.sql` in Supabase SQL Editor

---

## 🧪 Quick Tests (5 minutes)

### Test 1: Dashboard Widget Renders
1. Start dev server: `npm run dev`
2. Navigate to `/dashboard`
3. **Expected:** See "Reminders" widget on the right side
4. **If empty:** Widget shows "No pending reminders" (this is correct if no reminders exist)

### Test 2: Role-Based Filtering
1. Login as different users with different roles
2. Navigate to `/dashboard/alerts`
3. **Expected:**
   - Driver: Only sees HOS/DVIR alerts
   - Manager: Sees all alerts
   - Fleet Manager: Only sees maintenance/insurance alerts

### Test 3: Create Test Reminder
```sql
-- In Supabase SQL Editor, replace 'your-company-id' with actual company_id
INSERT INTO reminders (company_id, title, reminder_type, due_date, status)
VALUES (
  'your-company-id',
  'Test Reminder',
  'maintenance',
  CURRENT_DATE + 2,
  'pending'
);
```
1. Refresh dashboard
2. **Expected:** Reminder appears in widget
3. Click checkmark
4. **Expected:** Reminder disappears (marked as completed)

### Test 4: Smart Trigger (Document Expiration)
```sql
-- Create test document expiring in 5 days
INSERT INTO crm_documents (customer_id, document_type, expiration_date)
VALUES (
  'your-customer-id',
  'W-9',
  CURRENT_DATE + INTERVAL '5 days'
);
```
1. Check `alerts` table
2. **Expected:** Alert automatically created with `event_type = 'document_expiration'` and `priority = 'critical'`

---

## 🐛 Common Issues

### Issue: Widget Not Showing
**Solution:** Check browser console for errors. Verify `reminders` table exists.

### Issue: Role Filtering Not Working
**Solution:** Verify user has `role` field in `users` table. Check `getAlerts()` is called with `role_filter: true` (default).

### Issue: Smart Triggers Not Firing
**Solution:** 
1. Verify SQL migration was run
2. Check triggers exist: `SELECT * FROM pg_trigger WHERE tgname LIKE '%expiration%'`
3. Verify table names match your schema

---

## ✅ Success Criteria

- [ ] Dashboard widget renders
- [ ] Reminders widget shows reminders (if any exist)
- [ ] Role-based filtering works (different users see different alerts)
- [ ] Smart triggers create alerts automatically
- [ ] No console errors
- [ ] No TypeScript errors

---

## 📝 Next Steps

1. **If all tests pass:**
   - Deploy Edge Function: `supabase functions deploy daily-reminders-check`
   - Set up cron job for daily checks
   - Monitor in production

2. **If issues found:**
   - Check error logs
   - Verify database schema
   - Review RLS policies



