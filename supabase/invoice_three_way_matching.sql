-- ============================================================================
-- Invoice Three-Way Matching Schema
-- ============================================================================
-- Automatically verifies invoices against load data and BOLs
-- Flags exceptions for manual review
-- ============================================================================

-- Step 1: Add matching status and verification columns to invoices table
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS matching_status TEXT DEFAULT 'pending', -- 'pending', 'verified', 'exception', 'manual_review'
  ADD COLUMN IF NOT EXISTS verification_details JSONB DEFAULT '{}'::JSONB,
  -- Stores: { load_match: boolean, bol_match: boolean, amount_match: boolean, customer_match: boolean, exceptions: [] }
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS verified_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS exception_reason TEXT,
  ADD COLUMN IF NOT EXISTS requires_manual_review BOOLEAN DEFAULT false;

-- Step 2: Create invoice_verifications table for audit trail
CREATE TABLE IF NOT EXISTS public.invoice_verifications (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  invoice_id UUID REFERENCES public.invoices(id) ON DELETE CASCADE NOT NULL,
  load_id UUID REFERENCES public.loads(id) ON DELETE SET NULL,
  bol_id UUID REFERENCES public.bols(id) ON DELETE SET NULL,
  
  -- Verification results
  load_match BOOLEAN DEFAULT false,
  bol_match BOOLEAN DEFAULT false,
  amount_match BOOLEAN DEFAULT false,
  customer_match BOOLEAN DEFAULT false,
  
  -- Detailed comparison
  load_amount DECIMAL(10, 2),
  invoice_amount DECIMAL(10, 2),
  amount_difference DECIMAL(10, 2),
  amount_tolerance_percent DECIMAL(5, 2) DEFAULT 1.00, -- 1% tolerance
  
  load_customer_name TEXT,
  invoice_customer_name TEXT,
  
  -- Exceptions
  exceptions JSONB DEFAULT '[]'::JSONB,
  -- Array of: { type: string, severity: 'warning' | 'error', message: string }
  
  -- Verification status
  verification_status TEXT DEFAULT 'pending', -- 'pending', 'verified', 'exception', 'manual_review'
  verified_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  verified_at TIMESTAMP WITH TIME ZONE,
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  
  UNIQUE(invoice_id)
);

