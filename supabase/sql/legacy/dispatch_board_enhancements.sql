-- ============================================================================
-- Enhanced Dispatch Board - Phase 1: Visual Clarity & Real-Time Updates
-- ============================================================================
-- This migration adds status color coding and enables real-time updates
-- ============================================================================

-- Step 1: Add status_color column to loads table
ALTER TABLE public.loads 
ADD COLUMN IF NOT EXISTS status_color TEXT DEFAULT '#6B7280';

-- Step 2: Add priority column for visual prioritization
ALTER TABLE public.loads
ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent'));

-- Step 3: Add urgency_score for automated prioritization
ALTER TABLE public.loads
ADD COLUMN IF NOT EXISTS urgency_score INTEGER DEFAULT 0;

-- Step 4: Create function to calculate urgency score
CREATE OR REPLACE FUNCTION calculate_load_urgency_score(p_load_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_load RECORD;
  v_score INTEGER := 0;
  v_hours_until_pickup DECIMAL;
  v_hours_until_delivery DECIMAL;
  v_is_delayed BOOLEAN := false;
BEGIN
  -- Get load details
  SELECT 
    l.*,
    l.load_date,
    l.estimated_delivery,
    l.status,
    l.priority
  INTO v_load
  FROM public.loads l
  WHERE l.id = p_load_id;
  
  IF NOT FOUND THEN
    RETURN 0;
  END IF;
  
  -- Calculate hours until pickup
  IF v_load.load_date IS NOT NULL THEN
    v_hours_until_pickup := EXTRACT(EPOCH FROM (v_load.load_date - NOW())) / 3600.0;
    
    -- Urgent if pickup is within 2 hours
    IF v_hours_until_pickup <= 2 AND v_hours_until_pickup > 0 THEN
      v_score := v_score + 50;
    ELSIF v_hours_until_pickup <= 6 AND v_hours_until_pickup > 0 THEN
      v_score := v_score + 30;
    ELSIF v_hours_until_pickup <= 12 AND v_hours_until_pickup > 0 THEN
      v_score := v_score + 15;
    END IF;
    
    -- Overdue (pickup time passed)
    IF v_hours_until_pickup < 0 THEN
      v_score := v_score + 100;
      v_is_delayed := true;
    END IF;
  END IF;
  
  -- Calculate hours until delivery
  IF v_load.estimated_delivery IS NOT NULL THEN
    v_hours_until_delivery := EXTRACT(EPOCH FROM (v_load.estimated_delivery - NOW())) / 3600.0;
    
    -- Urgent if delivery is within 4 hours
    IF v_hours_until_delivery <= 4 AND v_hours_until_delivery > 0 THEN
      v_score := v_score + 40;
    ELSIF v_hours_until_delivery <= 8 AND v_hours_until_delivery > 0 THEN
      v_score := v_score + 20;
    END IF;
    
    -- Overdue (delivery time passed)
    IF v_hours_until_delivery < 0 AND v_load.status != 'delivered' THEN
      v_score := v_score + 80;
      v_is_delayed := true;
    END IF;
  END IF;
  
  -- Priority boost
  IF v_load.priority = 'urgent' THEN
    v_score := v_score + 30;
  ELSIF v_load.priority = 'high' THEN
    v_score := v_score + 15;
  END IF;
  
  -- Status-based scoring
  IF v_load.status = 'pending' AND v_is_delayed THEN
    v_score := v_score + 25; -- Unassigned and delayed = very urgent
  ELSIF v_load.status = 'pending' THEN
    v_score := v_score + 10; -- Unassigned = needs attention
  END IF;
  
  RETURN LEAST(v_score, 100); -- Cap at 100
END;
$$ LANGUAGE plpgsql;

-- Step 5: Create function to update status color based on status and urgency
CREATE OR REPLACE FUNCTION update_load_status_color()
RETURNS TRIGGER AS $$
DECLARE
  v_urgency_score INTEGER;
  v_color TEXT;
BEGIN
  -- Calculate urgency score
  v_urgency_score := calculate_load_urgency_score(NEW.id);
  NEW.urgency_score := v_urgency_score;
  
  -- Determine color based on status and urgency (reduced red usage)
  IF NEW.status = 'delayed' OR (NEW.estimated_delivery < NOW() AND NEW.status != 'delivered') THEN
    v_color := '#F97316'; -- Orange - Delayed/Overdue (changed from red)
  ELSIF v_urgency_score >= 70 THEN
    v_color := '#F59E0B'; -- Amber - Very Urgent (changed from orange)
  ELSIF NEW.status = 'in_transit' THEN
    v_color := '#10B981'; -- Green - En Route
  ELSIF NEW.status = 'scheduled' THEN
    v_color := '#3B82F6'; -- Blue - Scheduled
  ELSIF NEW.status = 'pending' AND v_urgency_score >= 40 THEN
    v_color := '#F59E0B'; -- Amber - Needs Attention
  ELSIF NEW.status = 'pending' THEN
    v_color := '#6B7280'; -- Slate Gray - Normal
  ELSIF NEW.status = 'delivered' OR NEW.status = 'completed' THEN
    v_color := '#9CA3AF'; -- Light Gray - Completed
  ELSE
    v_color := '#6B7280'; -- Default Slate Gray
  END IF;
  
  NEW.status_color := v_color;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Step 6: Create trigger to auto-update status color
DROP TRIGGER IF EXISTS trigger_update_load_status_color ON public.loads;
CREATE TRIGGER trigger_update_load_status_color
BEFORE INSERT OR UPDATE ON public.loads
FOR EACH ROW 
EXECUTE FUNCTION update_load_status_color();

-- Step 7: Update existing loads with status colors (reduced red usage)
UPDATE public.loads
SET urgency_score = calculate_load_urgency_score(id),
    status_color = CASE
      WHEN status = 'delayed' OR (estimated_delivery < NOW() AND status != 'delivered') THEN '#F97316' -- Orange instead of red
      WHEN status = 'in_transit' THEN '#10B981'
      WHEN status = 'scheduled' THEN '#3B82F6'
      WHEN status = 'pending' THEN '#F59E0B' -- Amber for pending
      WHEN status = 'delivered' OR status = 'completed' THEN '#9CA3AF'
      ELSE '#6B7280'
    END;

-- Step 8: Create index for faster filtering by status and urgency
CREATE INDEX IF NOT EXISTS idx_loads_status_color ON public.loads(status_color);
CREATE INDEX IF NOT EXISTS idx_loads_urgency_score ON public.loads(urgency_score DESC);
CREATE INDEX IF NOT EXISTS idx_loads_status_priority ON public.loads(status, priority, urgency_score DESC);

-- Step 9: Enable Realtime for loads table (if not already enabled)
-- Note: This needs to be done in Supabase Dashboard > Database > Replication
-- But we'll add a comment here for reference
COMMENT ON TABLE public.loads IS 
  'Loads table - Enable Realtime replication in Supabase Dashboard for instant updates';

-- Step 10: Add comments for documentation
COMMENT ON COLUMN public.loads.status_color IS 
  'Hex color code for visual status indication in dispatch board (auto-calculated)';
COMMENT ON COLUMN public.loads.priority IS 
  'Load priority: low, normal, high, urgent';
COMMENT ON COLUMN public.loads.urgency_score IS 
  'Calculated urgency score (0-100) based on time until pickup/delivery and status';

