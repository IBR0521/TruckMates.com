-- Trailer management: base trailers table + cross-module trailer links

CREATE TABLE IF NOT EXISTS public.trailers (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,

  trailer_number TEXT NOT NULL,
  vin TEXT NOT NULL,
  plate_number TEXT,
  plate_state TEXT,
  year INTEGER,
  make TEXT,
  model TEXT,

  trailer_type TEXT NOT NULL DEFAULT 'dry_van' CHECK (
    trailer_type IN (
      'dry_van',
      'reefer',
      'flatbed',
      'step_deck',
      'lowboy',
      'tanker',
      'conestoga',
      'auto_hauler',
      'other'
    )
  ),
  length_ft INTEGER,
  capacity_lbs INTEGER,
  door_type TEXT CHECK (door_type IN ('swing', 'roll', 'curtain')),

  status TEXT NOT NULL DEFAULT 'available' CHECK (
    status IN ('available', 'in_use', 'maintenance', 'out_of_service', 'retired')
  ),
  current_truck_id UUID REFERENCES public.trucks(id) ON DELETE SET NULL,
  current_location TEXT,

  last_dot_inspection_date DATE,
  next_dot_inspection_date DATE,
  last_brake_inspection_date DATE,
  reefer_unit_hours INTEGER,
  last_reefer_service_date DATE,
  registration_expiry DATE,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE(company_id, trailer_number),
  UNIQUE(company_id, vin)
);

CREATE INDEX IF NOT EXISTS idx_trailers_company_id ON public.trailers(company_id);
CREATE INDEX IF NOT EXISTS idx_trailers_status ON public.trailers(status);
CREATE INDEX IF NOT EXISTS idx_trailers_current_truck_id ON public.trailers(current_truck_id);
CREATE INDEX IF NOT EXISTS idx_trailers_registration_expiry ON public.trailers(registration_expiry);
CREATE INDEX IF NOT EXISTS idx_trailers_next_dot_inspection_date ON public.trailers(next_dot_inspection_date);

ALTER TABLE public.trailers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view trailers in their company" ON public.trailers;
CREATE POLICY "Users can view trailers in their company"
  ON public.trailers FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert trailers in their company" ON public.trailers;
CREATE POLICY "Users can insert trailers in their company"
  ON public.trailers FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update trailers in their company" ON public.trailers;
CREATE POLICY "Users can update trailers in their company"
  ON public.trailers FOR UPDATE
  USING (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete trailers in their company" ON public.trailers;
CREATE POLICY "Users can delete trailers in their company"
  ON public.trailers FOR DELETE
  USING (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

DROP TRIGGER IF EXISTS update_trailers_updated_at ON public.trailers;
CREATE TRIGGER update_trailers_updated_at
  BEFORE UPDATE ON public.trailers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.loads
  ADD COLUMN IF NOT EXISTS trailer_id UUID REFERENCES public.trailers(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_loads_trailer_id ON public.loads(trailer_id) WHERE trailer_id IS NOT NULL;

ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS trailer_id UUID REFERENCES public.trailers(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_documents_trailer_id ON public.documents(trailer_id) WHERE trailer_id IS NOT NULL;

ALTER TABLE public.maintenance
  ALTER COLUMN truck_id DROP NOT NULL;
ALTER TABLE public.maintenance
  ADD COLUMN IF NOT EXISTS trailer_id UUID REFERENCES public.trailers(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_maintenance_trailer_id ON public.maintenance(trailer_id) WHERE trailer_id IS NOT NULL;
ALTER TABLE public.maintenance
  DROP CONSTRAINT IF EXISTS maintenance_exactly_one_asset_chk;
ALTER TABLE public.maintenance
  ADD CONSTRAINT maintenance_exactly_one_asset_chk
  CHECK ((truck_id IS NOT NULL) <> (trailer_id IS NOT NULL));

ALTER TABLE public.work_orders
  ALTER COLUMN truck_id DROP NOT NULL;
ALTER TABLE public.work_orders
  ADD COLUMN IF NOT EXISTS trailer_id UUID REFERENCES public.trailers(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_work_orders_trailer_id ON public.work_orders(trailer_id) WHERE trailer_id IS NOT NULL;
ALTER TABLE public.work_orders
  DROP CONSTRAINT IF EXISTS work_orders_exactly_one_asset_chk;
ALTER TABLE public.work_orders
  ADD CONSTRAINT work_orders_exactly_one_asset_chk
  CHECK ((truck_id IS NOT NULL) <> (trailer_id IS NOT NULL));

ALTER TABLE public.maintenance_documents
  ALTER COLUMN truck_id DROP NOT NULL;
ALTER TABLE public.maintenance_documents
  ADD COLUMN IF NOT EXISTS trailer_id UUID REFERENCES public.trailers(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_maintenance_documents_trailer_id ON public.maintenance_documents(trailer_id) WHERE trailer_id IS NOT NULL;
ALTER TABLE public.maintenance_documents
  DROP CONSTRAINT IF EXISTS maintenance_documents_exactly_one_asset_chk;
ALTER TABLE public.maintenance_documents
  ADD CONSTRAINT maintenance_documents_exactly_one_asset_chk
  CHECK ((truck_id IS NOT NULL) <> (trailer_id IS NOT NULL));

CREATE OR REPLACE FUNCTION create_work_order_from_maintenance(
  p_maintenance_id UUID
)
RETURNS UUID AS $$
DECLARE
  v_maintenance RECORD;
  v_work_order_id UUID;
  v_work_order_number TEXT;
BEGIN
  SELECT * INTO v_maintenance
  FROM public.maintenance
  WHERE id = p_maintenance_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Maintenance record not found: %', p_maintenance_id;
  END IF;

  SELECT id INTO v_work_order_id
  FROM public.work_orders
  WHERE maintenance_id = p_maintenance_id
  LIMIT 1;

  IF v_work_order_id IS NOT NULL THEN
    RETURN v_work_order_id;
  END IF;

  v_work_order_number := generate_work_order_number();

  INSERT INTO public.work_orders (
    company_id,
    maintenance_id,
    truck_id,
    trailer_id,
    work_order_number,
    title,
    description,
    priority,
    estimated_total_cost,
    status
  ) VALUES (
    v_maintenance.company_id,
    v_maintenance.id,
    v_maintenance.truck_id,
    v_maintenance.trailer_id,
    v_work_order_number,
    v_maintenance.service_type,
    v_maintenance.notes,
    v_maintenance.priority,
    v_maintenance.estimated_cost,
    'pending'
  )
  RETURNING id INTO v_work_order_id;

  RETURN v_work_order_id;
END;
$$ LANGUAGE plpgsql;
