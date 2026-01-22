    -- Fix create_company_for_user function overload conflict
    -- This script drops the old function and creates the new one with company_type parameter

    -- Step 1: Drop the old function (without company_type parameter)
    DROP FUNCTION IF EXISTS public.create_company_for_user(TEXT, TEXT, TEXT, UUID);

    -- Step 2: Create the new function with company_type parameter
    CREATE OR REPLACE FUNCTION public.create_company_for_user(
    p_name TEXT,
    p_email TEXT,
    p_phone TEXT,
    p_user_id UUID,
    p_company_type TEXT DEFAULT NULL
    )
    RETURNS UUID
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
    AS $$
    DECLARE
    v_company_id UUID;
    BEGIN
    -- Insert company (bypasses RLS because of SECURITY DEFINER)
    INSERT INTO public.companies (name, email, phone, company_type)
    VALUES (p_name, p_email, p_phone, p_company_type)
    RETURNING id INTO v_company_id;

    -- Update user record to link to company
    UPDATE public.users
    SET 
        company_id = v_company_id,
        role = 'manager',
        full_name = p_name,
        phone = p_phone
    WHERE id = p_user_id;

    RETURN v_company_id;
    END;
    $$;

    -- Grant execute permission to authenticated users
    GRANT EXECUTE ON FUNCTION public.create_company_for_user(TEXT, TEXT, TEXT, UUID, TEXT) TO authenticated;

    -- Verify the function was created
    SELECT 
    routine_name,
    routine_type,
    data_type,
    routine_definition
    FROM information_schema.routines
    WHERE routine_schema = 'public' 
    AND routine_name = 'create_company_for_user';

