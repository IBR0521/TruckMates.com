-- Notifications Table
-- Stores in-app notifications for users

CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'info', -- 'route_update', 'load_update', 'maintenance_alert', 'payment_reminder', 'alert', 'info'
  title TEXT NOT NULL,
  message TEXT,
  priority TEXT DEFAULT 'normal', -- 'low', 'normal', 'high', 'critical'
  metadata JSONB DEFAULT '{}'::jsonb, -- Additional data (alert_id, event_type, etc.)
  read BOOLEAN DEFAULT false,
  read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_company_id ON public.notifications(company_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON public.notifications(read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON public.notifications(type);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own notifications"
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert notifications for users"
  ON public.notifications FOR INSERT
  WITH CHECK (true); -- Allow system to create notifications

-- Trigger for updated_at
CREATE TRIGGER update_notifications_updated_at 
  BEFORE UPDATE ON public.notifications
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Function to mark notification as read
CREATE OR REPLACE FUNCTION mark_notification_read(notification_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE public.notifications
  SET read = true, read_at = NOW()
  WHERE id = notification_id AND user_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to mark all notifications as read for a user
CREATE OR REPLACE FUNCTION mark_all_notifications_read()
RETURNS void AS $$
BEGIN
  UPDATE public.notifications
  SET read = true, read_at = NOW()
  WHERE user_id = auth.uid() AND read = false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

