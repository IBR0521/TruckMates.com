-- Persist invited employee role on invitation_codes (Administration > Users & invites).
-- Source of truth at registration — not the ?role= query param on the invite link.

ALTER TABLE public.invitation_codes
  ADD COLUMN IF NOT EXISTS invited_role TEXT;

-- Legacy pending invites only had role in the email URL; default safely before NOT NULL.
UPDATE public.invitation_codes
SET invited_role = 'driver'
WHERE invited_role IS NULL OR btrim(invited_role) = '';

ALTER TABLE public.invitation_codes
  ALTER COLUMN invited_role SET DEFAULT 'driver';

ALTER TABLE public.invitation_codes
  DROP CONSTRAINT IF EXISTS invitation_codes_invited_role_check;

ALTER TABLE public.invitation_codes
  ADD CONSTRAINT invitation_codes_invited_role_check
  CHECK (
    invited_role IN (
      'super_admin',
      'operations_manager',
      'dispatcher',
      'safety_compliance',
      'financial_controller',
      'driver'
    )
  );

ALTER TABLE public.invitation_codes
  ALTER COLUMN invited_role SET NOT NULL;

COMMENT ON COLUMN public.invitation_codes.invited_role IS
  'Role applied when the invitee completes registration; mirrors public.users.role.';
