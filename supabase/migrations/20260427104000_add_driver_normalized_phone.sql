ALTER TABLE public.drivers
  ADD COLUMN IF NOT EXISTS normalized_phone TEXT;

UPDATE public.drivers
SET normalized_phone = CASE
  WHEN phone IS NULL OR btrim(phone) = '' THEN NULL
  WHEN left(regexp_replace(phone, '\s+', '', 'g'), 1) = '+' THEN regexp_replace(phone, '\s+', '', 'g')
  WHEN length(regexp_replace(phone, '\D', '', 'g')) = 10 THEN '+1' || regexp_replace(phone, '\D', '', 'g')
  WHEN length(regexp_replace(phone, '\D', '', 'g')) = 11 AND left(regexp_replace(phone, '\D', '', 'g'), 1) = '1' THEN '+' || regexp_replace(phone, '\D', '', 'g')
  ELSE '+' || regexp_replace(phone, '\D', '', 'g')
END
WHERE normalized_phone IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_drivers_company_normalized_phone_unique
  ON public.drivers(company_id, normalized_phone)
  WHERE normalized_phone IS NOT NULL;
