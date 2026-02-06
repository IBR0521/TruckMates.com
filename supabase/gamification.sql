-- ============================================================================
-- Driver Gamification and Scoring System
-- Performance scoring, badges, and achievements
-- ============================================================================

-- Driver badges/achievements table
CREATE TABLE IF NOT EXISTS public.driver_badges (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  driver_id UUID REFERENCES public.drivers(id) ON DELETE CASCADE NOT NULL,
  badge_type TEXT NOT NULL, -- 'zero_violations_30', 'on_time_champion', 'safety_star', etc.
  badge_name TEXT NOT NULL,
  badge_description TEXT,
  earned_date DATE NOT NULL,
  metadata JSONB, -- Additional context (e.g., streak count, achievement details)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  UNIQUE(driver_id, badge_type, earned_date)
);

-- Driver performance scores table (snapshot for leaderboards)
CREATE TABLE IF NOT EXISTS public.driver_performance_scores (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  driver_id UUID REFERENCES public.drivers(id) ON DELETE CASCADE NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  period_type TEXT NOT NULL, -- 'weekly', 'monthly', 'yearly'
  
  -- Performance metrics
  total_loads INTEGER DEFAULT 0,
  on_time_deliveries INTEGER DEFAULT 0,
  on_time_rate DECIMAL(5, 2) DEFAULT 0, -- Percentage
  total_miles DECIMAL(10, 2) DEFAULT 0,
  total_driving_hours DECIMAL(5, 2) DEFAULT 0,
  idle_time_hours DECIMAL(5, 2) DEFAULT 0,
  
  -- Safety metrics
  violations_count INTEGER DEFAULT 0,
  hos_violations INTEGER DEFAULT 0,
  speeding_events INTEGER DEFAULT 0,
  hard_braking INTEGER DEFAULT 0,
  
  -- Scores (0-100)
  safety_score DECIMAL(5, 2) DEFAULT 0,
  compliance_score DECIMAL(5, 2) DEFAULT 0,
  efficiency_score DECIMAL(5, 2) DEFAULT 0,
  overall_score DECIMAL(5, 2) DEFAULT 0,
  
  -- Ranking
  rank INTEGER, -- Rank among all drivers for this period
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  
  UNIQUE(driver_id, period_start, period_end, period_type)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_driver_badges_driver_id ON public.driver_badges(driver_id);
CREATE INDEX IF NOT EXISTS idx_driver_badges_company_id ON public.driver_badges(company_id);
CREATE INDEX IF NOT EXISTS idx_driver_badges_badge_type ON public.driver_badges(badge_type);
CREATE INDEX IF NOT EXISTS idx_driver_performance_scores_driver_id ON public.driver_performance_scores(driver_id);
CREATE INDEX IF NOT EXISTS idx_driver_performance_scores_period ON public.driver_performance_scores(period_start, period_end, period_type);
CREATE INDEX IF NOT EXISTS idx_driver_performance_scores_overall_score ON public.driver_performance_scores(overall_score DESC);

-- Function to calculate and store driver performance score
CREATE OR REPLACE FUNCTION calculate_driver_performance_score(
  p_driver_id UUID,
  p_period_start DATE,
  p_period_end DATE,
  p_period_type TEXT DEFAULT 'monthly'
)
RETURNS UUID AS $$
DECLARE
  v_company_id UUID;
  v_score_id UUID;
  v_total_loads INTEGER;
  v_on_time_deliveries INTEGER;
  v_on_time_rate DECIMAL(5, 2);
  v_total_miles DECIMAL(10, 2);
  v_total_driving_hours DECIMAL(5, 2);
  v_idle_time_hours DECIMAL(5, 2);
  v_violations_count INTEGER;
  v_hos_violations INTEGER;
  v_speeding_events INTEGER;
  v_hard_braking INTEGER;
  v_safety_score DECIMAL(5, 2);
  v_compliance_score DECIMAL(5, 2);
  v_efficiency_score DECIMAL(5, 2);
  v_overall_score DECIMAL(5, 2);
BEGIN
  -- Get company_id
  SELECT company_id INTO v_company_id
  FROM public.drivers
  WHERE id = p_driver_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Driver not found';
  END IF;
  
  -- Calculate metrics from loads
  SELECT 
    COUNT(*),
    COUNT(*) FILTER (WHERE status = 'delivered' AND actual_delivery <= estimated_delivery),
    COALESCE(SUM(estimated_miles), 0)
  INTO v_total_loads, v_on_time_deliveries, v_total_miles
  FROM public.loads
  WHERE driver_id = p_driver_id
    AND load_date >= p_period_start
    AND load_date <= p_period_end;
  
  v_on_time_rate := CASE 
    WHEN v_total_loads > 0 THEN (v_on_time_deliveries::DECIMAL / v_total_loads) * 100
    ELSE 0
  END;
  
  -- Calculate driving hours from ELD logs
  SELECT COALESCE(SUM(duration_minutes), 0) / 60.0
  INTO v_total_driving_hours
  FROM public.eld_logs
  WHERE driver_id = p_driver_id
    AND log_type = 'driving'
    AND log_date >= p_period_start
    AND log_date <= p_period_end;
  
  -- Calculate idle time (simplified - time spent in zones beyond threshold)
  SELECT COALESCE(SUM(detention_minutes), 0) / 60.0
  INTO v_idle_time_hours
  FROM public.detention_tracking
  WHERE driver_id = p_driver_id
    AND entry_timestamp >= p_period_start
    AND entry_timestamp <= p_period_end;
  
  -- Get violations
  SELECT 
    COUNT(*),
    COUNT(*) FILTER (WHERE event_type = 'hos_violation'),
    COUNT(*) FILTER (WHERE event_type = 'speeding'),
    COUNT(*) FILTER (WHERE event_type = 'hard_brake')
  INTO v_violations_count, v_hos_violations, v_speeding_events, v_hard_braking
  FROM public.eld_events
  WHERE driver_id = p_driver_id
    AND event_time >= p_period_start
    AND event_time <= p_period_end;
  
  -- Calculate scores (0-100)
  -- Safety score: Based on violations
  v_safety_score := GREATEST(0, 100 - (v_violations_count * 10) - (v_speeding_events * 5) - (v_hard_braking * 3));
  
  -- Compliance score: Based on HOS violations
  v_compliance_score := GREATEST(0, 100 - (v_hos_violations * 15));
  
  -- Efficiency score: Based on on-time rate and miles
  v_efficiency_score := (v_on_time_rate * 0.7) + LEAST(30, (v_total_miles / 1000) * 3);
  
  -- Overall score: Weighted average
  v_overall_score := (v_safety_score * 0.4) + (v_compliance_score * 0.3) + (v_efficiency_score * 0.3);
  
  -- Insert or update score
  INSERT INTO public.driver_performance_scores (
    company_id,
    driver_id,
    period_start,
    period_end,
    period_type,
    total_loads,
    on_time_deliveries,
    on_time_rate,
    total_miles,
    total_driving_hours,
    idle_time_hours,
    violations_count,
    hos_violations,
    speeding_events,
    hard_braking,
    safety_score,
    compliance_score,
    efficiency_score,
    overall_score
  ) VALUES (
    v_company_id,
    p_driver_id,
    p_period_start,
    p_period_end,
    p_period_type,
    v_total_loads,
    v_on_time_deliveries,
    v_on_time_rate,
    v_total_miles,
    v_total_driving_hours,
    v_idle_time_hours,
    v_violations_count,
    v_hos_violations,
    v_speeding_events,
    v_hard_braking,
    v_safety_score,
    v_compliance_score,
    v_efficiency_score,
    v_overall_score
  )
  ON CONFLICT (driver_id, period_start, period_end, period_type)
  DO UPDATE SET
    total_loads = EXCLUDED.total_loads,
    on_time_deliveries = EXCLUDED.on_time_deliveries,
    on_time_rate = EXCLUDED.on_time_rate,
    total_miles = EXCLUDED.total_miles,
    total_driving_hours = EXCLUDED.total_driving_hours,
    idle_time_hours = EXCLUDED.idle_time_hours,
    violations_count = EXCLUDED.violations_count,
    hos_violations = EXCLUDED.hos_violations,
    speeding_events = EXCLUDED.speeding_events,
    hard_braking = EXCLUDED.hard_braking,
    safety_score = EXCLUDED.safety_score,
    compliance_score = EXCLUDED.compliance_score,
    efficiency_score = EXCLUDED.efficiency_score,
    overall_score = EXCLUDED.overall_score,
    updated_at = NOW()
  RETURNING id INTO v_score_id;
  
  -- Update rankings
  UPDATE public.driver_performance_scores
  SET rank = subquery.rank
  FROM (
    SELECT 
      id,
      ROW_NUMBER() OVER (ORDER BY overall_score DESC) as rank
    FROM public.driver_performance_scores
    WHERE period_start = p_period_start
      AND period_end = p_period_end
      AND period_type = p_period_type
      AND company_id = v_company_id
  ) subquery
  WHERE driver_performance_scores.id = subquery.id;
  
  RETURN v_score_id;
END;
$$ LANGUAGE plpgsql;

-- Function to check and award badges
CREATE OR REPLACE FUNCTION check_and_award_badges(
  p_driver_id UUID,
  p_period_start DATE DEFAULT CURRENT_DATE - INTERVAL '30 days',
  p_period_end DATE DEFAULT CURRENT_DATE
)
RETURNS INTEGER AS $$
DECLARE
  v_company_id UUID;
  v_badges_awarded INTEGER := 0;
  v_hos_violations INTEGER;
  v_on_time_rate DECIMAL(5, 2);
  v_safety_score DECIMAL(5, 2);
  v_streak_days INTEGER;
BEGIN
  -- Get company_id
  SELECT company_id INTO v_company_id
  FROM public.drivers
  WHERE id = p_driver_id;
  
  IF NOT FOUND THEN
    RETURN 0;
  END IF;
  
  -- Check for Zero Violations badge (30 days)
  SELECT COUNT(*) INTO v_hos_violations
  FROM public.eld_events
  WHERE driver_id = p_driver_id
    AND event_type = 'hos_violation'
    AND event_time >= p_period_start
    AND event_time <= p_period_end;
  
  IF v_hos_violations = 0 THEN
    INSERT INTO public.driver_badges (
      company_id,
      driver_id,
      badge_type,
      badge_name,
      badge_description,
      earned_date
    ) VALUES (
      v_company_id,
      p_driver_id,
      'zero_violations_30',
      'Zero Violations',
      'No HOS violations for 30 days',
      CURRENT_DATE
    )
    ON CONFLICT (driver_id, badge_type, earned_date) DO NOTHING;
    
    IF FOUND THEN
      v_badges_awarded := v_badges_awarded + 1;
    END IF;
  END IF;
  
  -- Check for On-Time Champion badge (95%+ on-time rate)
  SELECT on_time_rate INTO v_on_time_rate
  FROM public.driver_performance_scores
  WHERE driver_id = p_driver_id
    AND period_start >= p_period_start
    AND period_end <= p_period_end
  ORDER BY overall_score DESC
  LIMIT 1;
  
  IF v_on_time_rate >= 95 THEN
    INSERT INTO public.driver_badges (
      company_id,
      driver_id,
      badge_type,
      badge_name,
      badge_description,
      earned_date
    ) VALUES (
      v_company_id,
      p_driver_id,
      'on_time_champion',
      'On-Time Champion',
      '95%+ on-time delivery rate',
      CURRENT_DATE
    )
    ON CONFLICT (driver_id, badge_type, earned_date) DO NOTHING;
    
    IF FOUND THEN
      v_badges_awarded := v_badges_awarded + 1;
    END IF;
  END IF;
  
  -- Check for Safety Star badge (90+ safety score)
  SELECT safety_score INTO v_safety_score
  FROM public.driver_performance_scores
  WHERE driver_id = p_driver_id
    AND period_start >= p_period_start
    AND period_end <= p_period_end
  ORDER BY safety_score DESC
  LIMIT 1;
  
  IF v_safety_score >= 90 THEN
    INSERT INTO public.driver_badges (
      company_id,
      driver_id,
      badge_type,
      badge_name,
      badge_description,
      earned_date
    ) VALUES (
      v_company_id,
      p_driver_id,
      'safety_star',
      'Safety Star',
      '90+ safety score',
      CURRENT_DATE
    )
    ON CONFLICT (driver_id, badge_type, earned_date) DO NOTHING;
    
    IF FOUND THEN
      v_badges_awarded := v_badges_awarded + 1;
    END IF;
  END IF;
  
  RETURN v_badges_awarded;
END;
$$ LANGUAGE plpgsql;

-- Enable RLS
ALTER TABLE public.driver_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_performance_scores ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "Users can view driver badges from their company" ON public.driver_badges;
CREATE POLICY "Users can view driver badges from their company"
  ON public.driver_badges
  FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can view performance scores from their company" ON public.driver_performance_scores;
CREATE POLICY "Users can view performance scores from their company"
  ON public.driver_performance_scores
  FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM public.users WHERE id = auth.uid()
    )
  );

-- Add comments
COMMENT ON TABLE public.driver_badges IS 
  'Driver achievements and badges for gamification';
COMMENT ON TABLE public.driver_performance_scores IS 
  'Driver performance scores for leaderboards and rankings';

