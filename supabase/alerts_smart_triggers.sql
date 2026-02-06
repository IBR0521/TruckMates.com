-- Smart Alerts via Database Triggers
-- Automatically creates alerts when specific conditions are met
-- Prevents manual alert creation and ensures nothing is missed

-- ============================================================================
-- 1. Insurance Expiration Alerts
-- ============================================================================

-- Function to check and create insurance expiration alerts
CREATE OR REPLACE FUNCTION public.trigger_insurance_expiration_alert()
RETURNS TRIGGER AS $$
DECLARE
  v_days_until_expiry INTEGER;
  v_alert_title TEXT;
  v_alert_message TEXT;
  v_priority TEXT;
BEGIN
  -- Calculate days until expiration
  v_days_until_expiry := (NEW.expiration_date::DATE - CURRENT_DATE)::INTEGER;
  
  -- Only create alert if expiring within 60 days and not already expired
  IF v_days_until_expiry <= 60 AND v_days_until_expiry >= 0 THEN
    -- Determine priority based on days remaining
    IF v_days_until_expiry <= 7 THEN
      v_priority := 'critical';
      v_alert_title := 'URGENT: Insurance Expiring Soon';
      v_alert_message := format('Insurance for %s expires in %s day(s). Renewal required immediately.', 
        COALESCE(NEW.insurance_type, 'Vehicle'), v_days_until_expiry);
    ELSIF v_days_until_expiry <= 30 THEN
      v_priority := 'high';
      v_alert_title := 'Insurance Expiring Soon';
      v_alert_message := format('Insurance for %s expires in %s day(s). Please renew.', 
        COALESCE(NEW.insurance_type, 'Vehicle'), v_days_until_expiry);
    ELSE
      v_priority := 'normal';
      v_alert_title := 'Insurance Renewal Reminder';
      v_alert_message := format('Insurance for %s expires in %s day(s).', 
        COALESCE(NEW.insurance_type, 'Vehicle'), v_days_until_expiry);
    END IF;
    
    -- Check if alert already exists for this insurance record
    IF NOT EXISTS (
      SELECT 1 FROM public.alerts 
      WHERE truck_id = NEW.truck_id 
        AND event_type = 'insurance_expiration'
        AND status = 'active'
        AND metadata->>'insurance_id' = NEW.id::TEXT
    ) THEN
      -- Create alert
      INSERT INTO public.alerts (
        company_id,
        title,
        message,
        event_type,
        priority,
        truck_id,
        metadata,
        status
      )
      SELECT 
        t.company_id,
        v_alert_title,
        v_alert_message,
        'insurance_expiration',
        v_priority,
        NEW.truck_id,
        jsonb_build_object(
          'insurance_id', NEW.id,
          'insurance_type', NEW.insurance_type,
          'expiration_date', NEW.expiration_date,
          'days_until_expiry', v_days_until_expiry
        ),
        'active'
      FROM public.trucks t
      WHERE t.id = NEW.truck_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on insurance table (if it exists)
-- Note: Adjust table name based on your schema
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'insurance' AND table_schema = 'public') THEN
    DROP TRIGGER IF EXISTS trigger_insurance_expiration_alert ON public.insurance;
    CREATE TRIGGER trigger_insurance_expiration_alert
      AFTER INSERT OR UPDATE OF expiration_date ON public.insurance
      FOR EACH ROW
      EXECUTE FUNCTION public.trigger_insurance_expiration_alert();
  END IF;
END $$;

-- ============================================================================
-- 2. CRM Document Expiration Alerts
-- ============================================================================

-- Function to check and create CRM document expiration alerts
CREATE OR REPLACE FUNCTION public.trigger_crm_document_expiration_alert()
RETURNS TRIGGER AS $$
DECLARE
  v_days_until_expiry INTEGER;
  v_alert_title TEXT;
  v_alert_message TEXT;
  v_priority TEXT;
  v_contact_type TEXT;
  v_contact_id UUID;
