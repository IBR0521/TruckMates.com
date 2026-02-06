-- Driver Onboarding Workflow Schema
-- Enhanced onboarding process with document tracking and checklist

-- Driver Onboarding Status table
CREATE TABLE IF NOT EXISTS public.driver_onboarding (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  driver_id UUID REFERENCES public.drivers(id) ON DELETE CASCADE NOT NULL UNIQUE,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  
  -- Onboarding Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'on_hold', 'rejected')),
  current_step INTEGER DEFAULT 1, -- Current step in onboarding process (1-5)
  total_steps INTEGER DEFAULT 5,
  
  -- Progress Tracking
  completion_percentage INTEGER DEFAULT 0, -- 0-100
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  estimated_completion_date DATE,
  
  -- Document Checklist
  documents_required JSONB DEFAULT '[]'::jsonb, -- Array of required document types
  documents_completed JSONB DEFAULT '[]'::jsonb, -- Array of completed document IDs
  documents_missing JSONB DEFAULT '[]'::jsonb, -- Array of missing document types
  
  -- Required Documents Status
  license_uploaded BOOLEAN DEFAULT false,
  medical_card_uploaded BOOLEAN DEFAULT false,
  insurance_uploaded BOOLEAN DEFAULT false,
  w9_uploaded BOOLEAN DEFAULT false,
  i9_uploaded BOOLEAN DEFAULT false,
  background_check_completed BOOLEAN DEFAULT false,
  drug_test_completed BOOLEAN DEFAULT false,
  
  -- Training & Orientation
  orientation_completed BOOLEAN DEFAULT false,
  orientation_date DATE,
  training_completed BOOLEAN DEFAULT false,
  training_modules JSONB DEFAULT '[]'::jsonb, -- Array of completed training modules
  
  -- Notes & Comments
  notes TEXT,
  onboarding_notes TEXT, -- Internal notes from HR/manager
  rejection_reason TEXT, -- If onboarding was rejected
  
  -- Assignments
  assigned_to_user_id UUID REFERENCES public.users(id), -- Manager/HR person handling onboarding
  assigned_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Onboarding Checklist Items (template)
CREATE TABLE IF NOT EXISTS public.onboarding_checklist_templates (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL, -- Template name (e.g., "Standard Driver Onboarding")
  
  -- Checklist Items
  items JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of checklist items
  
  -- Example structure for items:
  -- [
  --   {
  --     "step": 1,
  --     "step_name": "Personal Information",
  --     "items": [
  --       {"id": "name", "label": "Full Name", "required": true, "type": "text"},
  --       {"id": "email", "label": "Email Address", "required": true, "type": "email"},
  --       {"id": "phone", "label": "Phone Number", "required": true, "type": "phone"}
  --     ]
  --   },
  --   {
  --     "step": 2,
  --     "step_name": "License & Certifications",
  --     "items": [
  --       {"id": "license", "label": "CDL License", "required": true, "type": "document"},
  --       {"id": "medical_card", "label": "Medical Card", "required": true, "type": "document"}
  --     ]
  --   }
  -- ]
  
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Onboarding Steps (standard workflow)
-- Step 1: Personal Information & Contact
-- Step 2: License & Certifications
-- Step 3: Employment Documents (W9, I9)
-- Step 4: Background Check & Drug Test
-- Step 5: Training & Orientation

-- Indexes
CREATE INDEX IF NOT EXISTS idx_driver_onboarding_driver_id ON public.driver_onboarding(driver_id);
CREATE INDEX IF NOT EXISTS idx_driver_onboarding_company_id ON public.driver_onboarding(company_id);
CREATE INDEX IF NOT EXISTS idx_driver_onboarding_status ON public.driver_onboarding(status);
CREATE INDEX IF NOT EXISTS idx_driver_onboarding_assigned_to ON public.driver_onboarding(assigned_to_user_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_checklist_templates_company_id ON public.onboarding_checklist_templates(company_id);

-- RLS Policies
ALTER TABLE public.driver_onboarding ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_checklist_templates ENABLE ROW LEVEL SECURITY;

-- Driver Onboarding Policies
CREATE POLICY "Users can view their company driver onboarding"
  ON public.driver_onboarding
  FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

CREATE POLICY "Managers can manage their company driver onboarding"
  ON public.driver_onboarding
  FOR ALL
  USING (
    company_id IN (
      SELECT company_id FROM public.users 
      WHERE id = auth.uid() AND role = 'manager'
    )
  );

-- Onboarding Checklist Templates Policies
CREATE POLICY "Users can view their company onboarding templates"
  ON public.onboarding_checklist_templates
  FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    ) OR company_id IS NULL -- Allow viewing default templates
  );

CREATE POLICY "Managers can manage their company onboarding templates"
  ON public.onboarding_checklist_templates
  FOR ALL
  USING (
    company_id IN (
      SELECT company_id FROM public.users 
      WHERE id = auth.uid() AND role = 'manager'
    )
  );

