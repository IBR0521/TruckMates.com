-- LTL architecture foundation:
-- shipments (parent entity), truck_movements (consolidation run), and mapping table.

CREATE TABLE IF NOT EXISTS public.shipments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  shipment_number TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  shipper_name TEXT,
  shipper_address TEXT,
  consignee_name TEXT,
  consignee_address TEXT,
  planned_pickup_date DATE,
  planned_delivery_date DATE,
  total_weight_lbs NUMERIC(12,2) DEFAULT 0,
  total_cube_ft NUMERIC(12,2) DEFAULT 0,
  total_pieces INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_shipments_company_number
  ON public.shipments(company_id, shipment_number);
CREATE INDEX IF NOT EXISTS idx_shipments_company_status
  ON public.shipments(company_id, status);

CREATE TABLE IF NOT EXISTS public.truck_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  movement_number TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'planned',
  truck_id UUID REFERENCES public.trucks(id) ON DELETE SET NULL,
  trailer_id UUID REFERENCES public.trailers(id) ON DELETE SET NULL,
  driver_id UUID REFERENCES public.drivers(id) ON DELETE SET NULL,
  terminal_id UUID REFERENCES public.terminals(id) ON DELETE SET NULL,
  movement_date DATE,
  max_weight_lbs NUMERIC(12,2) NOT NULL DEFAULT 45000,
  max_cube_ft NUMERIC(12,2) NOT NULL DEFAULT 3800,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_truck_movements_company_number
  ON public.truck_movements(company_id, movement_number);

CREATE TABLE IF NOT EXISTS public.movement_shipments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  movement_id UUID NOT NULL REFERENCES public.truck_movements(id) ON DELETE CASCADE,
  shipment_id UUID NOT NULL REFERENCES public.shipments(id) ON DELETE CASCADE,
  sequence_no INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (movement_id, shipment_id)
);

CREATE INDEX IF NOT EXISTS idx_movement_shipments_company
  ON public.movement_shipments(company_id, movement_id);

ALTER TABLE public.loads
  ADD COLUMN IF NOT EXISTS shipment_id UUID REFERENCES public.shipments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS nmfc_code TEXT,
  ADD COLUMN IF NOT EXISTS freight_class TEXT,
  ADD COLUMN IF NOT EXISTS piece_count INTEGER,
  ADD COLUMN IF NOT EXISTS cube_ft NUMERIC(12,2);

CREATE INDEX IF NOT EXISTS idx_loads_company_shipment_id
  ON public.loads(company_id, shipment_id);

ALTER TABLE public.loads
  ADD CONSTRAINT loads_piece_count_nonnegative
  CHECK (piece_count IS NULL OR piece_count >= 0);

ALTER TABLE public.loads
  ADD CONSTRAINT loads_cube_ft_nonnegative
  CHECK (cube_ft IS NULL OR cube_ft >= 0);

ALTER TABLE public.shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.truck_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movement_shipments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS shipments_company_isolation ON public.shipments;
CREATE POLICY shipments_company_isolation ON public.shipments
  USING (company_id = auth.uid()::uuid OR company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid()))
  WITH CHECK (company_id = auth.uid()::uuid OR company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid()));

DROP POLICY IF EXISTS truck_movements_company_isolation ON public.truck_movements;
CREATE POLICY truck_movements_company_isolation ON public.truck_movements
  USING (company_id = auth.uid()::uuid OR company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid()))
  WITH CHECK (company_id = auth.uid()::uuid OR company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid()));

DROP POLICY IF EXISTS movement_shipments_company_isolation ON public.movement_shipments;
CREATE POLICY movement_shipments_company_isolation ON public.movement_shipments
  USING (company_id = auth.uid()::uuid OR company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid()))
  WITH CHECK (company_id = auth.uid()::uuid OR company_id IN (SELECT company_id FROM public.users WHERE id = auth.uid()));