BEGIN
  -- Only process if expiration_date exists and is set
  IF NEW.expiration_date IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Calculate days until expiration
  v_days_until_expiry := (NEW.expiration_date::DATE - CURRENT_DATE)::INTEGER;
  
  -- Only create alert if expiring within 30 days and not already expired
  IF v_days_until_expiry <= 30 AND v_days_until_expiry >= 0 THEN
    -- Get contact type and ID from metadata or linked tables
    v_contact_type := COALESCE(NEW.contact_type, 'unknown');
    v_contact_id := COALESCE(NEW.customer_id, NEW.vendor_id);
    
    -- Determine priority
    IF v_days_until_expiry <= 7 THEN
      v_priority := 'critical';
      v_alert_title := 'URGENT: Document Expiring Soon';
      v_alert_message := format('%s document expires in %s day(s). Renewal required immediately.', 
        COALESCE(NEW.document_type, 'Document'), v_days_until_expiry);
    ELSIF v_days_until_expiry <= 14 THEN
      v_priority := 'high';
      v_alert_title := 'Document Expiring Soon';
      v_alert_message := format('%s document expires in %s day(s). Please renew.', 
        COALESCE(NEW.document_type, 'Document'), v_days_until_expiry);
    ELSE
      v_priority := 'normal';
      v_alert_title := 'Document Renewal Reminder';
      v_alert_message := format('%s document expires in %s day(s).', 
        COALESCE(NEW.document_type, 'Document'), v_days_until_expiry);
    END IF;
    
    -- Check if alert already exists
    IF NOT EXISTS (
      SELECT 1 FROM public.alerts 
      WHERE event_type = 'document_expiration'
        AND status = 'active'
        AND metadata->>'document_id' = NEW.id::TEXT
    ) THEN
      -- Get company_id from customer or vendor
      INSERT INTO public.alerts (
        company_id,
        title,
        message,
        event_type,
        priority,
        metadata,
        status
      )
      SELECT 
        COALESCE(c.company_id, v.company_id),
        v_alert_title,
        v_alert_message,
        'document_expiration',
        v_priority,
        jsonb_build_object(
          'document_id', NEW.id,
          'document_type', NEW.document_type,
          'expiration_date', NEW.expiration_date,
          'days_until_expiry', v_days_until_expiry,
          'contact_type', v_contact_type,
          'contact_id', v_contact_id
        ),
        'active'
      FROM (SELECT 1) AS dummy
      LEFT JOIN public.customers c ON c.id = NEW.customer_id
      LEFT JOIN public.vendors v ON v.id = NEW.vendor_id
      WHERE NEW.customer_id IS NOT NULL OR NEW.vendor_id IS NOT NULL
      LIMIT 1;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on crm_documents table
DROP TRIGGER IF EXISTS trigger_crm_document_expiration_alert ON public.crm_documents;
CREATE TRIGGER trigger_crm_document_expiration_alert
  AFTER INSERT OR UPDATE OF expiration_date ON public.crm_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_crm_document_expiration_alert();

-- ============================================================================
-- 3. Maintenance Reminder Auto-Completion
-- ============================================================================

-- Function to auto-complete maintenance reminders when maintenance is completed
CREATE OR REPLACE FUNCTION public.trigger_auto_complete_maintenance_reminders()
RETURNS TRIGGER AS $$
BEGIN
  -- Only process if status changed to 'completed'
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    -- Auto-complete all pending reminders linked to this maintenance or truck
    UPDATE public.reminders
    SET 
      status = 'completed',
      completed_at = NOW(),
      completed_by = NEW.updated_by -- Or use a system user ID
    WHERE (
      (truck_id = NEW.truck_id AND reminder_type = 'maintenance')
      OR (metadata->>'maintenance_id' = NEW.id::TEXT)
    )
    AND status = 'pending'
    AND reminder_type IN ('maintenance', 'service_due');
    
    -- If recurring reminder, create next occurrence
    -- (This is handled by the existing completeReminder function)
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on maintenance table
DROP TRIGGER IF EXISTS trigger_auto_complete_maintenance_reminders ON public.maintenance;
CREATE TRIGGER trigger_auto_complete_maintenance_reminders
  AFTER UPDATE OF status ON public.maintenance
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_auto_complete_maintenance_reminders();

