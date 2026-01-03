-- TruckLogics Features Schema
-- This schema adds all the missing features from TruckLogics to make TruckMates better

-- ============================================
-- 1. COMPANY SETTINGS (Number Formats, etc.)
-- ============================================
CREATE TABLE IF NOT EXISTS public.company_settings (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL UNIQUE,
  
  -- Number Format Settings
  load_number_format TEXT DEFAULT 'LOAD-{YEAR}-{SEQUENCE}', -- Format: {YEAR}, {MONTH}, {DAY}, {SEQUENCE}, {COMPANY}
  load_number_sequence INTEGER DEFAULT 1,
  invoice_number_format TEXT DEFAULT 'INV-{YEAR}-{MONTH}-{SEQUENCE}',
  invoice_number_sequence INTEGER DEFAULT 1,
  dispatch_number_format TEXT DEFAULT 'DISP-{YEAR}-{SEQUENCE}',
  dispatch_number_sequence INTEGER DEFAULT 1,
  bol_number_format TEXT DEFAULT 'BOL-{YEAR}-{SEQUENCE}',
  bol_number_sequence INTEGER DEFAULT 1,
  
  -- General Settings
  timezone TEXT DEFAULT 'America/New_York',
  date_format TEXT DEFAULT 'MM/DD/YYYY',
  time_format TEXT DEFAULT '12h', -- '12h' or '24h'
  currency TEXT DEFAULT 'USD',
  currency_symbol TEXT DEFAULT '$',
  
  -- Invoice Settings
  default_payment_terms TEXT DEFAULT 'Net 30',
  invoice_auto_send BOOLEAN DEFAULT false,
  invoice_email_template TEXT,
  
  -- Load Settings
  default_load_type TEXT DEFAULT 'ftl', -- 'ftl' or 'ltl'
  default_carrier_type TEXT DEFAULT 'dry-van',
  auto_create_route BOOLEAN DEFAULT true,
  
  -- Dispatch Settings
  default_check_call_interval INTEGER DEFAULT 4, -- hours
  check_call_reminder_minutes INTEGER DEFAULT 15,
  require_check_call_at_pickup BOOLEAN DEFAULT true,
  require_check_call_at_delivery BOOLEAN DEFAULT true,
  
  -- Document Settings
  auto_attach_bol_to_load BOOLEAN DEFAULT false,
  auto_email_bol_to_customer BOOLEAN DEFAULT false,
  document_retention_days INTEGER DEFAULT 365,
  required_documents JSONB DEFAULT '[]'::jsonb, -- Array of required document types per load type
  
  -- BOL Settings
  bol_auto_generate BOOLEAN DEFAULT false,
  bol_template TEXT,
  bol_required_fields JSONB DEFAULT '[]'::jsonb,
  
  -- Odometer Settings
  odometer_validation_enabled BOOLEAN DEFAULT true,
  max_odometer_increase_per_day INTEGER DEFAULT 1000, -- miles
  odometer_auto_sync_from_eld BOOLEAN DEFAULT true,
  
  -- ProMiles Integration (if available)
  promiles_enabled BOOLEAN DEFAULT false,
  promiles_api_key TEXT,
  promiles_username TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- ============================================
-- 2. CHECK CALLS SYSTEM
-- ============================================
CREATE TABLE IF NOT EXISTS public.check_calls (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  load_id UUID REFERENCES public.loads(id) ON DELETE CASCADE,
  route_id UUID REFERENCES public.routes(id) ON DELETE CASCADE,
  driver_id UUID REFERENCES public.drivers(id) ON DELETE CASCADE NOT NULL,
  
  -- Check Call Details
  call_type TEXT NOT NULL, -- 'scheduled', 'pickup', 'delivery', 'milestone', 'border_crossing', 'emergency'
  scheduled_time TIMESTAMP WITH TIME ZONE,
  actual_time TIMESTAMP WITH TIME ZONE,
  status TEXT DEFAULT 'pending', -- 'pending', 'completed', 'missed', 'overdue'
  
  -- Location
  location TEXT,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  address TEXT,
  
  -- Driver Status
  driver_status TEXT, -- 'driving', 'on_duty', 'off_duty', 'sleeper_berth'
  odometer_reading INTEGER,
  fuel_level INTEGER, -- percentage
  
  -- Notes
  notes TEXT,
  dispatcher_notes TEXT,
  
  -- Reminder Tracking
  reminder_sent_at TIMESTAMP WITH TIME ZONE,
  reminder_count INTEGER DEFAULT 0,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- ============================================
-- 3. EVENT-BASED ALERTS
-- ============================================
CREATE TABLE IF NOT EXISTS public.alert_rules (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  
  -- Rule Configuration
  name TEXT NOT NULL,
  description TEXT,
  event_type TEXT NOT NULL, -- 'load_status_change', 'driver_late', 'check_call_missed', 'delivery_window', 'hos_violation', 'maintenance_due', 'custom'
  is_active BOOLEAN DEFAULT true,
  
  -- Conditions (JSONB for flexibility)
  conditions JSONB NOT NULL, -- e.g., {"status": "in_transit", "hours_late": 2}
  
  -- Actions
  send_email BOOLEAN DEFAULT false,
  send_sms BOOLEAN DEFAULT false,
  send_in_app BOOLEAN DEFAULT true,
  notify_users JSONB DEFAULT '[]'::jsonb, -- Array of user IDs or roles
  escalation_enabled BOOLEAN DEFAULT false,
  escalation_delay_minutes INTEGER DEFAULT 30,
  
  -- Priority
  priority TEXT DEFAULT 'normal', -- 'low', 'normal', 'high', 'critical'
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.alerts (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  alert_rule_id UUID REFERENCES public.alert_rules(id) ON DELETE SET NULL,
  
  -- Alert Details
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  event_type TEXT NOT NULL,
  priority TEXT DEFAULT 'normal',
  status TEXT DEFAULT 'active', -- 'active', 'acknowledged', 'resolved', 'dismissed'
  
  -- Related Entities
  load_id UUID REFERENCES public.loads(id) ON DELETE CASCADE,
  route_id UUID REFERENCES public.routes(id) ON DELETE CASCADE,
  driver_id UUID REFERENCES public.drivers(id) ON DELETE CASCADE,
  truck_id UUID REFERENCES public.trucks(id) ON DELETE CASCADE,
  
  -- Metadata
  metadata JSONB, -- Additional context data
  acknowledged_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  acknowledged_at TIMESTAMP WITH TIME ZONE,
  resolved_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- ============================================
-- 4. REMINDERS SYSTEM
-- ============================================
CREATE TABLE IF NOT EXISTS public.reminders (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  
  -- Reminder Details
  title TEXT NOT NULL,
  description TEXT,
  reminder_type TEXT NOT NULL, -- 'maintenance', 'license_renewal', 'insurance_renewal', 'invoice_due', 'load_delivery', 'check_call', 'custom'
  
  -- Scheduling
  due_date DATE NOT NULL,
  due_time TIME,
  reminder_date DATE,
  reminder_time TIME,
  is_recurring BOOLEAN DEFAULT false,
  recurrence_pattern TEXT, -- 'daily', 'weekly', 'monthly', 'yearly'
  recurrence_interval INTEGER DEFAULT 1,
  
  -- Related Entities
  truck_id UUID REFERENCES public.trucks(id) ON DELETE CASCADE,
  driver_id UUID REFERENCES public.drivers(id) ON DELETE CASCADE,
  load_id UUID REFERENCES public.loads(id) ON DELETE CASCADE,
  invoice_id UUID REFERENCES public.invoices(id) ON DELETE CASCADE,
  
  -- Status
  status TEXT DEFAULT 'pending', -- 'pending', 'sent', 'completed', 'overdue', 'cancelled'
  completed_at TIMESTAMP WITH TIME ZONE,
  completed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  
  -- Notifications
  notify_users JSONB DEFAULT '[]'::jsonb, -- Array of user IDs
  send_email BOOLEAN DEFAULT true,
  send_sms BOOLEAN DEFAULT false,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- ============================================
-- 5. CHAT/MESSAGING SYSTEM
-- ============================================
CREATE TABLE IF NOT EXISTS public.chat_threads (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  
  -- Thread Details
  title TEXT,
  thread_type TEXT NOT NULL, -- 'load', 'route', 'driver', 'general', 'group'
  
  -- Related Entities
  load_id UUID REFERENCES public.loads(id) ON DELETE CASCADE,
  route_id UUID REFERENCES public.routes(id) ON DELETE CASCADE,
  driver_id UUID REFERENCES public.drivers(id) ON DELETE CASCADE,
  
  -- Participants
  participants JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of user IDs
  
  -- Metadata
  last_message_at TIMESTAMP WITH TIME ZONE,
  last_message_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  unread_count JSONB DEFAULT '{}'::jsonb, -- {userId: count}
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.chat_messages (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  thread_id UUID REFERENCES public.chat_threads(id) ON DELETE CASCADE NOT NULL,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  
  -- Message Details
  sender_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  message TEXT NOT NULL,
  message_type TEXT DEFAULT 'text', -- 'text', 'image', 'file', 'location', 'system'
  
  -- Attachments
  attachments JSONB DEFAULT '[]'::jsonb, -- Array of file URLs/metadata
  
  -- Status
  is_read BOOLEAN DEFAULT false,
  read_by JSONB DEFAULT '[]'::jsonb, -- Array of user IDs who read it
  is_edited BOOLEAN DEFAULT false,
  edited_at TIMESTAMP WITH TIME ZONE,
  is_deleted BOOLEAN DEFAULT false,
  deleted_at TIMESTAMP WITH TIME ZONE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- ============================================
-- 6. CUSTOMER PORTAL ACCESS
-- ============================================
CREATE TABLE IF NOT EXISTS public.customer_portal_access (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  customer_id UUID REFERENCES public.customers(id) ON DELETE CASCADE,
  
  -- Access Details
  access_token TEXT UNIQUE NOT NULL, -- Secure token for portal access
  portal_url TEXT, -- Custom portal URL if provided
  is_active BOOLEAN DEFAULT true,
  
  -- Permissions
  can_view_loads BOOLEAN DEFAULT true,
  can_view_location BOOLEAN DEFAULT false, -- Real-time driver location
  can_download_documents BOOLEAN DEFAULT true,
  can_view_invoices BOOLEAN DEFAULT true,
  can_submit_loads BOOLEAN DEFAULT false,
  
  -- Settings
  email_notifications BOOLEAN DEFAULT true,
  sms_notifications BOOLEAN DEFAULT false,
  
  -- Expiration
  expires_at TIMESTAMP WITH TIME ZONE,
  last_accessed_at TIMESTAMP WITH TIME ZONE,
  access_count INTEGER DEFAULT 0,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- ============================================
-- 7. USER PERSONALIZATION SETTINGS
-- ============================================
CREATE TABLE IF NOT EXISTS public.user_preferences (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  
  -- Dashboard Preferences
  dashboard_layout JSONB, -- Custom dashboard widget layout
  default_view TEXT DEFAULT 'all', -- 'all', 'my_loads', 'my_routes', 'assigned'
  
  -- Table Preferences
  table_columns JSONB DEFAULT '{}'::jsonb, -- {tableName: [columnIds]}
  table_sorting JSONB DEFAULT '{}'::jsonb, -- {tableName: {column, direction}}
  table_filters JSONB DEFAULT '{}'::jsonb, -- {tableName: {filters}}
  
  -- UI Preferences
  theme TEXT DEFAULT 'dark', -- 'light', 'dark', 'auto'
  compact_mode BOOLEAN DEFAULT false,
  sidebar_collapsed BOOLEAN DEFAULT false,
  
  -- Notification Preferences (extends notification_preferences)
  desktop_notifications BOOLEAN DEFAULT true,
  sound_enabled BOOLEAN DEFAULT true,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_company_settings_company_id ON public.company_settings(company_id);
CREATE INDEX IF NOT EXISTS idx_check_calls_company_id ON public.check_calls(company_id);
CREATE INDEX IF NOT EXISTS idx_check_calls_load_id ON public.check_calls(load_id);
CREATE INDEX IF NOT EXISTS idx_check_calls_driver_id ON public.check_calls(driver_id);
CREATE INDEX IF NOT EXISTS idx_check_calls_status ON public.check_calls(status);
CREATE INDEX IF NOT EXISTS idx_check_calls_scheduled_time ON public.check_calls(scheduled_time);
CREATE INDEX IF NOT EXISTS idx_alert_rules_company_id ON public.alert_rules(company_id);
CREATE INDEX IF NOT EXISTS idx_alert_rules_event_type ON public.alert_rules(event_type);
CREATE INDEX IF NOT EXISTS idx_alerts_company_id ON public.alerts(company_id);
CREATE INDEX IF NOT EXISTS idx_alerts_status ON public.alerts(status);
CREATE INDEX IF NOT EXISTS idx_alerts_priority ON public.alerts(priority);
CREATE INDEX IF NOT EXISTS idx_alerts_created_at ON public.alerts(created_at);
CREATE INDEX IF NOT EXISTS idx_reminders_company_id ON public.reminders(company_id);
CREATE INDEX IF NOT EXISTS idx_reminders_due_date ON public.reminders(due_date);
CREATE INDEX IF NOT EXISTS idx_reminders_status ON public.reminders(status);
CREATE INDEX IF NOT EXISTS idx_chat_threads_company_id ON public.chat_threads(company_id);
CREATE INDEX IF NOT EXISTS idx_chat_threads_load_id ON public.chat_threads(load_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_thread_id ON public.chat_messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_sender_id ON public.chat_messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_customer_portal_access_company_id ON public.customer_portal_access(company_id);
CREATE INDEX IF NOT EXISTS idx_customer_portal_access_token ON public.customer_portal_access(access_token);
CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON public.user_preferences(user_id);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.check_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alert_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_portal_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

-- Company Settings Policies
DROP POLICY IF EXISTS "Users can view company settings" ON public.company_settings;
CREATE POLICY "Users can view company settings"
  ON public.company_settings FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Managers can update company settings" ON public.company_settings;
CREATE POLICY "Managers can update company settings"
  ON public.company_settings FOR UPDATE
  USING (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid() AND role = 'manager'
    )
  );

-- Check Calls Policies
DROP POLICY IF EXISTS "Users can view check calls in their company" ON public.check_calls;
CREATE POLICY "Users can view check calls in their company"
  ON public.check_calls FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can create check calls" ON public.check_calls;
CREATE POLICY "Users can create check calls"
  ON public.check_calls FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update check calls" ON public.check_calls;
CREATE POLICY "Users can update check calls"
  ON public.check_calls FOR UPDATE
  USING (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

-- Alert Rules Policies
DROP POLICY IF EXISTS "Users can view alert rules in their company" ON public.alert_rules;
CREATE POLICY "Users can view alert rules in their company"
  ON public.alert_rules FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Managers can manage alert rules" ON public.alert_rules;
CREATE POLICY "Managers can manage alert rules"
  ON public.alert_rules FOR ALL
  USING (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid() AND role = 'manager'
    )
  );

-- Alerts Policies
DROP POLICY IF EXISTS "Users can view alerts in their company" ON public.alerts;
CREATE POLICY "Users can view alerts in their company"
  ON public.alerts FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update their alerts" ON public.alerts;
CREATE POLICY "Users can update their alerts"
  ON public.alerts FOR UPDATE
  USING (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

-- Reminders Policies
DROP POLICY IF EXISTS "Users can view reminders in their company" ON public.reminders;
CREATE POLICY "Users can view reminders in their company"
  ON public.reminders FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can manage reminders" ON public.reminders;
CREATE POLICY "Users can manage reminders"
  ON public.reminders FOR ALL
  USING (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

-- Chat Threads Policies
DROP POLICY IF EXISTS "Users can view chat threads they're in" ON public.chat_threads;
CREATE POLICY "Users can view chat threads they're in"
  ON public.chat_threads FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
    AND (
      auth.uid()::text = ANY(SELECT jsonb_array_elements_text(participants))
      OR company_id IN (
        SELECT company_id FROM public.users WHERE id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Users can create chat threads" ON public.chat_threads;
CREATE POLICY "Users can create chat threads"
  ON public.chat_threads FOR INSERT
  WITH CHECK (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

-- Chat Messages Policies
DROP POLICY IF EXISTS "Users can view messages in their threads" ON public.chat_messages;
CREATE POLICY "Users can view messages in their threads"
  ON public.chat_messages FOR SELECT
  USING (
    thread_id IN (
      SELECT id FROM public.chat_threads
      WHERE company_id IN (
        SELECT company_id FROM public.users WHERE id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Users can send messages" ON public.chat_messages;
CREATE POLICY "Users can send messages"
  ON public.chat_messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid()
    AND company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

-- Customer Portal Access Policies
DROP POLICY IF EXISTS "Managers can manage portal access" ON public.customer_portal_access;
CREATE POLICY "Managers can manage portal access"
  ON public.customer_portal_access FOR ALL
  USING (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid() AND role = 'manager'
    )
  );

-- User Preferences Policies
DROP POLICY IF EXISTS "Users can view their own preferences" ON public.user_preferences;
CREATE POLICY "Users can view their own preferences"
  ON public.user_preferences FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own preferences" ON public.user_preferences;
CREATE POLICY "Users can update their own preferences"
  ON public.user_preferences FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own preferences" ON public.user_preferences;
CREATE POLICY "Users can insert their own preferences"
  ON public.user_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ============================================
-- TRIGGERS
-- ============================================
-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc'::text, NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_company_settings_updated_at ON public.company_settings;
CREATE TRIGGER update_company_settings_updated_at
  BEFORE UPDATE ON public.company_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_check_calls_updated_at ON public.check_calls;
CREATE TRIGGER update_check_calls_updated_at
  BEFORE UPDATE ON public.check_calls
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_alert_rules_updated_at ON public.alert_rules;
CREATE TRIGGER update_alert_rules_updated_at
  BEFORE UPDATE ON public.alert_rules
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_alerts_updated_at ON public.alerts;
CREATE TRIGGER update_alerts_updated_at
  BEFORE UPDATE ON public.alerts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_reminders_updated_at ON public.reminders;
CREATE TRIGGER update_reminders_updated_at
  BEFORE UPDATE ON public.reminders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_chat_threads_updated_at ON public.chat_threads;
CREATE TRIGGER update_chat_threads_updated_at
  BEFORE UPDATE ON public.chat_threads
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_chat_messages_updated_at ON public.chat_messages;
CREATE TRIGGER update_chat_messages_updated_at
  BEFORE UPDATE ON public.chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_customer_portal_access_updated_at ON public.customer_portal_access;
CREATE TRIGGER update_customer_portal_access_updated_at
  BEFORE UPDATE ON public.customer_portal_access
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_preferences_updated_at ON public.user_preferences;
CREATE TRIGGER update_user_preferences_updated_at
  BEFORE UPDATE ON public.user_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Auto-create company settings when company is created
CREATE OR REPLACE FUNCTION create_company_settings()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.company_settings (company_id)
  VALUES (NEW.id)
  ON CONFLICT (company_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_company_created_settings ON public.companies;
CREATE TRIGGER on_company_created_settings
  AFTER INSERT ON public.companies
  FOR EACH ROW
  EXECUTE FUNCTION create_company_settings();

-- Update chat thread last_message_at when message is created
CREATE OR REPLACE FUNCTION update_chat_thread_last_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.chat_threads
  SET 
    last_message_at = NEW.created_at,
    last_message_by = NEW.sender_id,
    updated_at = TIMEZONE('utc'::text, NOW())
  WHERE id = NEW.thread_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_chat_message_created ON public.chat_messages;
CREATE TRIGGER on_chat_message_created
  AFTER INSERT ON public.chat_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_chat_thread_last_message();

