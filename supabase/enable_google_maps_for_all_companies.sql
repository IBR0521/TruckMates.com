-- ============================================================================
-- Enable Google Maps Integration for All Companies
-- ============================================================================
-- This script enables Google Maps integration for all existing companies
-- Since Google Maps uses a platform-wide API key, all companies should have access
-- ============================================================================

-- Enable Google Maps for all companies that have integration records
UPDATE public.company_integrations
SET google_maps_enabled = true
WHERE google_maps_enabled = false OR google_maps_enabled IS NULL;

-- Create integration records for companies that don't have one yet
INSERT INTO public.company_integrations (company_id, google_maps_enabled)
SELECT id, true
FROM public.companies
WHERE id NOT IN (SELECT company_id FROM public.company_integrations)
ON CONFLICT (company_id) DO UPDATE
SET google_maps_enabled = true;

-- Verify the update
SELECT 
  c.name as company_name,
  ci.google_maps_enabled,
  ci.updated_at
FROM public.companies c
LEFT JOIN public.company_integrations ci ON c.id = ci.company_id
ORDER BY c.name;


