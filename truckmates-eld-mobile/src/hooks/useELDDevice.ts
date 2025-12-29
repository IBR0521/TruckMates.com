/**
 * Hook for managing ELD device registration and status
 */

import { useState, useEffect } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Platform } from 'react-native'
import DeviceInfo from 'react-native-device-info'
import { registerDevice } from '@/services/api'
import { STORAGE_KEYS } from '@/constants/config'
import type { ELDDevice, DeviceRegistrationRequest } from '@/types'

export interface UseELDDeviceReturn {
  device: ELDDevice | null
  deviceId: string | null
  isLoading: boolean
  isRegistered: boolean
  error: string | null
  register: (deviceName: string, truckId?: string) => Promise<boolean>
  refreshDevice: () => Promise<void>
}

export function useELDDevice(): UseELDDeviceReturn {
  const [device, setDevice] = useState<ELDDevice | null>(null)
  const [deviceId, setDeviceId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Load device ID from storage on mount
  useEffect(() => {
    loadDeviceId()
  }, [])

  async function loadDeviceId() {
    try {
      const storedDeviceId = await AsyncStorage.getItem(STORAGE_KEYS.DEVICE_ID)
      const storedSerial = await AsyncStorage.getItem(STORAGE_KEYS.DEVICE_SERIAL)

      if (storedDeviceId && storedSerial) {
        setDeviceId(storedDeviceId)
        // Create device object from stored data
        setDevice({
          id: storedDeviceId,
          device_serial_number: storedSerial,
          device_name: (await AsyncStorage.getItem('@eld/device_name')) || 'Mobile Device',
          provider: 'truckmates_mobile',
          status: 'active',
        } as ELDDevice)
      }
      setIsLoading(false)
    } catch (err: any) {
      console.error('Error loading device ID:', err)
      setError(err.message)
      setIsLoading(false)
    }
  }

  async function register(deviceName: string, truckId?: string): Promise<boolean> {
    try {
      setIsLoading(true)
      setError(null)

      // Generate unique device serial number
      const deviceSerial = await getDeviceSerial()

      // Get device info
      const deviceInfo = {
        model: DeviceInfo.getModel(),
        os: Platform.OS,
        os_version: Platform.Version.toString(),
        app_version: DeviceInfo.getVersion(),
      }

      const request: DeviceRegistrationRequest = {
        device_name: deviceName,
        device_serial_number: deviceSerial,
        truck_id: truckId,
        app_version: DeviceInfo.getVersion(),
        device_info: deviceInfo,
      }

      const response = await registerDevice(request)

      if (!response.success || !response.data) {
        setError(response.error || 'Failed to register device')
        return false
      }

      // Store device info
      const registeredDevice = response.data.device
      await AsyncStorage.setItem(STORAGE_KEYS.DEVICE_ID, registeredDevice.id)
      await AsyncStorage.setItem(
        STORAGE_KEYS.DEVICE_SERIAL,
        registeredDevice.device_serial_number
      )
      await AsyncStorage.setItem('@eld/device_name', registeredDevice.device_name)

      setDeviceId(registeredDevice.id)
      setDevice({
        id: registeredDevice.id,
        device_name: registeredDevice.device_name,
        device_serial_number: registeredDevice.device_serial_number,
        provider: 'truckmates_mobile',
        status: registeredDevice.status as 'active' | 'inactive',
      } as ELDDevice)

      setIsLoading(false)
      return true
    } catch (err: any) {
      console.error('Error registering device:', err)
      setError(err.message)
      setIsLoading(false)
      return false
    }
  }

  async function refreshDevice() {
    await loadDeviceId()
  }

  // Generate or retrieve device serial number
  async function getDeviceSerial(): Promise<string> {
    try {
      // Try to get existing serial
      const existing = await AsyncStorage.getItem(STORAGE_KEYS.DEVICE_SERIAL)
      if (existing) {
        return existing
      }

      // Generate new serial based on device ID
      const uniqueId = DeviceInfo.getUniqueId()
      const serial = `MOBILE-${Platform.OS.toUpperCase()}-${uniqueId.substring(0, 12)}`
      await AsyncStorage.setItem(STORAGE_KEYS.DEVICE_SERIAL, serial)
      return serial
    } catch (err) {
      // Fallback serial
      return `MOBILE-${Platform.OS.toUpperCase()}-${Date.now()}`
    }
  }

  return {
    device,
    deviceId,
    isLoading,
    isRegistered: !!deviceId,
    error,
    register,
    refreshDevice,
  }
}