-- ============================================================================
-- 4. Auto-Create Maintenance Reminders from Schedule
-- ============================================================================

-- Function to auto-create maintenance reminders based on mileage
CREATE OR REPLACE FUNCTION public.auto_create_maintenance_reminders_from_schedule()
RETURNS INTEGER AS $$
DECLARE
  v_truck RECORD;
  v_maintenance RECORD;
  v_current_mileage INTEGER;
  v_reminder_created INTEGER := 0;
  v_days_until_due INTEGER;
BEGIN
  -- Loop through all active trucks
  FOR v_truck IN
    SELECT id, company_id, current_mileage, truck_number
    FROM public.trucks
    WHERE status = 'active'
  LOOP
    v_current_mileage := COALESCE(v_truck.current_mileage, 0);
    
    -- Check maintenance schedule for this truck
    FOR v_maintenance IN
      SELECT 
        m.id,
        m.truck_id,
        m.service_type,
        m.next_service_mileage,
        m.next_service_date,
        m.company_id
      FROM public.maintenance m
      WHERE m.truck_id = v_truck.id
        AND m.status = 'scheduled'
        AND (
          (m.next_service_mileage IS NOT NULL AND v_current_mileage >= m.next_service_mileage - 500)
          OR (m.next_service_date IS NOT NULL AND m.next_service_date <= CURRENT_DATE + INTERVAL '30 days')
        )
    LOOP
      -- Check if reminder already exists
      IF NOT EXISTS (
        SELECT 1 FROM public.reminders
        WHERE truck_id = v_maintenance.truck_id
          AND reminder_type = 'maintenance'
          AND status = 'pending'
          AND metadata->>'maintenance_id' = v_maintenance.id::TEXT
      ) THEN
        -- Calculate due date
        IF v_maintenance.next_service_mileage IS NOT NULL THEN
          -- Estimate date based on average daily miles (assume 300 miles/day)
          v_days_until_due := GREATEST(1, (v_maintenance.next_service_mileage - v_current_mileage) / 300);
        ELSE
          v_days_until_due := (v_maintenance.next_service_date::DATE - CURRENT_DATE)::INTEGER;
        END IF;
        
        -- Create reminder
        INSERT INTO public.reminders (
          company_id,
          title,
          description,
          reminder_type,
          due_date,
          reminder_date,
          truck_id,
          status,
          metadata,
          send_email,
          send_sms
        ) VALUES (
          v_maintenance.company_id,
          format('Service Due: %s', v_maintenance.service_type),
          format('Truck %s requires %s service. %s miles remaining until service due.', 
            v_truck.truck_number, 
            v_maintenance.service_type,
            COALESCE(v_maintenance.next_service_mileage - v_current_mileage, 0)),
          'maintenance',
          CURRENT_DATE + (v_days_until_due || ' days')::INTERVAL,
          CURRENT_DATE + GREATEST(1, v_days_until_due - 1)::INTERVAL, -- Remind 1 day before
          v_maintenance.truck_id,
          'pending',
          jsonb_build_object(
            'maintenance_id', v_maintenance.id,
            'service_type', v_maintenance.service_type,
            'current_mileage', v_current_mileage,
            'target_mileage', v_maintenance.next_service_mileage
          ),
          true,
          v_days_until_due <= 7 -- SMS only if urgent
        );
        
        v_reminder_created := v_reminder_created + 1;
      END IF;
    END LOOP;
  END LOOP;
  
  RETURN v_reminder_created;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.auto_create_maintenance_reminders_from_schedule() TO authenticated;
GRANT EXECUTE ON FUNCTION public.auto_create_maintenance_reminders_from_schedule() TO service_role;

-- ============================================================================
-- 5. Scheduled Function to Run Auto-Create Reminders
-- ============================================================================

-- This can be called by a Supabase Edge Function or cron job
-- Example: Call this function daily to check for maintenance reminders

COMMENT ON FUNCTION public.auto_create_maintenance_reminders_from_schedule() IS 
'Automatically creates maintenance reminders based on mileage and service schedules. 
Should be called daily via Edge Function or cron job.';


