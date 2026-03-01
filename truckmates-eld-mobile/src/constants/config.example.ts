/**
 * App configuration constants - EXAMPLE FILE
 * Copy this to config.ts and fill in your values
 * Add config.ts to .gitignore to prevent committing secrets
 */

// API Configuration
export const API_BASE_URL =
  process.env.API_BASE_URL || 'http://localhost:3000/api'

// Supabase Configuration
// IMPORTANT: These should come from environment variables or build-time injection
// DO NOT commit actual values to git
export const SUPABASE_URL = process.env.SUPABASE_URL || 'YOUR_SUPABASE_URL_HERE'
export const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY_HERE'

// Location Tracking
export const LOCATION_UPDATE_INTERVAL = 30000 // 30 seconds
export const LOCATION_ACCURACY = 'high' as const
export const ENABLE_BACKGROUND_TRACKING = true

// Sync Configuration
export const SYNC_INTERVAL = 60000 // 1 minute
export const OFFLINE_QUEUE_SIZE = 1000
export const BATCH_SIZE = 50 // Max items to sync per batch

// HOS Rules (Hours of Service)
export const HOS_RULES = {
  MAX_DRIVE_TIME_HOURS: 11, // Maximum continuous driving time
  MAX_ON_DUTY_TIME_HOURS: 14, // Maximum on-duty time before break required
  REQUIRED_BREAK_HOURS: 0.5, // 30-minute break required after 8 hours
  REQUIRED_REST_HOURS: 10, // Minimum rest period
  MAX_ON_DUTY_DAILY_HOURS: 14, // Maximum on-duty hours in a day
  MAX_ON_DUTY_WEEKLY_HOURS: 70, // Maximum on-duty hours in 7 days
}

// Violation Thresholds
export const VIOLATION_THRESHOLDS = {
  SPEEDING_MPH: 75, // Speed limit threshold (minimum floor, not override)
  HARD_BRAKE_G_FORCE: -0.7, // g-force for hard brake detection
  HARD_ACCEL_G_FORCE: 0.5, // g-force for hard acceleration detection
}

// Storage Keys
export const STORAGE_KEYS = {
  DEVICE_ID: '@eld/device_id',
  DEVICE_SERIAL: '@eld/device_serial',
  DRIVER_ID: '@eld/driver_id',
  TRUCK_ID: '@eld/truck_id',
  CURRENT_STATUS: '@eld/current_status',
  PENDING_LOCATIONS: '@eld/pending_locations',
  PENDING_LOGS: '@eld/pending_logs',
  PENDING_EVENTS: '@eld/pending_events',
  PENDING_DVIRS: '@eld/pending_dvirs',
  LAST_SYNC: '@eld/last_sync',
}

// App Info
export const APP_INFO = {
  NAME: 'TruckMates ELD',
  VERSION: process.env.APP_VERSION || '1.0.0',
}

