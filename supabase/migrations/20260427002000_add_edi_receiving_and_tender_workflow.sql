-- EDI Receiving + Tender workflow (204 inbound, 990/214 outbound artifacts)

CREATE TABLE IF NOT EXISTS public.edi_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  transaction_set TEXT NOT NULL,
  control_number TEXT,
  raw_payload TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'received',
  processed_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_edi_messages_company_created
  ON public.edi_messages(company_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.edi_load_tenders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  edi_message_id UUID REFERENCES public.edi_messages(id) ON DELETE SET NULL,
  tender_number TEXT,
  shipment_reference TEXT,
  status TEXT NOT NULL DEFAULT 'received',
  shipper_name TEXT,
  shipper_address TEXT,
  shipper_city TEXT,
  shipper_state TEXT,
  shipper_zip TEXT,
  consignee_name TEXT,
  consignee_address TEXT,
  consignee_city TEXT,
  consignee_state TEXT,
  consignee_zip TEXT,
  pickup_date DATE,
  delivery_date DATE,
  weight_lbs NUMERIC(12,2),
  load_id UUID REFERENCES public.loads(id) ON DELETE SET NULL,
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_edi_tenders_company_status
  ON public.edi_load_tenders(company_id, status, created_at DESC);
