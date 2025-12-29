/**
 * API Service for communicating with TruckMates platform
 */

// Import URL polyfill for React Native compatibility
import 'react-native-url-polyfill/auto'

import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient } from '@supabase/supabase-js'
import { API_BASE_URL, SUPABASE_URL, SUPABASE_ANON_KEY } from '@/constants/config'
import type {
  DeviceRegistrationRequest,
  DeviceRegistrationResponse,
  LocationSyncRequest,
  LogSyncRequest,
  EventSyncRequest,
  APIResponse,
} from '@/types'

// Validate Supabase configuration
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Supabase configuration is missing! Please check config.ts')
  throw new Error('Supabase URL and Anon Key must be configured')
}

// Initialize Supabase client
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})

/**
 * Get authentication token for API requests
 */
async function getAuthToken(): Promise<string | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  return session?.access_token || null
}

/**
 * Make authenticated API request
 */
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<APIResponse<T>> {
  try {
    const token = await getAuthToken()

    if (!token) {
      return {
        success: false,
        error: 'Not authenticated. Please log in.',
      }
    }

    let response: Response
    try {
      response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          ...options.headers,
        },
      })
    } catch (fetchError: any) {
      console.error('API request error:', fetchError)
      return {
        success: false,
        error: fetchError.message || 'Network request failed. Make sure the TruckMates platform server is running.',
      }
    }

    const data = await response.json()

    if (!response.ok) {
      return {
        success: false,
        error: data.error || `HTTP ${response.status}: ${response.statusText}`,
      }
    }

    return {
      success: true,
      data,
      ...data,
    }
  } catch (error: any) {
    console.error('API request error:', error)
    return {
      success: false,
      error: error.message || 'Network error. Please check your connection.',
    }
  }
}

/**
 * Register device with TruckMates platform
 */
export async function registerDevice(
  request: DeviceRegistrationRequest
): Promise<APIResponse<DeviceRegistrationResponse>> {
  return apiRequest<DeviceRegistrationResponse>('/eld/mobile/register', {
    method: 'POST',
    body: JSON.stringify(request),
  })
}

/**
 * Sync GPS locations to platform
 */
export async function syncLocations(
  request: LocationSyncRequest
): Promise<APIResponse> {
  return apiRequest('/eld/mobile/locations', {
    method: 'POST',
    body: JSON.stringify(request),
  })
}

/**
 * Sync HOS logs to platform
 */
export async function syncLogs(request: LogSyncRequest): Promise<APIResponse> {
  return apiRequest('/eld/mobile/logs', {
    method: 'POST',
    body: JSON.stringify(request),
  })
}

/**
 * Sync events/violations to platform
 */
export async function syncEvents(
  request: EventSyncRequest
): Promise<APIResponse> {
  return apiRequest('/eld/mobile/events', {
    method: 'POST',
    body: JSON.stringify(request),
  })
}

/**
 * Authentication helper functions
 */
export const authService = {
  /**
   * Sign in with email and password
   */
  async signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    return { data, error }
  },

  /**
   * Sign out current user
   */
  async signOut() {
    const { error } = await supabase.auth.signOut()
    return { error }
  },

  /**
   * Get current session
   */
  async getSession() {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession()
    return { session, error }
  },

  /**
   * Get current user
   */
  async getUser() {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser()
    return { user, error }
  },
}

