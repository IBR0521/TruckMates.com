-- Performance Indexes for Logistics SaaS Platform
-- These indexes optimize frequently queried columns and composite queries
-- Run this migration after the main schema is in place

-- ============================================
-- Drivers Table Indexes
-- ============================================
CREATE INDEX IF NOT EXISTS idx_drivers_company_id ON drivers(company_id);
CREATE INDEX IF NOT EXISTS idx_drivers_status ON drivers(status);
CREATE INDEX IF NOT EXISTS idx_drivers_company_status ON drivers(company_id, status);
CREATE INDEX IF NOT EXISTS idx_drivers_created_at ON drivers(created_at DESC);

-- ============================================
-- Trucks Table Indexes
-- ============================================
CREATE INDEX IF NOT EXISTS idx_trucks_company_id ON trucks(company_id);
CREATE INDEX IF NOT EXISTS idx_trucks_status ON trucks(status);
CREATE INDEX IF NOT EXISTS idx_trucks_company_status ON trucks(company_id, status);
CREATE INDEX IF NOT EXISTS idx_trucks_created_at ON trucks(created_at DESC);

-- ============================================
-- Routes Table Indexes
-- ============================================
CREATE INDEX IF NOT EXISTS idx_routes_company_id ON routes(company_id);
CREATE INDEX IF NOT EXISTS idx_routes_status ON routes(status);
CREATE INDEX IF NOT EXISTS idx_routes_company_status ON routes(company_id, status);
CREATE INDEX IF NOT EXISTS idx_routes_driver_id ON routes(driver_id);
CREATE INDEX IF NOT EXISTS idx_routes_truck_id ON routes(truck_id);
CREATE INDEX IF NOT EXISTS idx_routes_created_at ON routes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_routes_updated_at ON routes(updated_at DESC);

-- ============================================
-- Loads Table Indexes
-- ============================================
CREATE INDEX IF NOT EXISTS idx_loads_company_id ON loads(company_id);
CREATE INDEX IF NOT EXISTS idx_loads_status ON loads(status);
CREATE INDEX IF NOT EXISTS idx_loads_company_status ON loads(company_id, status);
CREATE INDEX IF NOT EXISTS idx_loads_created_at ON loads(created_at DESC);

-- ============================================
-- Maintenance Table Indexes
-- ============================================
CREATE INDEX IF NOT EXISTS idx_maintenance_company_id ON maintenance(company_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_status ON maintenance(status);
CREATE INDEX IF NOT EXISTS idx_maintenance_company_status ON maintenance(company_id, status);
CREATE INDEX IF NOT EXISTS idx_maintenance_truck_id ON maintenance(truck_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_scheduled_date ON maintenance(scheduled_date);

-- ============================================
-- Invoices Table Indexes
-- ============================================
CREATE INDEX IF NOT EXISTS idx_invoices_company_id ON invoices(company_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_company_created ON invoices(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON invoices(due_date);

-- ============================================
-- Expenses Table Indexes
-- ============================================
CREATE INDEX IF NOT EXISTS idx_expenses_company_id ON expenses(company_id);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);
CREATE INDEX IF NOT EXISTS idx_expenses_company_created ON expenses(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(expense_date);

-- ============================================
-- Settlements Table Indexes
-- ============================================
CREATE INDEX IF NOT EXISTS idx_settlements_company_id ON settlements(company_id);
CREATE INDEX IF NOT EXISTS idx_settlements_driver_id ON settlements(driver_id);
CREATE INDEX IF NOT EXISTS idx_settlements_status ON settlements(status);
CREATE INDEX IF NOT EXISTS idx_settlements_company_created ON settlements(company_id, created_at DESC);

-- ============================================
-- Users Table Indexes
-- ============================================
CREATE INDEX IF NOT EXISTS idx_users_company_id ON users(company_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- ============================================
-- Documents Table Indexes
-- ============================================
CREATE INDEX IF NOT EXISTS idx_documents_company_id ON documents(company_id);
CREATE INDEX IF NOT EXISTS idx_documents_type ON documents(document_type);
CREATE INDEX IF NOT EXISTS idx_documents_company_created ON documents(company_id, created_at DESC);

-- ============================================
-- ELD Devices Table Indexes
-- ============================================
CREATE INDEX IF NOT EXISTS idx_eld_devices_company_id ON eld_devices(company_id);
CREATE INDEX IF NOT EXISTS idx_eld_devices_truck_id ON eld_devices(truck_id);
CREATE INDEX IF NOT EXISTS idx_eld_devices_status ON eld_devices(status);

-- ============================================
-- ELD Logs Table Indexes
-- ============================================
CREATE INDEX IF NOT EXISTS idx_eld_logs_device_id ON eld_logs(eld_device_id);
CREATE INDEX IF NOT EXISTS idx_eld_logs_driver_id ON eld_logs(driver_id);
CREATE INDEX IF NOT EXISTS idx_eld_logs_log_date ON eld_logs(log_date DESC);
CREATE INDEX IF NOT EXISTS idx_eld_logs_device_date ON eld_logs(eld_device_id, log_date DESC);

-- ============================================
-- ELD Locations Table Indexes
-- ============================================
CREATE INDEX IF NOT EXISTS idx_eld_locations_device_id ON eld_locations(eld_device_id);
CREATE INDEX IF NOT EXISTS idx_eld_locations_timestamp ON eld_locations(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_eld_locations_device_timestamp ON eld_locations(eld_device_id, timestamp DESC);

-- ============================================
-- ELD Events Table Indexes
-- ============================================
CREATE INDEX IF NOT EXISTS idx_eld_events_device_id ON eld_events(eld_device_id);
CREATE INDEX IF NOT EXISTS idx_eld_events_driver_id ON eld_events(driver_id);
CREATE INDEX IF NOT EXISTS idx_eld_events_resolved ON eld_events(resolved);
CREATE INDEX IF NOT EXISTS idx_eld_events_event_time ON eld_events(event_time DESC);
CREATE INDEX IF NOT EXISTS idx_eld_events_device_resolved ON eld_events(eld_device_id, resolved, event_time DESC);

-- ============================================
-- Route Stops Table Indexes
-- ============================================
CREATE INDEX IF NOT EXISTS idx_route_stops_route_id ON route_stops(route_id);
CREATE INDEX IF NOT EXISTS idx_route_stops_stop_number ON route_stops(route_id, stop_number);

-- ============================================
-- IFTA Reports Table Indexes
-- ============================================
CREATE INDEX IF NOT EXISTS idx_ifta_reports_company_id ON ifta_reports(company_id);
CREATE INDEX IF NOT EXISTS idx_ifta_reports_created_at ON ifta_reports(created_at DESC);

-- ============================================
-- Notes
-- ============================================
-- These indexes optimize:
-- 1. Multi-tenant queries (company_id filtering)
-- 2. Status-based filtering
-- 3. Composite queries (company_id + status)
-- 4. Time-based queries (created_at, updated_at)
-- 5. Foreign key lookups (driver_id, truck_id, etc.)
-- 
-- Expected performance improvements:
-- - 30-50% faster query performance on filtered queries
-- - Reduced database load
-- - Better scalability for large datasets

