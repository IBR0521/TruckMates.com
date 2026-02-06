-- ============================================================================
-- Automated Detention Tracking System
-- Tracks time drivers spend in zones and automatically adds detention fees
-- ============================================================================

-- Detention tracking table
CREATE TABLE IF NOT EXISTS public.detention_tracking (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  geofence_id UUID REFERENCES public.geofences(id) ON DELETE CASCADE NOT NULL,
  zone_visit_id UUID REFERENCES public.zone_visits(id) ON DELETE SET NULL,
  load_id UUID REFERENCES public.loads(id) ON DELETE SET NULL,
  truck_id UUID REFERENCES public.trucks(id) ON DELETE SET NULL,
  driver_id UUID REFERENCES public.drivers(id) ON DELETE SET NULL,
  
  -- Detention details
  entry_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  exit_timestamp TIMESTAMP WITH TIME ZONE,
  total_minutes INTEGER NOT NULL, -- Total time in zone
  detention_minutes INTEGER NOT NULL DEFAULT 0, -- Minutes beyond free time (e.g., after 2 hours)
  
  -- Fee calculation
  detention_threshold_minutes INTEGER DEFAULT 120, -- Free time (default 2 hours)
  hourly_rate DECIMAL(10, 2), -- Detention fee per hour
  total_fee DECIMAL(10, 2) DEFAULT 0, -- Calculated detention fee
  
  -- Status
  status TEXT DEFAULT 'active', -- 'active', 'completed', 'billed', 'waived'
  invoice_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
  
  -- Metadata
  notes TEXT,
  auto_generated BOOLEAN DEFAULT true, -- True if auto-detected, false if manual
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_detention_tracking_company_id ON public.detention_tracking(company_id);
CREATE INDEX IF NOT EXISTS idx_detention_tracking_geofence_id ON public.detention_tracking(geofence_id);
CREATE INDEX IF NOT EXISTS idx_detention_tracking_load_id ON public.detention_tracking(load_id);
CREATE INDEX IF NOT EXISTS idx_detention_tracking_status ON public.detention_tracking(status);
CREATE INDEX IF NOT EXISTS idx_detention_tracking_entry_timestamp ON public.detention_tracking(entry_timestamp);
CREATE INDEX IF NOT EXISTS idx_detention_tracking_zone_visit_id ON public.detention_tracking(zone_visit_id);

-- Add detention settings to geofences table
ALTER TABLE public.geofences 
ADD COLUMN IF NOT EXISTS detention_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS detention_threshold_minutes INTEGER DEFAULT 120,
ADD COLUMN IF NOT EXISTS detention_hourly_rate DECIMAL(10, 2) DEFAULT 50.00,
ADD COLUMN IF NOT EXISTS detention_auto_bill BOOLEAN DEFAULT true;

-- Function to calculate current detention time for active visits
CREATE OR REPLACE FUNCTION calculate_active_detention()
RETURNS TABLE (
  zone_visit_id UUID,
  geofence_id UUID,
  truck_id UUID,
  driver_id UUID,
  entry_timestamp TIMESTAMP WITH TIME ZONE,
  current_minutes INTEGER,
  detention_minutes INTEGER,
  detention_threshold_minutes INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    zv.id as zone_visit_id,
    zv.geofence_id,
    zv.truck_id,
    zv.driver_id,
    zv.entry_timestamp,
    -- Calculate current minutes inside zone
    EXTRACT(EPOCH FROM (NOW() - zv.entry_timestamp))::INTEGER / 60 as current_minutes,
    -- Calculate detention minutes (time beyond threshold)
    GREATEST(0, 
      (EXTRACT(EPOCH FROM (NOW() - zv.entry_timestamp))::INTEGER / 60) - 
      COALESCE(g.detention_threshold_minutes, 120)
    ) as detention_minutes,
    COALESCE(g.detention_threshold_minutes, 120) as detention_threshold_minutes
  FROM public.zone_visits zv
  INNER JOIN public.geofences g ON g.id = zv.geofence_id
  WHERE zv.event_type = 'entry'
    AND zv.exit_timestamp IS NULL
    AND g.detention_enabled = true
    AND g.is_active = true
    -- Only count visits that have exceeded threshold
    AND (EXTRACT(EPOCH FROM (NOW() - zv.entry_timestamp))::INTEGER / 60) > COALESCE(g.detention_threshold_minutes, 120);
END;
$$ LANGUAGE plpgsql;

-- Function to create detention record when threshold is exceeded
CREATE OR REPLACE FUNCTION create_detention_record(
  p_zone_visit_id UUID,
  p_load_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_visit RECORD;
  v_geofence RECORD;
  v_truck RECORD;
  v_detention_id UUID;
  v_total_minutes INTEGER;
  v_detention_minutes INTEGER;
  v_total_fee DECIMAL(10, 2);
BEGIN
  -- Get visit details
  SELECT 
    zv.*,
    g.detention_threshold_minutes,
    g.detention_hourly_rate,
    g.company_id
  INTO v_visit
  FROM public.zone_visits zv
  INNER JOIN public.geofences g ON g.id = zv.geofence_id
  WHERE zv.id = p_zone_visit_id
    AND zv.event_type = 'entry'
    AND g.detention_enabled = true;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Visit not found or detention not enabled for this zone';
  END IF;
  
  -- Get truck info to find associated load
  SELECT * INTO v_truck
  FROM public.trucks
  WHERE id = v_visit.truck_id;
  
  -- If load_id not provided, try to find active load for this truck
  IF p_load_id IS NULL THEN
    SELECT id INTO p_load_id
    FROM public.loads
    WHERE truck_id = v_visit.truck_id
      AND status IN ('in_progress', 'in_transit', 'scheduled')
    ORDER BY created_at DESC
    LIMIT 1;
  END IF;
  
  -- Calculate detention time
  v_total_minutes := EXTRACT(EPOCH FROM (NOW() - v_visit.entry_timestamp))::INTEGER / 60;
  v_detention_minutes := GREATEST(0, v_total_minutes - COALESCE(v_visit.detention_threshold_minutes, 120));
  
  -- Calculate fee (round up to nearest hour)
  v_total_fee := CEIL(v_detention_minutes / 60.0) * COALESCE(v_visit.detention_hourly_rate, 50.00);
  
  -- Check if detention record already exists
  SELECT id INTO v_detention_id
  FROM public.detention_tracking
  WHERE zone_visit_id = p_zone_visit_id
    AND status = 'active';
  
  IF v_detention_id IS NOT NULL THEN
    -- Update existing record
    UPDATE public.detention_tracking
    SET 
      total_minutes = v_total_minutes,
      detention_minutes = v_detention_minutes,
      total_fee = v_total_fee,
      updated_at = NOW()
    WHERE id = v_detention_id;
    
    RETURN v_detention_id;
  ELSE
    -- Create new detention record
    INSERT INTO public.detention_tracking (
      company_id,
      geofence_id,
      zone_visit_id,
      load_id,
      truck_id,
      driver_id,
      entry_timestamp,
      total_minutes,
      detention_minutes,
      detention_threshold_minutes,
      hourly_rate,
      total_fee,
      status,
      auto_generated
    ) VALUES (
      v_visit.company_id,
      v_visit.geofence_id,
      p_zone_visit_id,
      p_load_id,
      v_visit.truck_id,
      v_visit.driver_id,
      v_visit.entry_timestamp,
      v_total_minutes,
      v_detention_minutes,
      COALESCE(v_visit.detention_threshold_minutes, 120),
      COALESCE(v_visit.detention_hourly_rate, 50.00),
      v_total_fee,
      'active',
      true
    )
    RETURNING id INTO v_detention_id;
    
    RETURN v_detention_id;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to finalize detention when driver exits zone
CREATE OR REPLACE FUNCTION finalize_detention_on_exit(
  p_zone_visit_id UUID
)
RETURNS UUID AS $$
DECLARE
  v_detention RECORD;
  v_exit_visit RECORD;
  v_final_minutes INTEGER;
  v_detention_minutes INTEGER;
  v_total_fee DECIMAL(10, 2);
BEGIN
  -- Get exit visit
  SELECT * INTO v_exit_visit
  FROM public.zone_visits
  WHERE id = p_zone_visit_id
    AND event_type = 'exit';
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Exit visit not found';
  END IF;
  
  -- Find active detention for this entry
  SELECT * INTO v_detention
  FROM public.detention_tracking
  WHERE zone_visit_id = (
    SELECT id 
    FROM public.zone_visits 
    WHERE geofence_id = v_exit_visit.geofence_id
      AND truck_id = v_exit_visit.truck_id
      AND event_type = 'entry'
      AND entry_timestamp = v_exit_visit.entry_timestamp
    LIMIT 1
  )
  AND status = 'active';
  
  IF NOT FOUND THEN
    -- No active detention, nothing to finalize
    RETURN NULL;
  END IF;
  
  -- Calculate final detention
  v_final_minutes := COALESCE(v_exit_visit.duration_minutes, 0);
  v_detention_minutes := GREATEST(0, v_final_minutes - v_detention.detention_threshold_minutes);
  v_total_fee := CEIL(v_detention_minutes / 60.0) * v_detention.hourly_rate;
  
  -- Update detention record
  UPDATE public.detention_tracking
  SET 
    exit_timestamp = v_exit_visit.timestamp,
    total_minutes = v_final_minutes,
    detention_minutes = v_detention_minutes,
    total_fee = v_total_fee,
    status = 'completed',
    updated_at = NOW()
  WHERE id = v_detention.id;
  
  RETURN v_detention.id;
END;
$$ LANGUAGE plpgsql;

-- Function to auto-add detention fees to invoice
CREATE OR REPLACE FUNCTION add_detention_to_invoice(
  p_detention_id UUID,
  p_invoice_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  v_detention RECORD;
  v_invoice RECORD;
  v_current_items JSONB;
  v_new_item JSONB;
  v_geofence_name TEXT;
BEGIN
  -- Get detention details
  SELECT * INTO v_detention
  FROM public.detention_tracking
  WHERE id = p_detention_id
    AND status = 'completed';
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Detention record not found or not completed';
  END IF;
  
  -- Get invoice
  SELECT * INTO v_invoice
  FROM public.invoices
  WHERE id = p_invoice_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice not found';
  END IF;
  
  -- Get geofence name
  SELECT name INTO v_geofence_name
  FROM public.geofences
  WHERE id = v_detention.geofence_id;
  
  -- Create detention line item
  v_new_item := jsonb_build_object(
    'description', format('Detention Fee - %s (%s minutes beyond %s min threshold)', 
      v_geofence_name, 
      v_detention.detention_minutes,
      v_detention.detention_threshold_minutes),
    'quantity', 1,
    'unit_price', v_detention.total_fee,
    'amount', v_detention.total_fee,
    'type', 'detention',
    'detention_id', p_detention_id
  );
  
  -- Add to invoice items
  v_current_items := COALESCE(v_invoice.items, '[]'::jsonb);
  v_current_items := v_current_items || jsonb_build_array(v_new_item);
  
  -- Update invoice
  UPDATE public.invoices
  SET 
    items = v_current_items,
    amount = amount + v_detention.total_fee,
    updated_at = NOW()
  WHERE id = p_invoice_id;
  
  -- Mark detention as billed
  UPDATE public.detention_tracking
  SET 
    invoice_id = p_invoice_id,
    status = 'billed',
    updated_at = NOW()
  WHERE id = p_detention_id;
  
  RETURN true;
END;
$$ LANGUAGE plpgsql;

-- Enable RLS
ALTER TABLE public.detention_tracking ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view detention records from their company"
  ON public.detention_tracking
  FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert detention records for their company"
  ON public.detention_tracking
  FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update detention records from their company"
  ON public.detention_tracking
  FOR UPDATE
  USING (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

-- Add comments
COMMENT ON TABLE public.detention_tracking IS 
  'Tracks detention time when drivers exceed free time threshold in zones';
COMMENT ON FUNCTION calculate_active_detention IS 
  'Returns all active zone visits that have exceeded detention threshold';
COMMENT ON FUNCTION create_detention_record IS 
  'Creates or updates a detention record when threshold is exceeded';
COMMENT ON FUNCTION finalize_detention_on_exit IS 
  'Finalizes detention record when driver exits zone';
COMMENT ON FUNCTION add_detention_to_invoice IS 
  'Automatically adds detention fee as line item to invoice';

