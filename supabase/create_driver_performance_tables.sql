-- Create Driver Performance Tables
-- Run this in Supabase SQL Editor to fix the "Could not find the table 'public.driver_performance_scores'" error

-- Driver badges/achievements table
CREATE TABLE IF NOT EXISTS public.driver_badges (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  driver_id UUID REFERENCES public.drivers(id) ON DELETE CASCADE NOT NULL,
  badge_type TEXT NOT NULL,
  badge_name TEXT NOT NULL,
  badge_description TEXT,
  earned_date DATE NOT NULL,
  metadata JSONB,
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
  period_type TEXT NOT NULL,
  
  -- Performance metrics
  total_loads INTEGER DEFAULT 0,
  on_time_deliveries INTEGER DEFAULT 0,
  on_time_rate DECIMAL(5, 2) DEFAULT 0,
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
  rank INTEGER,
  
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
COMMENT ON TABLE public.driver_badges IS 'Driver achievements and badges for gamification';
COMMENT ON TABLE public.driver_performance_scores IS 'Driver performance scores for leaderboards and rankings';


