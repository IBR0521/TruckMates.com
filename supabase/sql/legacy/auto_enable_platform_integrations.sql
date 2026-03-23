-- ============================================================================
-- Auto-Enable Platform Integrations for New Companies
-- ============================================================================
-- This function automatically enables Google Maps and Email Service for new companies
-- These services use platform-wide API keys from environment variables
-- ============================================================================

-- Function to auto-create company_integrations record with platform services enabled
CREATE OR REPLACE FUNCTION public.auto_enable_platform_integrations(p_company_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert company_integrations record with Google Maps and Email Service enabled
  -- These use platform-wide API keys, so they're enabled by default
  INSERT INTO public.company_integrations (
    company_id,
    google_maps_enabled,
    resend_enabled
  )
  VALUES (
    p_company_id,
    true,  -- Google Maps enabled by default (uses platform API key)
    true   -- Email Service enabled by default (uses platform API key)
  )
  ON CONFLICT (company_id) DO UPDATE
  SET
    google_maps_enabled = COALESCE(company_integrations.google_maps_enabled, true),
    resend_enabled = COALESCE(company_integrations.resend_enabled, true);
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.auto_enable_platform_integrations(UUID) TO authenticated;

-- Trigger to auto-enable integrations when a company is created
CREATE OR REPLACE FUNCTION public.trigger_auto_enable_integrations()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Automatically enable platform integrations for new companies
  PERFORM public.auto_enable_platform_integrations(NEW.id);
  RETURN NEW;
END;
$$;

-- Create trigger
DROP TRIGGER IF EXISTS on_company_created_enable_integrations ON public.companies;
CREATE TRIGGER on_company_created_enable_integrations
  AFTER INSERT ON public.companies
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_auto_enable_integrations();

-- Enable integrations for all existing companies that don't have a record
INSERT INTO public.company_integrations (company_id, google_maps_enabled, resend_enabled)
SELECT id, true, true
FROM public.companies
WHERE id NOT IN (SELECT company_id FROM public.company_integrations)
ON CONFLICT (company_id) DO UPDATE
SET
  google_maps_enabled = COALESCE(company_integrations.google_maps_enabled, true),
  resend_enabled = COALESCE(company_integrations.resend_enabled, true);