-- Step 3: Create indexes
CREATE INDEX IF NOT EXISTS idx_invoice_verifications_company_id ON public.invoice_verifications(company_id);
CREATE INDEX IF NOT EXISTS idx_invoice_verifications_invoice_id ON public.invoice_verifications(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_verifications_load_id ON public.invoice_verifications(load_id);
CREATE INDEX IF NOT EXISTS idx_invoice_verifications_status ON public.invoice_verifications(verification_status);
CREATE INDEX IF NOT EXISTS idx_invoices_matching_status ON public.invoices(matching_status);
CREATE INDEX IF NOT EXISTS idx_invoices_requires_manual_review ON public.invoices(requires_manual_review) WHERE requires_manual_review = true;

-- Step 4: Create function to perform three-way matching
-- Drop function first to ensure clean replacement
DROP FUNCTION IF EXISTS verify_invoice_three_way_match(UUID);

CREATE OR REPLACE FUNCTION verify_invoice_three_way_match(
  p_invoice_id UUID
)
RETURNS TABLE (
  verification_id UUID,
  load_match BOOLEAN,
  bol_match BOOLEAN,
  amount_match BOOLEAN,
  customer_match BOOLEAN,
  verification_status TEXT,
  exceptions JSONB
) AS $$
DECLARE
  v_invoice RECORD;
  v_load RECORD;
  v_bol RECORD;
  v_load_match BOOLEAN := false;
  v_bol_match BOOLEAN := false;
  v_amount_match BOOLEAN := false;
  v_customer_match BOOLEAN := false;
  v_exceptions JSONB := '[]'::JSONB;
  v_verification_status TEXT := 'pending';
  v_amount_difference DECIMAL(10, 2);
  v_amount_tolerance DECIMAL(5, 2) := 1.00; -- 1% tolerance
  v_verification_id UUID;
  v_load_amount DECIMAL(10, 2);
BEGIN
  -- Get invoice details
  SELECT * INTO v_invoice
  FROM public.invoices
  WHERE id = p_invoice_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice not found: %', p_invoice_id;
  END IF;
  
  -- Get load details if load_id exists
  IF v_invoice.load_id IS NOT NULL THEN
    -- Get load - select only columns that definitely exist
    SELECT 
      id,
      company_id,
      value,
      company_name
    INTO v_load
    FROM public.loads
    WHERE id = v_invoice.load_id;
    
    IF FOUND THEN
      v_load_match := true;
      
      -- Get load amount - try to get estimated_revenue or total_rate if columns exist, otherwise use value
      -- Check if estimated_revenue column exists
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'loads' AND column_name = 'estimated_revenue') THEN
        SELECT estimated_revenue INTO v_load_amount FROM public.loads WHERE id = v_invoice.load_id;
      END IF;
      
      -- If still null, try total_rate
      IF v_load_amount IS NULL AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'loads' AND column_name = 'total_rate') THEN
        SELECT total_rate INTO v_load_amount FROM public.loads WHERE id = v_invoice.load_id;
      END IF;
      
      -- Fall back to value field which always exists
      IF v_load_amount IS NULL THEN
        v_load_amount := COALESCE(v_load.value, 0);
      END IF;
      
      -- Check amount match (with tolerance)
      IF v_load_amount > 0 THEN
        v_amount_difference := ABS(v_invoice.amount - v_load_amount);
        -- Calculate tolerance as percentage of load amount (1% default)
        -- Use a temporary variable for tolerance calculation
        IF v_amount_difference <= (v_load_amount * (v_amount_tolerance / 100)) THEN
          v_amount_match := true;
        ELSE
          v_exceptions := v_exceptions || jsonb_build_object(
            'type', 'amount_mismatch',
            'severity', 'error',
            'message', format('Invoice amount ($%s) differs from load value ($%s) by $%s', 
              v_invoice.amount, v_load_amount, v_amount_difference)
          );
        END IF;
      ELSE
        v_exceptions := v_exceptions || jsonb_build_object(
          'type', 'load_no_value',
          'severity', 'warning',
          'message', 'Load has no value/revenue - cannot verify amount'
        );
      END IF;
      
      -- Check customer match
      IF v_load.company_name IS NOT NULL AND v_invoice.customer_name IS NOT NULL THEN
        IF LOWER(TRIM(v_load.company_name)) = LOWER(TRIM(v_invoice.customer_name)) THEN
          v_customer_match := true;
        ELSE
          v_exceptions := v_exceptions || jsonb_build_object(
            'type', 'customer_mismatch',
            'severity', 'warning',
            'message', format('Invoice customer (%s) differs from load customer (%s)', 
              v_invoice.customer_name, v_load.company_name)
          );
        END IF;
      END IF;
      
      -- Check if BOL exists for this load
      SELECT * INTO v_bol
      FROM public.bols
      WHERE load_id = v_invoice.load_id
        AND status IN ('signed', 'delivered', 'completed');
      
      IF FOUND THEN
        v_bol_match := true;
      ELSE
        v_exceptions := v_exceptions || jsonb_build_object(
          'type', 'bol_missing',
          'severity', 'warning',
          'message', 'No signed BOL found for this load'
        );
      END IF;
    ELSE
      v_exceptions := v_exceptions || jsonb_build_object(
        'type', 'load_not_found',
        'severity', 'error',
        'message', 'Load referenced in invoice does not exist'
      );
    END IF;
  ELSE
    v_exceptions := v_exceptions || jsonb_build_object(
      'type', 'no_load_reference',
      'severity', 'warning',
      'message', 'Invoice has no load reference - cannot perform three-way match'
    );
  END IF;
  
  -- Determine verification status
  IF v_load_match AND v_amount_match AND v_customer_match AND v_bol_match THEN
    v_verification_status := 'verified';
  ELSIF jsonb_array_length(v_exceptions) > 0 THEN
    -- Check if any exceptions are errors
    IF EXISTS (
      SELECT 1 FROM jsonb_array_elements(v_exceptions) AS exc
      WHERE exc->>'severity' = 'error'
    ) THEN
      v_verification_status := 'exception';
    ELSE
      v_verification_status := 'manual_review';
    END IF;
  ELSE
    v_verification_status := 'exception';
  END IF;
  
  -- Insert or update verification record
  INSERT INTO public.invoice_verifications (
    company_id,
    invoice_id,
    load_id,
    bol_id,
    load_match,
    bol_match,
    amount_match,
    customer_match,
    load_amount,
    invoice_amount,
    amount_difference,
    amount_tolerance_percent,
    load_customer_name,
    invoice_customer_name,
    exceptions,
    verification_status,
    verified_at
  ) VALUES (
    v_invoice.company_id,
    p_invoice_id,
    v_invoice.load_id,
    COALESCE(v_bol.id, NULL),
    v_load_match,
    v_bol_match,
    v_amount_match,
    v_customer_match,
    v_load_amount,
    v_invoice.amount,
    v_amount_difference,
    v_amount_tolerance,
    v_load.company_name,
    v_invoice.customer_name,
    v_exceptions,
    v_verification_status,
    NOW()
  )
  ON CONFLICT (invoice_id) 
  DO UPDATE SET
    load_id = EXCLUDED.load_id,
    bol_id = EXCLUDED.bol_id,
    load_match = EXCLUDED.load_match,
    bol_match = EXCLUDED.bol_match,
    amount_match = EXCLUDED.amount_match,
    customer_match = EXCLUDED.customer_match,
    load_amount = EXCLUDED.load_amount,
    invoice_amount = EXCLUDED.invoice_amount,
    amount_difference = EXCLUDED.amount_difference,
    load_customer_name = EXCLUDED.load_customer_name,
    invoice_customer_name = EXCLUDED.invoice_customer_name,
    exceptions = EXCLUDED.exceptions,
    verification_status = EXCLUDED.verification_status,
    verified_at = EXCLUDED.verified_at,
    updated_at = NOW()
  RETURNING id INTO v_verification_id;
  
  -- Update invoice with verification status
  UPDATE public.invoices
  SET
    matching_status = v_verification_status,
    verification_details = jsonb_build_object(
      'load_match', v_load_match,
      'bol_match', v_bol_match,
      'amount_match', v_amount_match,
      'customer_match', v_customer_match,
      'exceptions', v_exceptions
    ),
    requires_manual_review = (v_verification_status = 'manual_review'),
    exception_reason = CASE 
      WHEN v_verification_status = 'exception' THEN 
        (SELECT exc->>'message' FROM jsonb_array_elements(v_exceptions) AS exc WHERE exc->>'severity' = 'error' LIMIT 1)
      ELSE NULL
    END,
    verified_at = CASE WHEN v_verification_status = 'verified' THEN NOW() ELSE NULL END
  WHERE id = p_invoice_id;
  
  -- Return results
  RETURN QUERY
  SELECT
    v_verification_id,
    v_load_match,
    v_bol_match,
    v_amount_match,
    v_customer_match,
    v_verification_status,
    v_exceptions;
