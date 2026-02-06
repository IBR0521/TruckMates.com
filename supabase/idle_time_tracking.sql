-- ============================================================================
-- Idle Time Tracking
-- Track and report idle time using GPS and engine status data
-- ============================================================================

-- Table to track idle time sessions
CREATE TABLE IF NOT EXISTS public.idle_time_sessions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  truck_id UUID REFERENCES public.trucks(id) ON DELETE CASCADE NOT NULL,
  driver_id UUID REFERENCES public.drivers(id) ON DELETE SET NULL,
  eld_device_id UUID REFERENCES public.eld_devices(id) ON DELETE SET NULL,
  
  -- Session details
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE,
  duration_minutes INTEGER, -- Calculated duration in minutes
  location_latitude DECIMAL(10, 8),
  location_longitude DECIMAL(11, 8),
  location_address TEXT,
  
  -- Idle detection
  idle_type TEXT, -- 'engine_idle', 'stationary', 'excessive_idle'
  engine_status TEXT, -- 'on', 'off', 'idle'
  speed INTEGER DEFAULT 0, -- Speed during idle (should be 0 or very low)
  
  -- Fuel impact (estimated)
  estimated_fuel_gallons DECIMAL(5, 2), -- Estimated fuel consumed during idle
  estimated_fuel_cost DECIMAL(10, 2), -- Estimated cost based on fuel price
  
  -- Context
  load_id UUID REFERENCES public.loads(id) ON DELETE SET NULL,
  route_id UUID REFERENCES public.routes(id) ON DELETE SET NULL,
  geofence_id UUID REFERENCES public.geofences(id) ON DELETE SET NULL,
  
  -- Metadata
  metadata JSONB, -- Additional context (weather, temperature, etc.)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_idle_sessions_truck_id ON public.idle_time_sessions(truck_id);
CREATE INDEX IF NOT EXISTS idx_idle_sessions_driver_id ON public.idle_time_sessions(driver_id);
CREATE INDEX IF NOT EXISTS idx_idle_sessions_company_id ON public.idle_time_sessions(company_id);
CREATE INDEX IF NOT EXISTS idx_idle_sessions_start_time ON public.idle_time_sessions(start_time);
CREATE INDEX IF NOT EXISTS idx_idle_sessions_duration ON public.idle_time_sessions(duration_minutes);

