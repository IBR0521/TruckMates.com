-- ProMiles-style planning snapshot on loads (estimates before trip; reconcile with GPS/IFTA later)
ALTER TABLE public.loads
  ADD COLUMN IF NOT EXISTS trip_planning_estimate JSONB;

COMMENT ON COLUMN public.loads.trip_planning_estimate IS
  'Pre-trip estimate: truck route, state miles, EIA fuel, HERE tolls (ProMiles-equivalent).';
