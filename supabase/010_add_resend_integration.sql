-- Add Resend Email Integration columns to company_integrations table
-- Run this migration in your Supabase SQL Editor

ALTER TABLE public.company_integrations
ADD COLUMN IF NOT EXISTS resend_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS resend_api_key TEXT,
ADD COLUMN IF NOT EXISTS resend_from_email TEXT;

-- Add comment for documentation
COMMENT ON COLUMN public.company_integrations.resend_enabled IS 'Enable Resend email service for sending invoices and notifications';
COMMENT ON COLUMN public.company_integrations.resend_api_key IS 'Resend API key (starts with re_)';
COMMENT ON COLUMN public.company_integrations.resend_from_email IS 'From email address for Resend (e.g., TruckMates <notifications@yourdomain.com>)';

