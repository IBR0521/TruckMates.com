-- ============================================================================
-- Predictive Maintenance SMS Alerts
-- Send SMS alerts 500 miles before maintenance is due
-- ============================================================================

-- Table to track maintenance alert notifications (prevent duplicates)
CREATE TABLE IF NOT EXISTS public.maintenance_alert_notifications (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  truck_id UUID REFERENCES public.trucks(id) ON DELETE CASCADE NOT NULL,
  maintenance_id UUID REFERENCES public.maintenance(id) ON DELETE CASCADE,
  service_type TEXT NOT NULL,
  alert_mileage INTEGER NOT NULL, -- Mileage when alert was sent
  target_mileage INTEGER NOT NULL, -- Mileage when service is due
  miles_remaining INTEGER NOT NULL, -- Miles remaining until service
  notification_type TEXT DEFAULT 'sms', -- 'sms', 'email', 'push'
  sent_to UUID REFERENCES public.users(id) ON DELETE SET NULL, -- Fleet manager who received alert
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  status TEXT DEFAULT 'sent', -- 'sent', 'failed', 'acknowledged'
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE(truck_id, service_type, alert_mileage)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_maintenance_alerts_truck_id ON public.maintenance_alert_notifications(truck_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_alerts_company_id ON public.maintenance_alert_notifications(company_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_alerts_sent_at ON public.maintenance_alert_notifications(sent_at);

-- Function to check and send maintenance alerts
CREATE OR REPLACE FUNCTION check_and_send_maintenance_alerts(
  p_truck_id UUID,
  p_current_mileage INTEGER
)
RETURNS INTEGER AS $$
DECLARE
  v_company_id UUID;
  v_truck RECORD;
  v_alerts_sent INTEGER := 0;
  v_service_type TEXT;
  v_interval INTEGER;
  v_last_service_mileage INTEGER;
  v_miles_since_service INTEGER;
  v_target_mileage INTEGER;
  v_miles_remaining INTEGER;
  v_fleet_manager_id UUID;
  v_fleet_manager_phone TEXT;
  v_message TEXT;
  v_maintenance_record RECORD;
BEGIN
  -- Get truck and company info
  SELECT t.*, c.id as company_id
  INTO v_truck
  FROM public.trucks t
  INNER JOIN public.companies c ON c.id = t.company_id
  WHERE t.id = p_truck_id;
  
  IF NOT FOUND THEN
    RETURN 0;
  END IF;
  
  v_company_id := v_truck.company_id;
  
  -- Maintenance intervals (miles)
  FOR v_maintenance_record IN
    SELECT service_type, interval_miles FROM (
      VALUES 
        ('Oil Change', 10000),
        ('Tire Rotation', 15000),
        ('Brake Inspection', 20000),
        ('Brake Service', 50000),
        ('Transmission Service', 60000),
        ('Major Service', 100000)
    ) AS intervals(service_type, interval_miles)
  LOOP
    v_service_type := v_maintenance_record.service_type;
    v_interval := v_maintenance_record.interval_miles;
      -- Find last time this service was performed
      SELECT COALESCE(MAX(current_mileage), 0)
      INTO v_last_service_mileage
      FROM public.maintenance
      WHERE truck_id = p_truck_id
        AND service_type = v_service_type
        AND status = 'completed';
      
      -- Calculate miles since last service
      v_miles_since_service := p_current_mileage - v_last_service_mileage;
      
      -- Calculate target mileage (when service is due)
      v_target_mileage := v_last_service_mileage + v_interval;
      
      -- Calculate miles remaining until service
      v_miles_remaining := v_target_mileage - p_current_mileage;
      
      -- Check if we're within 500 miles of service due
      IF v_miles_remaining <= 500 AND v_miles_remaining > 0 THEN
        -- Check if we've already sent an alert for this mileage range
        -- (Send one alert per 100-mile increment to avoid spam)
        IF NOT EXISTS (
          SELECT 1
          FROM public.maintenance_alert_notifications
          WHERE truck_id = p_truck_id
            AND service_type = v_service_type
            AND alert_mileage BETWEEN (p_current_mileage - 100) AND (p_current_mileage + 100)
        ) THEN
          -- Get fleet manager phone number
          SELECT u.id, u.phone
          INTO v_fleet_manager_id, v_fleet_manager_phone
          FROM public.users u
          WHERE u.company_id = v_company_id
            AND u.role = 'fleet_manager'
            AND u.phone IS NOT NULL
          ORDER BY u.created_at ASC
          LIMIT 1;
          
          -- If no fleet manager, try admin
          IF v_fleet_manager_id IS NULL THEN
            SELECT u.id, u.phone
            INTO v_fleet_manager_id, v_fleet_manager_phone
            FROM public.users u
            WHERE u.company_id = v_company_id
              AND u.role = 'admin'
              AND u.phone IS NOT NULL
            ORDER BY u.created_at ASC
            LIMIT 1;
          END IF;
          
          -- Create alert record (SMS will be sent by application code)
          INSERT INTO public.maintenance_alert_notifications (
            company_id,
            truck_id,
            service_type,
            alert_mileage,
            target_mileage,
            miles_remaining,
            sent_to,
            status
          ) VALUES (
            v_company_id,
            p_truck_id,
            v_service_type,
            p_current_mileage,
            v_target_mileage,
            v_miles_remaining,
            v_fleet_manager_id,
            'pending' -- Will be updated to 'sent' or 'failed' by application
          )
          ON CONFLICT (truck_id, service_type, alert_mileage) DO NOTHING;
          
          IF FOUND THEN
            v_alerts_sent := v_alerts_sent + 1;
          END IF;
        END IF;
      END IF;
  END LOOP;
  
  RETURN v_alerts_sent;
END;
$$ LANGUAGE plpgsql;

-- Enable RLS
ALTER TABLE public.maintenance_alert_notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view maintenance alerts from their company"
  ON public.maintenance_alert_notifications
  FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

-- Add comments
COMMENT ON TABLE public.maintenance_alert_notifications IS 
  'Tracks SMS alerts sent for predictive maintenance (500 miles before service due)';
COMMENT ON FUNCTION check_and_send_maintenance_alerts IS 
  'Checks if maintenance alerts should be sent and creates notification records';

