import * as Device from "expo-device"
import { apiRequest } from "./http"
import type { DeviceRegistrationResponse, ELDDvir, ELDEvent, ELDLocation, ELDLog } from "../types/eld"

export async function registerDevice(token: string): Promise<DeviceRegistrationResponse> {
  return apiRequest<DeviceRegistrationResponse>("/api/eld/mobile/register", token, "POST", {
    device_name: Device.deviceName || "Driver Device",
    device_serial_number: Device.osInternalBuildId || Device.modelId || `${Device.modelName || "unknown"}-${Date.now()}`,
    app_version: "1.0.0",
    device_info: {
      model: Device.modelName,
      os: `${Device.osName} ${Device.osVersion}`,
      platform: Device.osName?.toLowerCase(),
    },
  })
}

export async function pushLocations(token: string, deviceId: string, locations: ELDLocation[]) {
  return apiRequest<{ success: boolean; inserted: number; message: string }>(
    "/api/eld/mobile/locations",
    token,
    "POST",
    { device_id: deviceId, locations }
  )
}

export async function pushLogs(token: string, deviceId: string, logs: ELDLog[]) {
  return apiRequest<{ success: boolean; inserted: number; message: string }>(
    "/api/eld/mobile/logs",
    token,
    "POST",
    { device_id: deviceId, logs }
  )
}

export async function pushEvents(token: string, deviceId: string, events: ELDEvent[]) {
  return apiRequest<{ success: boolean; inserted: number; message: string }>(
    "/api/eld/mobile/events",
    token,
    "POST",
    { device_id: deviceId, events }
  )
}

export async function pushDvirs(token: string, deviceId: string, dvirs: ELDDvir[]) {
  return apiRequest<{ success: boolean; inserted: number; message: string }>(
    "/api/eld/mobile/dvirs",
    token,
    "POST",
    { device_id: deviceId, dvirs }
  )
}
