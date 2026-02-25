-- Fix DVIR Audit Function
-- This fixes the "column u.name does not exist" error
-- Run this in Supabase SQL Editor

CREATE OR REPLACE FUNCTION get_dvirs_for_audit(
  p_company_id UUID,
  p_truck_id UUID DEFAULT NULL,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  inspection_type TEXT,
  inspection_date DATE,
  inspection_time TIME,
  driver_name TEXT,
  truck_number TEXT,
  status TEXT,
  defects_found BOOLEAN,
  safe_to_operate BOOLEAN,
  defects JSONB,
  location TEXT,
  mileage INTEGER,
  notes TEXT,
  driver_signature_date TIMESTAMP WITH TIME ZONE,
  certified BOOLEAN,
  certified_by_name TEXT,
  certified_date TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    d.id,
    d.inspection_type,
    d.inspection_date,
    d.inspection_time,
    dr.name AS driver_name,
    t.truck_number,
    d.status,
    d.defects_found,
    d.safe_to_operate,
    d.defects,
    d.location,
    d.mileage,
    d.notes,
    d.driver_signature_date,
    d.certified,
    u.full_name AS certified_by_name,
    d.certified_date
  FROM public.dvir d
  LEFT JOIN public.drivers dr ON dr.id = d.driver_id
  LEFT JOIN public.trucks t ON t.id = d.truck_id
  LEFT JOIN public.users u ON u.id = d.certified_by
  WHERE d.company_id = p_company_id
    AND (p_truck_id IS NULL OR d.truck_id = p_truck_id)
    AND (p_start_date IS NULL OR d.inspection_date >= p_start_date)
    AND (p_end_date IS NULL OR d.inspection_date <= p_end_date)
  ORDER BY d.inspection_date DESC, d.inspection_time DESC;
END;
$$ LANGUAGE plpgsql;



