/**
 * Type definitions for TruckMates ELD Mobile App
 */

// ELD Device
export interface ELDDevice {
  id: string
  device_name: string
  device_serial_number: string
  provider: 'truckmates_mobile'
  truck_id?: string
  status: 'active' | 'inactive'
  firmware_version?: string
  last_sync_at?: string
}

// GPS Location
export interface Location {
  timestamp: string
  latitude: number
  longitude: number
  address?: string
  speed?: number // MPH
  heading?: number // 0-360 degrees
  odometer?: number
  engine_status?: 'on' | 'off' | 'idle'
  accuracy?: number // GPS accuracy in meters
}

// HOS Log Entry
export type LogType = 'driving' | 'on_duty' | 'off_duty' | 'sleeper_berth' | 'personal_conveyance' | 'yard_moves'

export interface HOSLog {
  id?: string
  log_date: string // YYYY-MM-DD
  log_type: LogType
  start_time: string // ISO timestamp
  end_time?: string | null // ISO timestamp, null if ongoing
  duration_minutes?: number
  location_start?: {
    lat: number
    lng: number
    address?: string
  }
  location_end?: {
    lat: number
    lng: number
    address?: string
  }
  odometer_start?: number
  odometer_end?: number
  miles_driven?: number
  engine_hours?: number
  violations?: string[]
  notes?: string
  certified?: boolean
  certified_date?: string
}

// ELD Event/Violation
export type EventType =
  | 'hos_violation'
  | 'speeding'
  | 'hard_brake'
  | 'hard_accel'
  | 'device_malfunction'
  | 'other'

export type EventSeverity = 'info' | 'warning' | 'critical'

export interface ELDEvent {
  id?: string
  event_type: EventType
  severity?: EventSeverity
  title: string
  description?: string
  event_time: string // ISO timestamp
  location?: {
    lat: number
    lng: number
    address?: string
  }
  metadata?: Record<string, any>
}

// Driver Status
export interface DriverStatus {
  current_status: LogType
  current_status_start_time: string
  remaining_drive_time_minutes: number
  remaining_on_duty_time_minutes: number
  next_required_break_minutes?: number
  violations: ELDEvent[]
}

// API Response Types
export interface APIResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

// Device Registration
export interface DeviceRegistrationRequest {
  device_name: string
  device_serial_number: string
  truck_id?: string
  app_version?: string
  device_info?: {
    model: string
    os: string
    os_version: string
    app_version: string
  }
}

export interface DeviceRegistrationResponse {
  success: boolean
  device_id: string
  device: {
    id: string
    device_name: string
    device_serial_number: string
    status: string
  }
  message?: string
}

// Sync Requests
export interface LocationSyncRequest {
  device_id: string
  locations: Location[]
}

export interface LogSyncRequest {
  device_id: string
  logs: HOSLog[]
}

export interface EventSyncRequest {
  device_id: string
  events: ELDEvent[]
}

export interface DVIRSyncRequest {
  device_id: string
  dvirs: DVIR[]
}

// DVIR (Daily Vehicle Inspection Report)
export type InspectionType = 'pre_trip' | 'post_trip' | 'on_road'
export type DVIRStatus = 'pending' | 'passed' | 'failed' | 'defects_corrected'
export type DefectSeverity = 'minor' | 'major' | 'critical'

export interface DVIRDefect {
  component: string
  description: string
  severity: DefectSeverity
  corrected?: boolean
}

export interface DVIR {
  id?: string
  driver_id?: string
  truck_id?: string
  inspection_type: InspectionType
  inspection_date: string // YYYY-MM-DD
  inspection_time?: string // HH:mm
  location?: string
  mileage?: number
  odometer_reading?: number
  status: DVIRStatus
  defects_found: boolean
  safe_to_operate: boolean
  defects?: DVIRDefect[]
  notes?: string
  corrective_action?: string
  driver_signature?: string
  driver_signature_date?: string
  certified?: boolean
  created_at?: string
  updated_at?: string
}

export interface DVIRSyncRequest {
  device_id: string
  dvirs: DVIR[]
}

