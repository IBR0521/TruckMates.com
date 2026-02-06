-- Tax and Fuel Reconciliation Schema for IFTA Reporting
-- This script creates tables for tracking fuel purchases and tax reconciliation

-- Fuel purchases table
CREATE TABLE IF NOT EXISTS fuel_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  truck_id UUID REFERENCES trucks(id) ON DELETE SET NULL,
  driver_id UUID REFERENCES drivers(id) ON DELETE SET NULL,
  purchase_date DATE NOT NULL,
  state TEXT NOT NULL, -- State where fuel was purchased
  city TEXT,
  station_name TEXT,
  gallons DECIMAL(10, 2) NOT NULL,
  price_per_gallon DECIMAL(10, 4) NOT NULL,
  total_cost DECIMAL(10, 2) NOT NULL,
  odometer_reading INTEGER,
  receipt_number TEXT,
  receipt_url TEXT, -- Link to uploaded receipt
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- IFTA quarterly reports table
CREATE TABLE IF NOT EXISTS ifta_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  quarter INTEGER NOT NULL CHECK (quarter >= 1 AND quarter <= 4),
  year INTEGER NOT NULL,
  status TEXT DEFAULT 'draft', -- 'draft', 'submitted', 'approved', 'rejected'
  total_miles DECIMAL(12, 2) DEFAULT 0,
  total_gallons DECIMAL(12, 2) DEFAULT 0,
  total_tax_due DECIMAL(10, 2) DEFAULT 0,
  total_tax_paid DECIMAL(10, 2) DEFAULT 0,
  net_tax_due DECIMAL(10, 2) DEFAULT 0,
  submitted_at TIMESTAMP,
  approved_at TIMESTAMP,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(company_id, quarter, year)
);

-- IFTA state-by-state breakdown
CREATE TABLE IF NOT EXISTS ifta_state_breakdown (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ifta_report_id UUID NOT NULL REFERENCES ifta_reports(id) ON DELETE CASCADE,
  state TEXT NOT NULL,
  miles DECIMAL(12, 2) DEFAULT 0,
  gallons DECIMAL(12, 2) DEFAULT 0,
  tax_rate DECIMAL(6, 4) DEFAULT 0, -- Tax rate per gallon for this state
  tax_due DECIMAL(10, 2) DEFAULT 0,
  tax_paid DECIMAL(10, 2) DEFAULT 0,
  net_tax_due DECIMAL(10, 2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(ifta_report_id, state)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_fuel_purchases_company_id ON fuel_purchases(company_id);
CREATE INDEX IF NOT EXISTS idx_fuel_purchases_purchase_date ON fuel_purchases(purchase_date);
CREATE INDEX IF NOT EXISTS idx_fuel_purchases_state ON fuel_purchases(state);
CREATE INDEX IF NOT EXISTS idx_fuel_purchases_truck_id ON fuel_purchases(truck_id);
CREATE INDEX IF NOT EXISTS idx_ifta_reports_company_id ON ifta_reports(company_id);
CREATE INDEX IF NOT EXISTS idx_ifta_reports_quarter_year ON ifta_reports(quarter, year);
CREATE INDEX IF NOT EXISTS idx_ifta_state_breakdown_report_id ON ifta_state_breakdown(ifta_report_id);
CREATE INDEX IF NOT EXISTS idx_ifta_state_breakdown_state ON ifta_state_breakdown(state);

-- RLS Policies
ALTER TABLE fuel_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE ifta_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE ifta_state_breakdown ENABLE ROW LEVEL SECURITY;

-- Fuel purchases policies
DROP POLICY IF EXISTS "Users can view fuel purchases in their company" ON fuel_purchases;
CREATE POLICY "Users can view fuel purchases in their company" ON fuel_purchases
  FOR SELECT USING (
    company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can insert fuel purchases in their company" ON fuel_purchases;
CREATE POLICY "Users can insert fuel purchases in their company" ON fuel_purchases
  FOR INSERT WITH CHECK (
    company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can update fuel purchases in their company" ON fuel_purchases;
CREATE POLICY "Users can update fuel purchases in their company" ON fuel_purchases
  FOR UPDATE USING (
    company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can delete fuel purchases in their company" ON fuel_purchases;
CREATE POLICY "Users can delete fuel purchases in their company" ON fuel_purchases
  FOR DELETE USING (
    company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
  );

-- IFTA reports policies
DROP POLICY IF EXISTS "Users can view IFTA reports in their company" ON ifta_reports;
CREATE POLICY "Users can view IFTA reports in their company" ON ifta_reports
  FOR SELECT USING (
    company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can insert IFTA reports in their company" ON ifta_reports;
CREATE POLICY "Users can insert IFTA reports in their company" ON ifta_reports
  FOR INSERT WITH CHECK (
    company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can update IFTA reports in their company" ON ifta_reports;
CREATE POLICY "Users can update IFTA reports in their company" ON ifta_reports
  FOR UPDATE USING (
    company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can delete IFTA reports in their company" ON ifta_reports;
CREATE POLICY "Users can delete IFTA reports in their company" ON ifta_reports
  FOR DELETE USING (
    company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
  );

-- IFTA state breakdown policies
DROP POLICY IF EXISTS "Users can view IFTA state breakdown in their company" ON ifta_state_breakdown;
CREATE POLICY "Users can view IFTA state breakdown in their company" ON ifta_state_breakdown
  FOR SELECT USING (
    ifta_report_id IN (SELECT id FROM ifta_reports WHERE company_id IN (SELECT company_id FROM users WHERE id = auth.uid()))
  );

DROP POLICY IF EXISTS "Users can insert IFTA state breakdown in their company" ON ifta_state_breakdown;
CREATE POLICY "Users can insert IFTA state breakdown in their company" ON ifta_state_breakdown
  FOR INSERT WITH CHECK (
    ifta_report_id IN (SELECT id FROM ifta_reports WHERE company_id IN (SELECT company_id FROM users WHERE id = auth.uid()))
  );

DROP POLICY IF EXISTS "Users can update IFTA state breakdown in their company" ON ifta_state_breakdown;
CREATE POLICY "Users can update IFTA state breakdown in their company" ON ifta_state_breakdown
  FOR UPDATE USING (
    ifta_report_id IN (SELECT id FROM ifta_reports WHERE company_id IN (SELECT company_id FROM users WHERE id = auth.uid()))
  );

DROP POLICY IF EXISTS "Users can delete IFTA state breakdown in their company" ON ifta_state_breakdown;
CREATE POLICY "Users can delete IFTA state breakdown in their company" ON ifta_state_breakdown
  FOR DELETE USING (
    ifta_report_id IN (SELECT id FROM ifta_reports WHERE company_id IN (SELECT company_id FROM users WHERE id = auth.uid()))
  );

