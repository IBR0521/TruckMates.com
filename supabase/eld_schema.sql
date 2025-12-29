-- ELD (Electronic Logging Device) Schema
-- This schema supports ELD device management and data collection

-- ELD Devices table - stores information about ELD devices installed in trucks
CREATE TABLE IF NOT EXISTS public.eld_devices (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  truck_id UUID REFERENCES public.trucks(id) ON DELETE SET NULL,
  device_name TEXT NOT NULL,
  device_serial_number TEXT UNIQUE NOT NULL,
  provider TEXT NOT NULL, -- 'keeptruckin', 'samsara', 'geotab', 'rand_mcnally', 'other'
  provider_device_id TEXT, -- Device ID from ELD provider
  api_key TEXT, -- Encrypted API key for provider integration
  api_secret TEXT, -- Encrypted API secret for provider integration
  status TEXT DEFAULT 'active', -- 'active', 'inactive', 'maintenance', 'disconnected'
  last_sync_at TIMESTAMP WITH TIME ZONE,
  firmware_version TEXT,
  installation_date DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- ELD Logs table - stores HOS (Hours of Service) data from ELD devices
CREATE TABLE IF NOT EXISTS public.eld_logs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  eld_device_id UUID REFERENCES public.eld_devices(id) ON DELETE CASCADE NOT NULL,
  driver_id UUID REFERENCES public.drivers(id) ON DELETE SET NULL,
  truck_id UUID REFERENCES public.trucks(id) ON DELETE SET NULL,
  log_date DATE NOT NULL,
  log_type TEXT NOT NULL, -- 'driving', 'on_duty', 'off_duty', 'sleeper_berth'
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE,
  duration_minutes INTEGER, -- Duration in minutes
  location_start JSONB, -- { lat: number, lng: number, address: string }
  location_end JSONB, -- { lat: number, lng: number, address: string }
  odometer_start INTEGER,
  odometer_end INTEGER,
  miles_driven DECIMAL(10, 2),
  engine_hours DECIMAL(10, 2),
  violations JSONB, -- Array of HOS violations if any
  raw_data JSONB, -- Raw data from ELD provider
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- ELD Locations table - stores GPS location data from ELD devices
CREATE TABLE IF NOT EXISTS public.eld_locations (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  eld_device_id UUID REFERENCES public.eld_devices(id) ON DELETE CASCADE NOT NULL,
  driver_id UUID REFERENCES public.drivers(id) ON DELETE SET NULL,
  truck_id UUID REFERENCES public.trucks(id) ON DELETE SET NULL,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  address TEXT,
  speed INTEGER, -- Speed in MPH
  heading INTEGER, -- Heading in degrees (0-360)
  odometer INTEGER,
  engine_status TEXT, -- 'on', 'off', 'idle'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- ELD Events table - stores events and alerts from ELD devices
CREATE TABLE IF NOT EXISTS public.eld_events (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  eld_device_id UUID REFERENCES public.eld_devices(id) ON DELETE CASCADE NOT NULL,
  driver_id UUID REFERENCES public.drivers(id) ON DELETE SET NULL,
  truck_id UUID REFERENCES public.trucks(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL, -- 'hos_violation', 'speeding', 'hard_brake', 'hard_accel', 'device_malfunction', 'other'
  severity TEXT DEFAULT 'info', -- 'info', 'warning', 'critical'
  title TEXT NOT NULL,
  description TEXT,
  event_time TIMESTAMP WITH TIME ZONE NOT NULL,
  location JSONB, -- { lat: number, lng: number, address: string }
  resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolved_by UUID REFERENCES public.users(id),
  metadata JSONB, -- Additional event data
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_eld_devices_company_id ON public.eld_devices(company_id);
CREATE INDEX IF NOT EXISTS idx_eld_devices_truck_id ON public.eld_devices(truck_id);
CREATE INDEX IF NOT EXISTS idx_eld_devices_status ON public.eld_devices(status);

CREATE INDEX IF NOT EXISTS idx_eld_logs_company_id ON public.eld_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_eld_logs_device_id ON public.eld_logs(eld_device_id);
CREATE INDEX IF NOT EXISTS idx_eld_logs_driver_id ON public.eld_logs(driver_id);
CREATE INDEX IF NOT EXISTS idx_eld_logs_truck_id ON public.eld_logs(truck_id);
CREATE INDEX IF NOT EXISTS idx_eld_logs_log_date ON public.eld_logs(log_date);
CREATE INDEX IF NOT EXISTS idx_eld_logs_log_type ON public.eld_logs(log_type);

CREATE INDEX IF NOT EXISTS idx_eld_locations_company_id ON public.eld_locations(company_id);
CREATE INDEX IF NOT EXISTS idx_eld_locations_device_id ON public.eld_locations(eld_device_id);
CREATE INDEX IF NOT EXISTS idx_eld_locations_driver_id ON public.eld_locations(driver_id);
CREATE INDEX IF NOT EXISTS idx_eld_locations_truck_id ON public.eld_locations(truck_id);
CREATE INDEX IF NOT EXISTS idx_eld_locations_timestamp ON public.eld_locations(timestamp);

CREATE INDEX IF NOT EXISTS idx_eld_events_company_id ON public.eld_events(company_id);
CREATE INDEX IF NOT EXISTS idx_eld_events_device_id ON public.eld_events(eld_device_id);
CREATE INDEX IF NOT EXISTS idx_eld_events_driver_id ON public.eld_events(driver_id);
CREATE INDEX IF NOT EXISTS idx_eld_events_event_type ON public.eld_events(event_type);
CREATE INDEX IF NOT EXISTS idx_eld_events_resolved ON public.eld_events(resolved);
CREATE INDEX IF NOT EXISTS idx_eld_events_event_time ON public.eld_events(event_time);

-- Enable Row Level Security (RLS)
ALTER TABLE public.eld_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eld_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eld_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.eld_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies for eld_devices
CREATE POLICY "Users can view ELD devices in their company"
  ON public.eld_devices FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Managers can insert ELD devices"
  ON public.eld_devices FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid() AND role = 'manager'
    )
  );

CREATE POLICY "Managers can update ELD devices"
  ON public.eld_devices FOR UPDATE
  USING (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid() AND role = 'manager'
    )
  );

CREATE POLICY "Managers can delete ELD devices"
  ON public.eld_devices FOR DELETE
  USING (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid() AND role = 'manager'
    )
  );

-- RLS Policies for eld_logs
CREATE POLICY "Users can view ELD logs in their company"
  ON public.eld_logs FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

CREATE POLICY "System can insert ELD logs"
  ON public.eld_logs FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

-- RLS Policies for eld_locations
CREATE POLICY "Users can view ELD locations in their company"
  ON public.eld_locations FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

CREATE POLICY "System can insert ELD locations"
  ON public.eld_locations FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

-- RLS Policies for eld_events
CREATE POLICY "Users can view ELD events in their company"
  ON public.eld_events FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

CREATE POLICY "System can insert ELD events"
  ON public.eld_events FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Managers can update ELD events"
  ON public.eld_events FOR UPDATE
  USING (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid() AND role = 'manager'
    )
  );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_eld_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc'::text, NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE TRIGGER update_eld_devices_updated_at BEFORE UPDATE ON public.eld_devices
  FOR EACH ROW EXECUTE FUNCTION update_eld_updated_at_column();

CREATE TRIGGER update_eld_logs_updated_at BEFORE UPDATE ON public.eld_logs
  FOR EACH ROW EXECUTE FUNCTION update_eld_updated_at_column();
