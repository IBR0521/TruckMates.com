-- eBOL Invoice Automation Trigger
-- Automatically generates invoice when POD signature is captured
-- This ensures invoices are created immediately upon delivery confirmation

-- ============================================================================
-- 1. Function to Auto-Generate Invoice on POD Signature
-- ============================================================================

CREATE OR REPLACE FUNCTION public.trigger_auto_generate_invoice_on_pod()
RETURNS TRIGGER AS $$
DECLARE
  v_load_id UUID;
  v_company_id UUID;
  v_load RECORD;
  v_invoice_id UUID;
  v_invoice_number TEXT;
  v_amount DECIMAL(10, 2);
  v_customer_name TEXT;
BEGIN
  -- Only process if consignee signature was just added (POD captured)
  IF NEW.consignee_signature IS NOT NULL AND (OLD.consignee_signature IS NULL OR OLD.consignee_signature = 'null'::jsonb) THEN
    -- Get load details
    v_load_id := NEW.load_id;
    
    -- Get load information
    SELECT 
      l.id,
      l.company_id,
      l.shipment_number,
      l.company_name,
      l.consignee_name,
      l.rate,
      l.value,
      l.total_revenue,
      l.estimated_revenue,
      l.origin,
      l.destination,
      l.customer_id
    INTO v_load
    FROM public.loads l
    WHERE l.id = v_load_id;
    
    IF NOT FOUND THEN
      RAISE WARNING 'Load not found for BOL: %', NEW.id;
      RETURN NEW;
    END IF;
    
    v_company_id := v_load.company_id;
    
    -- Check if invoice already exists for this load
    SELECT id INTO v_invoice_id
    FROM public.invoices
    WHERE load_id = v_load_id
      AND company_id = v_company_id
    LIMIT 1;
    
    IF v_invoice_id IS NOT NULL THEN
      -- Invoice already exists, just return
      RETURN NEW;
    END IF;
    
    -- Calculate invoice amount (priority: total_revenue > estimated_revenue > rate > value)
    v_amount := COALESCE(
      v_load.total_revenue,
      v_load.estimated_revenue,
      v_load.rate,
      v_load.value,
      0
    );
    
    -- Skip if amount is zero
    IF v_amount <= 0 THEN
      RAISE WARNING 'Load % has no revenue value, skipping invoice generation', v_load_id;
      RETURN NEW;
    END IF;
    
    -- Get customer name
    v_customer_name := COALESCE(v_load.company_name, v_load.consignee_name, 'Customer');
    
    -- If customer_id exists, try to get customer name
    IF v_load.customer_id IS NOT NULL THEN
      SELECT COALESCE(company_name, name) INTO v_customer_name
      FROM public.customers
      WHERE id = v_load.customer_id
      LIMIT 1;
      
      IF v_customer_name IS NULL THEN
        v_customer_name := COALESCE(v_load.company_name, v_load.consignee_name, 'Customer');
      END IF;
    END IF;
    
    -- Generate invoice number
    v_invoice_number := 'INV-' || COALESCE(v_load.shipment_number, v_load_id::TEXT) || '-' || TO_CHAR(NOW(), 'YYYYMMDD');
    
    -- Create invoice
    INSERT INTO public.invoices (
      company_id,
      invoice_number,
      customer_name,
      load_id,
      amount,
      status,
      issue_date,
      due_date,
      payment_terms,
      description
    ) VALUES (
      v_company_id,
      v_invoice_number,
      v_customer_name,
      v_load_id,
      v_amount,
      'pending',
      CURRENT_DATE,
      CURRENT_DATE + INTERVAL '30 days', -- Net 30 default
      'Net 30',
      format('Invoice for load %s - %s to %s', 
        COALESCE(v_load.shipment_number, 'N/A'),
        COALESCE(v_load.origin, 'Origin'),
        COALESCE(v_load.destination, 'Destination')
      )
    )
    RETURNING id INTO v_invoice_id;
    
    -- Update load with invoice_id
    UPDATE public.loads
    SET invoice_id = v_invoice_id
    WHERE id = v_load_id;
    
    -- Update BOL status to 'delivered' if not already
    IF NEW.status != 'delivered' AND NEW.status != 'completed' THEN
      NEW.status := 'delivered';
    END IF;
    
    RAISE NOTICE 'Auto-generated invoice % for load %', v_invoice_id, v_load_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 2. Trigger on BOL consignee_signature update
-- ============================================================================

