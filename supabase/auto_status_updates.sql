-- ============================================================================
-- Automated Load Status Updates via Geofences
-- Auto-update load status when driver enters/exits geofences
-- ============================================================================

-- Add status mapping fields to geofences table
ALTER TABLE public.geofences
  ADD COLUMN IF NOT EXISTS auto_update_load_status BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS entry_load_status TEXT, -- Status to set when entering (e.g., 'arrived_at_shipper')
  ADD COLUMN IF NOT EXISTS exit_load_status TEXT; -- Status to set when exiting (e.g., 'en_route')

-- Create load status change history table
CREATE TABLE IF NOT EXISTS public.load_status_history (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  load_id UUID REFERENCES public.loads(id) ON DELETE CASCADE NOT NULL,
  old_status TEXT,
  new_status TEXT NOT NULL,
  change_reason TEXT, -- 'geofence_entry', 'geofence_exit', 'manual', 'auto'
  geofence_id UUID REFERENCES public.geofences(id) ON DELETE SET NULL,
  zone_visit_id UUID REFERENCES public.zone_visits(id) ON DELETE SET NULL,
  changed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  metadata JSONB, -- Additional context
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_load_status_history_load_id ON public.load_status_history(load_id);
CREATE INDEX IF NOT EXISTS idx_load_status_history_company_id ON public.load_status_history(company_id);
CREATE INDEX IF NOT EXISTS idx_load_status_history_created_at ON public.load_status_history(created_at);

-- Function to auto-update load status based on geofence entry/exit
CREATE OR REPLACE FUNCTION auto_update_load_status_from_geofence(
  p_zone_visit_id UUID,
  p_event_type TEXT -- 'entry' or 'exit'
)
RETURNS UUID AS $$
DECLARE
  v_visit RECORD;
  v_geofence RECORD;
  v_load RECORD;
  v_new_status TEXT;
  v_old_status TEXT;
  v_status_history_id UUID;
BEGIN
  -- Get zone visit details
  SELECT 
    zv.*,
    g.auto_update_load_status,
    g.entry_load_status,
    g.exit_load_status,
    g.name as geofence_name
  INTO v_visit
  FROM public.zone_visits zv
  INNER JOIN public.geofences g ON g.id = zv.geofence_id
  WHERE zv.id = p_zone_visit_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Zone visit not found';
  END IF;
  
  -- Check if auto-update is enabled
  IF NOT v_visit.auto_update_load_status THEN
    RETURN NULL;
  END IF;
  
  -- Determine new status based on event type
  IF p_event_type = 'entry' THEN
    v_new_status := v_visit.entry_load_status;
  ELSIF p_event_type = 'exit' THEN
    v_new_status := v_visit.exit_load_status;
  ELSE
    RETURN NULL;
  END IF;
  
  -- If no status mapping, skip
  IF v_new_status IS NULL THEN
    RETURN NULL;
  END IF;
  
  -- Find active load for this truck
  SELECT * INTO v_load
  FROM public.loads
  WHERE truck_id = v_visit.truck_id
    AND status IN ('scheduled', 'in_progress', 'in_transit', 'arrived_at_shipper', 'arrived_at_delivery')
  ORDER BY created_at DESC
  LIMIT 1;
  
  IF NOT FOUND THEN
    -- No active load found, skip
    RETURN NULL;
  END IF;
  
  -- Get current status
  v_old_status := v_load.status;
  
  -- Skip if status is already set
  IF v_old_status = v_new_status THEN
    RETURN NULL;
  END IF;
  
  -- Update load status
  UPDATE public.loads
  SET 
    status = v_new_status,
    updated_at = NOW()
  WHERE id = v_load.id;
  
  -- Create status history record
  INSERT INTO public.load_status_history (
    company_id,
    load_id,
    old_status,
    new_status,
    change_reason,
    geofence_id,
    zone_visit_id,
    metadata
  ) VALUES (
    v_visit.company_id,
    v_load.id,
    v_old_status,
    v_new_status,
    'geofence_' || p_event_type,
    v_visit.geofence_id,
    p_zone_visit_id,
    jsonb_build_object(
      'geofence_name', v_visit.geofence_name,
      'truck_id', v_visit.truck_id,
      'driver_id', v_visit.driver_id,
      'event_type', p_event_type
    )
  )
  RETURNING id INTO v_status_history_id;
  
  RETURN v_status_history_id;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update load status when zone visit is created
CREATE OR REPLACE FUNCTION trigger_auto_update_load_status()
RETURNS TRIGGER AS $$
BEGIN
  -- Only process entry/exit events
  IF NEW.event_type IN ('entry', 'exit') THEN
    -- Call auto-update function (non-blocking)
    PERFORM auto_update_load_status_from_geofence(NEW.id, NEW.event_type);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER zone_visit_auto_status_trigger
  AFTER INSERT
  ON public.zone_visits
  FOR EACH ROW
  EXECUTE FUNCTION trigger_auto_update_load_status();

-- Enable RLS
ALTER TABLE public.load_status_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view load status history from their company"
  ON public.load_status_history
  FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

CREATE POLICY "System can insert load status history"
  ON public.load_status_history
  FOR INSERT
  WITH CHECK (true); -- Allow system to insert

-- Add comments
COMMENT ON COLUMN public.geofences.auto_update_load_status IS 
  'Enable automatic load status updates when driver enters/exits this geofence';
COMMENT ON COLUMN public.geofences.entry_load_status IS 
  'Load status to set when driver enters geofence (e.g., "arrived_at_shipper")';
COMMENT ON COLUMN public.geofences.exit_load_status IS 
  'Load status to set when driver exits geofence (e.g., "en_route")';
COMMENT ON FUNCTION auto_update_load_status_from_geofence IS 
  'Automatically update load status based on geofence entry/exit events';

