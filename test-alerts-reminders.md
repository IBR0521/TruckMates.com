# Alerts & Reminders Testing Guide

## ✅ Implementation Verification

### 1. Role-Based Alert Filtering

**Test Case 1: Driver Role**
- Login as a driver
- Navigate to `/dashboard/alerts`
- Expected: Only see alerts for event types: `hos_violation`, `hos_alert`, `dvir_required`, `check_call`, `load_assigned`, `route_update`
- Expected: Only see alerts where `driver_id` matches their driver_id OR is null

**Test Case 2: Manager Role**
- Login as a manager
- Navigate to `/dashboard/alerts`
- Expected: See ALL alerts (no filtering)

**Test Case 3: Fleet Manager Role**
- Login as a fleet_manager
- Navigate to `/dashboard/alerts`
- Expected: Only see alerts for: `maintenance_due`, `maintenance_overdue`, `insurance_expiration`, `license_renewal`, `dvir_required`

**How to Test:**
```typescript
// In browser console or test file:
const { getAlerts } = await import('@/app/actions/alerts')
const result = await getAlerts({ role_filter: true })
console.log('Alerts for current user:', result.data)
```

---

### 2. Dashboard Reminders Widget

**Test Case 1: Widget Renders**
- Navigate to `/dashboard`
- Expected: See "Reminders" widget on the right side (next to Alerts)
- Expected: Widget shows top 5 reminders (overdue first, then upcoming)

**Test Case 2: Empty State**
- If no reminders exist
- Expected: Widget shows "No pending reminders"

**Test Case 3: Overdue Reminders**
- Create a reminder with `due_date` in the past
- Expected: Reminder shows with red background and "X days overdue" text

**Test Case 4: Urgent Reminders**
- Create a reminder due today or tomorrow
- Expected: Reminder shows with yellow background

**Test Case 5: Complete Reminder**
- Click the checkmark button on a reminder
- Expected: Reminder is marked as completed
- Expected: Toast notification shows "Reminder completed"
- Expected: Widget refreshes and reminder disappears

**How to Test:**
1. Create test reminders via SQL:
```sql
INSERT INTO reminders (company_id, title, reminder_type, due_date, status)
VALUES 
  ('your-company-id', 'Test Overdue Reminder', 'maintenance', CURRENT_DATE - 2, 'pending'),
  ('your-company-id', 'Test Urgent Reminder', 'maintenance', CURRENT_DATE, 'pending'),
  ('your-company-id', 'Test Upcoming Reminder', 'maintenance', CURRENT_DATE + 3, 'pending');
```

2. Refresh dashboard and verify widget displays correctly

---

### 3. Priority-Based Channel Selection

**Test Case 1: Critical Alert**
- Create an alert with `priority: 'critical'`
- Expected: 
  - Push notification created (in `notifications` table)
  - SMS sent (if `send_sms: true` in alert rule)
  - Email sent (if `send_email: true` in alert rule)

**Test Case 2: High Priority Alert**
- Create an alert with `priority: 'high'`
- Expected:
  - Push notification created
  - Email sent
  - NO SMS (only critical gets SMS)

**Test Case 3: Normal Priority Alert**
- Create an alert with `priority: 'normal'`
- Expected:
  - Email sent
  - NO push notification
  - NO SMS

**Test Case 4: Low Priority Alert**
- Create an alert with `priority: 'low'`
- Expected:
  - NO email
  - NO push
  - NO SMS
  - Only visible in dashboard

**How to Test:**
```typescript
// Create test alert
const { createAlert } = await import('@/app/actions/alerts')
await createAlert({
  title: 'Test Critical Alert',
  message: 'This is a critical alert',
  event_type: 'hos_violation',
  priority: 'critical'
})

// Check notifications table
const { data } = await supabase
  .from('notifications')
  .select('*')
  .eq('type', 'alert')
  .order('created_at', { ascending: false })
  .limit(1)
```

---

### 4. Smart Triggers (Database)

**Test Case 1: Insurance Expiration Alert**
```sql
-- Create test insurance record expiring in 5 days
INSERT INTO insurance (truck_id, insurance_type, expiration_date)
VALUES (
  'your-truck-id',
  'Liability',
  CURRENT_DATE + INTERVAL '5 days'
);

-- Expected: Alert automatically created with:
-- - priority: 'critical' (since < 7 days)
-- - event_type: 'insurance_expiration'
-- - title: 'URGENT: Insurance Expiring Soon'
```

