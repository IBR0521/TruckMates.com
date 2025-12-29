-- ELD Mobile App RLS Policies Update
-- This migration adds policies to allow mobile app to insert ELD data
-- Mobile app users (drivers) need to be able to register devices and insert logs/locations/events

-- Update policy for eld_devices to allow mobile app registration
-- Drivers should be able to register their own mobile device
-- First, drop the existing insert policy if it exists
DROP POLICY IF EXISTS "Managers can insert ELD devices" ON public.eld_devices;

-- Create policy that allows users to insert mobile app devices
CREATE POLICY "Users can insert ELD devices for mobile app"
  ON public.eld_devices FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
    AND provider = 'truckmates_mobile' -- Only allow mobile app registration
  );

-- Create policy that allows managers to insert other provider devices
CREATE POLICY "Managers can insert ELD devices for other providers"
  ON public.eld_devices FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid() AND role = 'manager'
    )
    AND (provider IS NULL OR provider != 'truckmates_mobile') -- Other providers require manager role
  );

-- Update policy to allow users to update their own mobile device
CREATE POLICY "Users can update their own mobile ELD device"
  ON public.eld_devices FOR UPDATE
  USING (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
    AND provider = 'truckmates_mobile'
  );

-- The existing "Managers can update ELD devices" policy will still apply for other providers
-- No need to drop it, both policies can coexist (OR logic)

-- Mobile app users (authenticated drivers) can insert logs for their device
-- The existing "System can insert ELD logs" policy already allows this,
-- but let's make it explicit for mobile app
DROP POLICY IF EXISTS "System can insert ELD logs" ON public.eld_logs;

CREATE POLICY "Users can insert ELD logs"
  ON public.eld_logs FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
    AND eld_device_id IN (
      SELECT id FROM public.eld_devices 
      WHERE company_id IN (
        SELECT company_id FROM public.users WHERE id = auth.uid()
      )
    )
  );

-- Mobile app users can insert locations
DROP POLICY IF EXISTS "System can insert ELD locations" ON public.eld_locations;

CREATE POLICY "Users can insert ELD locations"
  ON public.eld_locations FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
    AND eld_device_id IN (
      SELECT id FROM public.eld_devices 
      WHERE company_id IN (
        SELECT company_id FROM public.users WHERE id = auth.uid()
      )
    )
  );

-- Mobile app users can insert events
DROP POLICY IF EXISTS "System can insert ELD events" ON public.eld_events;

CREATE POLICY "Users can insert ELD events"
  ON public.eld_events FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
    AND eld_device_id IN (
      SELECT id FROM public.eld_devices 
      WHERE company_id IN (
        SELECT company_id FROM public.users WHERE id = auth.uid()
      )
    )
  );

-- Note: The existing SELECT policies allow all users in the company to view data
-- The existing UPDATE policies for managers remain unchanged

