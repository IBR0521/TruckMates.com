/**
 * Demo Setup Service
 * Sets up a local demo device without any API calls
 */

import AsyncStorage from '@react-native-async-storage/async-storage'
import { STORAGE_KEYS } from '@/constants/config'
import { Platform } from 'react-native'
import DeviceInfo from 'react-native-device-info'

export async function setupLocalDemoDevice(): Promise<void> {
  try {
    // Check if device already exists
    const existingDeviceId = await AsyncStorage.getItem(STORAGE_KEYS.DEVICE_ID)
    if (existingDeviceId) {
      console.log('[Demo Setup] Device already exists:', existingDeviceId)
      return
    }

    // Create demo device
    const deviceId = `demo-device-${Date.now()}`
    const uniqueId = await DeviceInfo.getUniqueId()
    const deviceSerial = `MOBILE-${Platform.OS.toUpperCase()}-${uniqueId.substring(0, 12)}`
    const deviceName = `Demo Device - ${new Date().toLocaleDateString()}`

    // Store device info
    await AsyncStorage.setItem(STORAGE_KEYS.DEVICE_ID, deviceId)
    await AsyncStorage.setItem(STORAGE_KEYS.DEVICE_SERIAL, deviceSerial)
    await AsyncStorage.setItem('@eld/device_name', deviceName)

    console.log('[Demo Setup] Demo device created:', {
      deviceId,
      deviceSerial,
      deviceName,
    })
  } catch (error) {
    console.error('[Demo Setup] Error creating demo device:', error)
    throw error
  }
}