**Test Case 2: Document Expiration Alert**
```sql
-- Create test CRM document expiring in 20 days
INSERT INTO crm_documents (customer_id, document_type, expiration_date)
VALUES (
  'your-customer-id',
  'W-9',
  CURRENT_DATE + INTERVAL '20 days'
);

-- Expected: Alert automatically created with:
-- - priority: 'high' (since 14 < days < 30)
-- - event_type: 'document_expiration'
```

**Test Case 3: Maintenance Reminder Auto-Completion**
```sql
-- Create a maintenance reminder
INSERT INTO reminders (company_id, title, reminder_type, due_date, truck_id, status)
VALUES (
  'your-company-id',
  'Service Due: Oil Change',
  'maintenance',
  CURRENT_DATE + 5,
  'your-truck-id',
  'pending'
);

-- Complete the maintenance
UPDATE maintenance
SET status = 'completed'
WHERE truck_id = 'your-truck-id' AND service_type = 'Oil Change';

-- Expected: Reminder automatically updated:
-- - status: 'completed'
-- - completed_at: NOW()
```

**How to Test:**
1. Run SQL migration: `supabase/alerts_smart_triggers.sql`
2. Create test records as shown above
3. Verify alerts/reminders are created/updated automatically

---

### 5. Mileage-Based Reminder Creation

**Test Case 1: Auto-Create Reminder**
```sql
-- Create maintenance schedule
INSERT INTO maintenance (truck_id, service_type, next_service_mileage, status)
VALUES (
  'your-truck-id',
  'Oil Change',
  10000,
  'scheduled'
);

-- Update truck mileage to 9500 (500 miles before service)
UPDATE trucks
SET current_mileage = 9500
WHERE id = 'your-truck-id';

-- Call the function
SELECT auto_create_maintenance_reminders_from_schedule();

-- Expected: Reminder created with:
-- - title: 'Service Due: Oil Change'
-- - due_date: ~2 days from now (estimated based on 300 miles/day)
-- - reminder_type: 'maintenance'
-- - metadata contains maintenance_id and mileage info
```

**How to Test:**
1. Run SQL migration: `supabase/alerts_smart_triggers.sql`
2. Set up test maintenance schedule
3. Call function manually or wait for Edge Function to run
4. Verify reminder is created

---

## 🧪 Manual Testing Checklist

- [ ] **Role-Based Filtering**
  - [ ] Driver sees only driver alerts
  - [ ] Manager sees all alerts
  - [ ] Fleet manager sees maintenance alerts

- [ ] **Dashboard Widget**
  - [ ] Widget renders on dashboard
  - [ ] Shows overdue reminders (red)
  - [ ] Shows urgent reminders (yellow)
  - [ ] Shows upcoming reminders (gray)
  - [ ] Complete button works
  - [ ] Empty state shows correctly

- [ ] **Priority Channels**
  - [ ] Critical alerts send push + SMS + email
  - [ ] High alerts send push + email
  - [ ] Normal alerts send email only
  - [ ] Low alerts show in dashboard only

- [ ] **Smart Triggers**
  - [ ] Insurance expiration creates alert
  - [ ] Document expiration creates alert
  - [ ] Maintenance completion auto-completes reminder

- [ ] **Mileage Reminders**
  - [ ] Function creates reminders at 500 miles before service
  - [ ] Edge Function runs daily (or manually)

---

## 🐛 Common Issues & Fixes

### Issue 1: Reminders Widget Not Showing
**Fix:** Check if `reminders` table exists and has RLS policies

### Issue 2: Role Filtering Not Working
**Fix:** Verify user has `role` field in `users` table

### Issue 3: Smart Triggers Not Firing
**Fix:** 
- Check if triggers are created: `SELECT * FROM pg_trigger WHERE tgname LIKE '%expiration%'`
- Verify table names match your schema

### Issue 4: Notifications Table Missing
**Fix:** The code gracefully handles missing notifications table. If you want push notifications, create the table:
```sql
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT,
  priority TEXT,
  metadata JSONB,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 📊 Expected Results

After testing, you should see:
- ✅ Role-based filtering working
- ✅ Dashboard widget displaying reminders
- ✅ Priority-based channels sending correctly
- ✅ Smart triggers creating alerts automatically
- ✅ Maintenance reminders auto-completing
- ✅ Mileage-based reminders being created

---

## 🚀 Next Steps After Testing

1. **If all tests pass:**
   - Deploy Edge Function: `supabase functions deploy daily-reminders-check`
   - Set up cron job for daily reminder checks
   - Monitor alert creation in production

2. **If issues found:**
   - Check error logs
   - Verify database schema matches expectations
   - Review RLS policies
   - Check user roles are set correctly