DROP TRIGGER IF EXISTS trigger_auto_generate_invoice_on_pod ON public.bols;
CREATE TRIGGER trigger_auto_generate_invoice_on_pod
  AFTER UPDATE OF consignee_signature ON public.bols
  FOR EACH ROW
  WHEN (NEW.consignee_signature IS NOT NULL AND (OLD.consignee_signature IS NULL OR OLD.consignee_signature = 'null'::jsonb))
  EXECUTE FUNCTION public.trigger_auto_generate_invoice_on_pod();

-- ============================================================================
-- 3. Function to send POD alert notifications
-- ============================================================================

CREATE OR REPLACE FUNCTION public.send_pod_alert_notifications(
  p_bol_id UUID,
  p_load_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  v_company_id UUID;
  v_load RECORD;
  v_bol RECORD;
  v_dispatcher_ids UUID[];
  v_customer_email TEXT;
  v_alert_title TEXT;
  v_alert_message TEXT;
BEGIN
  -- Get BOL and Load details
  SELECT b.company_id, b.bol_number, b.consignee_signature
  INTO v_bol
  FROM public.bols b
  WHERE b.id = p_bol_id;
  
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  
  v_company_id := v_bol.company_id;
  
  SELECT 
    l.shipment_number,
    l.origin,
    l.destination,
    l.company_name,
    l.consignee_name,
    l.driver_id
  INTO v_load
  FROM public.loads l
  WHERE l.id = p_load_id;
  
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  
  -- Get dispatcher/manager user IDs for alerts
  SELECT ARRAY_AGG(id)
  INTO v_dispatcher_ids
  FROM public.users
  WHERE company_id = v_company_id
    AND role IN ('manager', 'dispatcher', 'operations_manager', 'owner');
  
  -- Create alerts for dispatchers
  IF v_dispatcher_ids IS NOT NULL AND array_length(v_dispatcher_ids, 1) > 0 THEN
    v_alert_title := 'POD Captured - Load ' || COALESCE(v_load.shipment_number, 'N/A');
    v_alert_message := format(
      'Proof of Delivery captured for load %s (%s to %s). Invoice has been automatically generated.',
      COALESCE(v_load.shipment_number, 'N/A'),
      COALESCE(v_load.origin, 'Origin'),
      COALESCE(v_load.destination, 'Destination')
    );
    
    -- Insert alerts for each dispatcher
    INSERT INTO public.alerts (
      company_id,
      title,
      message,
      event_type,
      priority,
      load_id,
      status,
      metadata
    )
    SELECT 
      v_company_id,
      v_alert_title,
      v_alert_message,
      'pod_captured',
      'high',
      p_load_id,
      'active',
      jsonb_build_object(
        'bol_id', p_bol_id,
        'bol_number', v_bol.bol_number,
        'shipment_number', v_load.shipment_number
      )
    FROM unnest(v_dispatcher_ids) AS dispatcher_id;
  END IF;
  
  -- Get customer email for notification
  IF v_load.company_name IS NOT NULL THEN
    SELECT email INTO v_customer_email
    FROM public.customers
    WHERE company_id = v_company_id
      AND (company_name = v_load.company_name OR name = v_load.company_name)
    LIMIT 1;
  END IF;
  
  -- Note: Email/SMS notifications would be sent via Edge Function or API
  -- This function just creates the alerts in the database
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 4. Trigger to send POD alerts
-- ============================================================================

CREATE OR REPLACE FUNCTION public.trigger_send_pod_alerts()
RETURNS TRIGGER AS $$
BEGIN
  -- Only send alerts when consignee signature is first captured
  IF NEW.consignee_signature IS NOT NULL AND (OLD.consignee_signature IS NULL OR OLD.consignee_signature = 'null'::jsonb) THEN
    PERFORM public.send_pod_alert_notifications(NEW.id, NEW.load_id);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_send_pod_alerts ON public.bols;
CREATE TRIGGER trigger_send_pod_alerts
  AFTER UPDATE OF consignee_signature ON public.bols
  FOR EACH ROW
  WHEN (NEW.consignee_signature IS NOT NULL AND (OLD.consignee_signature IS NULL OR OLD.consignee_signature = 'null'::jsonb))
  EXECUTE FUNCTION public.trigger_send_pod_alerts();

-- ============================================================================
-- 5. Grant permissions
-- ============================================================================

GRANT EXECUTE ON FUNCTION public.trigger_auto_generate_invoice_on_pod() TO authenticated;
GRANT EXECUTE ON FUNCTION public.send_pod_alert_notifications(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.trigger_send_pod_alerts() TO authenticated;

COMMENT ON FUNCTION public.trigger_auto_generate_invoice_on_pod() IS 
'Automatically generates invoice when POD (consignee signature) is captured on BOL';

COMMENT ON FUNCTION public.send_pod_alert_notifications(UUID, UUID) IS 
'Sends alerts to dispatchers and customers when POD is captured';