END;
$$ LANGUAGE plpgsql;

-- Step 5: Create trigger to auto-verify invoice on creation/update
CREATE OR REPLACE FUNCTION trigger_verify_invoice_match()
RETURNS TRIGGER AS $$
BEGIN
  -- Only verify if invoice has load_id
  IF NEW.load_id IS NOT NULL THEN
    PERFORM verify_invoice_three_way_match(NEW.id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_auto_verify_invoice ON public.invoices;
CREATE TRIGGER trigger_auto_verify_invoice
  AFTER INSERT OR UPDATE OF load_id, amount, customer_name ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION trigger_verify_invoice_match();

-- Step 6: Create trigger to re-verify invoice when BOL is signed
CREATE OR REPLACE FUNCTION trigger_reverify_invoice_on_bol()
RETURNS TRIGGER AS $$
BEGIN
  -- If BOL status changed to signed/delivered, re-verify related invoices
  IF NEW.status IN ('signed', 'delivered', 'completed') AND 
     (OLD.status IS NULL OR OLD.status NOT IN ('signed', 'delivered', 'completed')) THEN
    PERFORM verify_invoice_three_way_match(inv.id)
    FROM public.invoices inv
    WHERE inv.load_id = NEW.load_id
      AND inv.matching_status != 'verified';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_reverify_invoice_on_bol ON public.bols;
CREATE TRIGGER trigger_reverify_invoice_on_bol
  AFTER UPDATE OF status ON public.bols
  FOR EACH ROW
  EXECUTE FUNCTION trigger_reverify_invoice_on_bol();

-- Step 7: Enable RLS on invoice_verifications
ALTER TABLE public.invoice_verifications ENABLE ROW LEVEL SECURITY;

-- Step 8: Create RLS policies
DROP POLICY IF EXISTS "Users can view invoice verifications in their company" ON public.invoice_verifications;
CREATE POLICY "Users can view invoice verifications in their company"
  ON public.invoice_verifications FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert invoice verifications in their company" ON public.invoice_verifications;
CREATE POLICY "Users can insert invoice verifications in their company"
  ON public.invoice_verifications FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update invoice verifications in their company" ON public.invoice_verifications;
CREATE POLICY "Users can update invoice verifications in their company"
  ON public.invoice_verifications FOR UPDATE
  USING (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

-- Step 9: Add comments
COMMENT ON TABLE public.invoice_verifications IS 
  'Stores three-way matching verification results for invoices (Load ↔ Invoice ↔ BOL)';
COMMENT ON FUNCTION verify_invoice_three_way_match IS 
  'Performs three-way matching: compares invoice with load data and BOL. Returns verification results and exceptions.';
COMMENT ON COLUMN public.invoices.matching_status IS 
  'Three-way matching status: pending, verified, exception, or manual_review';
COMMENT ON COLUMN public.invoices.verification_details IS 
  'JSONB object storing detailed verification results: load_match, bol_match, amount_match, customer_match, exceptions';

