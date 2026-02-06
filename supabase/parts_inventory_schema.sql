-- Parts Inventory System Schema
-- This script creates tables for parts inventory management

-- Parts table
CREATE TABLE IF NOT EXISTS parts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  part_number TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT, -- 'engine', 'tires', 'brakes', 'electrical', 'body', 'other'
  manufacturer TEXT,
  cost DECIMAL(10,2) DEFAULT 0,
  quantity INTEGER DEFAULT 0,
  min_quantity INTEGER DEFAULT 0, -- Reorder threshold
  location TEXT, -- Warehouse location, shelf, bin, etc.
  supplier TEXT,
  supplier_part_number TEXT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(company_id, part_number)
);

-- Part usage tracking (links parts to maintenance records)
CREATE TABLE IF NOT EXISTS part_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  part_id UUID NOT NULL REFERENCES parts(id) ON DELETE CASCADE,
  maintenance_id UUID REFERENCES maintenance(id) ON DELETE SET NULL,
  quantity_used INTEGER NOT NULL DEFAULT 1,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Part orders (reorder management)
CREATE TABLE IF NOT EXISTS part_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  part_id UUID NOT NULL REFERENCES parts(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL,
  order_date DATE NOT NULL DEFAULT CURRENT_DATE,
  expected_date DATE,
  received_date DATE,
  status TEXT DEFAULT 'pending', -- 'pending', 'ordered', 'received', 'cancelled'
  supplier TEXT,
  supplier_order_number TEXT,
  cost_per_unit DECIMAL(10,2),
  total_cost DECIMAL(10,2),
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_parts_company_id ON parts(company_id);
CREATE INDEX IF NOT EXISTS idx_parts_category ON parts(category);
CREATE INDEX IF NOT EXISTS idx_parts_part_number ON parts(part_number);
CREATE INDEX IF NOT EXISTS idx_part_usage_part_id ON part_usage(part_id);
CREATE INDEX IF NOT EXISTS idx_part_usage_maintenance_id ON part_usage(maintenance_id);
CREATE INDEX IF NOT EXISTS idx_part_orders_part_id ON part_orders(part_id);
CREATE INDEX IF NOT EXISTS idx_part_orders_status ON part_orders(status);

-- RLS Policies
ALTER TABLE parts ENABLE ROW LEVEL SECURITY;
ALTER TABLE part_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE part_orders ENABLE ROW LEVEL SECURITY;

-- Parts policies
DROP POLICY IF EXISTS "Users can view parts in their company" ON parts;
CREATE POLICY "Users can view parts in their company" ON parts
  FOR SELECT USING (
    company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can insert parts in their company" ON parts;
CREATE POLICY "Users can insert parts in their company" ON parts
  FOR INSERT WITH CHECK (
    company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can update parts in their company" ON parts;
CREATE POLICY "Users can update parts in their company" ON parts
  FOR UPDATE USING (
    company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can delete parts in their company" ON parts;
CREATE POLICY "Users can delete parts in their company" ON parts
  FOR DELETE USING (
    company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
  );

-- Part usage policies
DROP POLICY IF EXISTS "Users can view part usage in their company" ON part_usage;
CREATE POLICY "Users can view part usage in their company" ON part_usage
  FOR SELECT USING (
    company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can insert part usage in their company" ON part_usage;
CREATE POLICY "Users can insert part usage in their company" ON part_usage
  FOR INSERT WITH CHECK (
    company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can update part usage in their company" ON part_usage;
CREATE POLICY "Users can update part usage in their company" ON part_usage
  FOR UPDATE USING (
    company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can delete part usage in their company" ON part_usage;
CREATE POLICY "Users can delete part usage in their company" ON part_usage
  FOR DELETE USING (
    company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
  );

-- Part orders policies
DROP POLICY IF EXISTS "Users can view part orders in their company" ON part_orders;
CREATE POLICY "Users can view part orders in their company" ON part_orders
  FOR SELECT USING (
    company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can insert part orders in their company" ON part_orders;
CREATE POLICY "Users can insert part orders in their company" ON part_orders
  FOR INSERT WITH CHECK (
    company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can update part orders in their company" ON part_orders;
CREATE POLICY "Users can update part orders in their company" ON part_orders
  FOR UPDATE USING (
    company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can delete part orders in their company" ON part_orders;
CREATE POLICY "Users can delete part orders in their company" ON part_orders
  FOR DELETE USING (
    company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
  );

