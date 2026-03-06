-- ============================================
-- BUG-034 FIX: Auth trigger privilege escalation vulnerability
-- ============================================
-- The handle_new_user trigger was trusting raw_user_meta_data.role,
-- allowing attackers to self-assign any role by calling Supabase Auth
-- signUp endpoint directly with role: "super_admin" in metadata.
--
-- This fix ensures the trigger always defaults to 'driver' and never
-- trusts metadata for role assignment. Role escalation must happen via
-- server-side SECURITY DEFINER RPC functions after identity verification.
-- ============================================

-- Drop and recreate the trigger function with security fix
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- BUG-034 FIX: Never trust raw_user_meta_data.role for security
  -- Always default to 'driver' - role escalation must happen via server-side RPC
  INSERT INTO public.users (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    'driver' -- BUG-034 FIX: Hardcoded default, never trust metadata
  )
  ON CONFLICT (id) DO UPDATE
  SET 
    email = EXCLUDED.email,
    full_name = COALESCE(EXCLUDED.full_name, users.full_name),
    -- BUG-034 FIX: Never update role from metadata on conflict either
    -- Role changes must go through server-side updateUserRole function
    role = users.role; -- Keep existing role, don't update from metadata
  RETURN NEW;
END;
$$;

-- The trigger already exists, so no need to recreate it
-- Just verify it's using the updated function

