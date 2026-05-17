-- Fix assign_load_transactional: add FOR UPDATE row locking and truck overlap check
-- Prevents race conditions where concurrent calls bypass application-layer overlap detection

CREATE OR REPLACE FUNCTION public.assign_load_transactional(
  p_load_id uuid,
  p_company_id uuid,
  p_truck_id uuid,
  p_trailer_id uuid,
  p_driver_id uuid,
  p_assigned_by uuid,
  p_update_driver boolean,
  p_update_truck boolean,
  p_update_trailer boolean,
  p_set_status boolean,
  p_new_status text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_load_company uuid;
  v_existing_status text;
  v_conflict_id uuid;
BEGIN
  -- Lock the load row for the duration of this transaction
  -- This prevents concurrent calls from bypassing overlap detection
  SELECT company_id, status
  INTO v_load_company, v_existing_status
  FROM public.loads
  WHERE id = p_load_id
  FOR UPDATE;

  IF v_load_company IS NULL THEN
    RAISE EXCEPTION 'Load not found';
  END IF;

  IF v_load_company <> p_company_id THEN
    RAISE EXCEPTION 'Load does not belong to this company';
  END IF;

  -- Truck overlap check: prevent assigning a truck already on an active load
  IF p_update_truck AND p_truck_id IS NOT NULL THEN
    SELECT id INTO v_conflict_id
    FROM public.loads
    WHERE truck_id = p_truck_id
      AND id <> p_load_id
      AND company_id = p_company_id
      AND status IN ('pending', 'scheduled', 'in_transit')
    LIMIT 1;

    IF v_conflict_id IS NOT NULL THEN
      RAISE EXCEPTION 'Truck is already assigned to load %', v_conflict_id;
    END IF;
  END IF;

  -- Driver overlap check: prevent assigning a driver already on an active load
  IF p_update_driver AND p_driver_id IS NOT NULL THEN
    SELECT id INTO v_conflict_id
    FROM public.loads
    WHERE driver_id = p_driver_id
      AND id <> p_load_id
      AND company_id = p_company_id
      AND status IN ('pending', 'scheduled', 'in_transit')
    LIMIT 1;

    IF v_conflict_id IS NOT NULL THEN
      RAISE EXCEPTION 'Driver is already assigned to load %', v_conflict_id;
    END IF;
  END IF;

  UPDATE public.loads
  SET
    truck_id = CASE WHEN p_update_truck THEN p_truck_id ELSE truck_id END,
    trailer_id = CASE WHEN p_update_trailer THEN p_trailer_id ELSE trailer_id END,
    driver_id = CASE WHEN p_update_driver THEN p_driver_id ELSE driver_id END,
    status = CASE WHEN p_set_status THEN COALESCE(p_new_status, status) ELSE status END,
    updated_at = now()
  WHERE id = p_load_id
    AND company_id = p_company_id;

  INSERT INTO public.audit_logs (
    company_id,
    user_id,
    action,
    resource_type,
    resource_id,
    details,
    created_at
  ) VALUES (
    p_company_id,
    p_assigned_by,
    'load_assigned',
    'load',
    p_load_id,
    jsonb_build_object(
      'truck_id', p_truck_id,
      'trailer_id', p_trailer_id,
      'driver_id', p_driver_id,
      'previous_status', v_existing_status,
      'update_driver', p_update_driver,
      'update_truck', p_update_truck,
      'update_trailer', p_update_trailer,
      'set_status', p_set_status,
      'new_status', p_new_status
    ),
    now()
  );

  RETURN json_build_object(
    'load_id', p_load_id,
    'status', 'assigned'
  );
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'assign_load_transactional failed: %', SQLERRM;
END;
$$;

GRANT EXECUTE ON FUNCTION public.assign_load_transactional TO authenticated, service_role;