-- Function to detect and record idle time from location data
CREATE OR REPLACE FUNCTION detect_idle_time(
  p_truck_id UUID,
  p_latitude DECIMAL,
  p_longitude DECIMAL,
  p_timestamp TIMESTAMP WITH TIME ZONE,
  p_speed INTEGER DEFAULT 0,
  p_engine_status TEXT DEFAULT 'unknown',
  p_driver_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_company_id UUID;
  v_eld_device_id UUID;
  v_existing_session RECORD;
  v_idle_threshold_minutes INTEGER := 5; -- Consider idle after 5 minutes stationary
  v_session_id UUID;
  v_duration_minutes INTEGER;
BEGIN
  -- Get truck and company info
  SELECT t.company_id, ed.id as eld_device_id
  INTO v_company_id, v_eld_device_id
  FROM public.trucks t
  LEFT JOIN public.eld_devices ed ON ed.truck_id = t.id AND ed.status = 'active'
  WHERE t.id = p_truck_id
  LIMIT 1;
  
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  
  -- Check if truck is stationary (speed <= 5 mph)
  IF p_speed > 5 THEN
    -- Truck is moving, close any open idle sessions
    UPDATE public.idle_time_sessions
    SET 
      end_time = p_timestamp,
      duration_minutes = EXTRACT(EPOCH FROM (p_timestamp - start_time)) / 60,
      updated_at = NOW()
    WHERE truck_id = p_truck_id
      AND end_time IS NULL;
    
    RETURN NULL;
  END IF;
  
  -- Check for existing open idle session
  SELECT * INTO v_existing_session
  FROM public.idle_time_sessions
  WHERE truck_id = p_truck_id
    AND end_time IS NULL
  ORDER BY start_time DESC
  LIMIT 1;
  
  IF v_existing_session IS NOT NULL THEN
    -- Update existing session
    v_duration_minutes := EXTRACT(EPOCH FROM (p_timestamp - v_existing_session.start_time)) / 60;
    
    UPDATE public.idle_time_sessions
    SET 
      duration_minutes = v_duration_minutes,
      location_latitude = p_latitude,
      location_longitude = p_longitude,
      speed = p_speed,
      engine_status = p_engine_status,
      updated_at = NOW()
    WHERE id = v_existing_session.id;
    
    RETURN v_existing_session.id;
  END IF;
  
  -- Check if we should create a new session (truck has been stationary for threshold)
  -- Get last location update
  DECLARE
    v_last_location RECORD;
    v_time_since_stationary INTERVAL;
  BEGIN
    SELECT timestamp, latitude, longitude, speed
    INTO v_last_location
    FROM public.eld_locations
    WHERE truck_id = p_truck_id
      AND timestamp < p_timestamp
    ORDER BY timestamp DESC
    LIMIT 1;
    
    -- If last location was also stationary and within threshold distance
    IF v_last_location IS NOT NULL AND v_last_location.speed <= 5 THEN
      v_time_since_stationary := p_timestamp - v_last_location.timestamp;
      
      -- If stationary for more than threshold, create new session
      IF EXTRACT(EPOCH FROM v_time_since_stationary) / 60 >= v_idle_threshold_minutes THEN
        -- Determine idle type
        DECLARE
          v_idle_type TEXT;
        BEGIN
          IF p_engine_status = 'idle' OR p_engine_status = 'on' THEN
            v_idle_type := 'engine_idle';
          ELSIF p_speed = 0 THEN
            v_idle_type := 'stationary';
          ELSE
            v_idle_type := 'excessive_idle';
          END IF;
        END;
        
        -- Create new idle session
        INSERT INTO public.idle_time_sessions (
          company_id,
          truck_id,
          driver_id,
          eld_device_id,
          start_time,
          location_latitude,
          location_longitude,
          speed,
          engine_status,
          idle_type
        ) VALUES (
          v_company_id,
          p_truck_id,
          p_driver_id,
          v_eld_device_id,
          v_last_location.timestamp, -- Start from when truck first became stationary
          p_latitude,
          p_longitude,
          p_speed,
          p_engine_status,
          v_idle_type
        )
        RETURNING id INTO v_session_id;
        
        RETURN v_session_id;
      END IF;
    END IF;
  END;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate fuel cost for idle sessions
CREATE OR REPLACE FUNCTION calculate_idle_fuel_cost(
  p_session_id UUID,
  p_fuel_price_per_gallon DECIMAL DEFAULT 4.00,
  p_idle_fuel_rate_gph DECIMAL DEFAULT 0.8 -- Gallons per hour when idling
)
RETURNS VOID AS $$
DECLARE
  v_session RECORD;
  v_duration_hours DECIMAL;
  v_fuel_gallons DECIMAL;
  v_fuel_cost DECIMAL;
BEGIN
  SELECT * INTO v_session
  FROM public.idle_time_sessions
  WHERE id = p_session_id;
  
  IF NOT FOUND THEN
    RETURN;
  END IF;
  
  -- Calculate duration in hours
  IF v_session.end_time IS NOT NULL THEN
    v_duration_hours := EXTRACT(EPOCH FROM (v_session.end_time - v_session.start_time)) / 3600;
  ELSIF v_session.duration_minutes IS NOT NULL THEN
    v_duration_hours := v_session.duration_minutes / 60.0;
  ELSE
    v_duration_hours := 0;
  END IF;
  
  -- Calculate fuel consumed
  v_fuel_gallons := v_duration_hours * p_idle_fuel_rate_gph;
  
  -- Calculate cost
  v_fuel_cost := v_fuel_gallons * p_fuel_price_per_gallon;
  
  -- Update session
  UPDATE public.idle_time_sessions
  SET 
    estimated_fuel_gallons = v_fuel_gallons,
    estimated_fuel_cost = v_fuel_cost,
    updated_at = NOW()
  WHERE id = p_session_id;
END;
$$ LANGUAGE plpgsql;

-- Enable RLS
ALTER TABLE public.idle_time_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view idle time sessions from their company"
  ON public.idle_time_sessions
  FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

-- Add comments
COMMENT ON TABLE public.idle_time_sessions IS 
  'Tracks idle time sessions for fuel efficiency monitoring';
COMMENT ON FUNCTION detect_idle_time IS 
  'Detects and records idle time from GPS location data';
COMMENT ON FUNCTION calculate_idle_fuel_cost IS 
  'Calculates estimated fuel cost for idle time sessions';

