import * as Location from "expo-location"
import { enqueue } from "./sync-queue"
import type { ELDLocation } from "../types/eld"

export async function requestLocationPermissions(): Promise<boolean> {
  const fg = await Location.requestForegroundPermissionsAsync()
  if (fg.status !== "granted") return false

  const bg = await Location.requestBackgroundPermissionsAsync()
  return bg.status === "granted"
}

export async function captureAndQueueLocation(driverId?: string): Promise<void> {
  const sample = await getCurrentEldLocation(driverId)

  await enqueue({ type: "locations", payload: [sample] })
}

export async function getCurrentEldLocation(driverId?: string): Promise<ELDLocation> {
  const current = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.Balanced,
  })

  return {
    timestamp: new Date().toISOString(),
    latitude: current.coords.latitude,
    longitude: current.coords.longitude,
    speed: typeof current.coords.speed === "number" ? current.coords.speed : undefined,
    heading: typeof current.coords.heading === "number" ? current.coords.heading : undefined,
    driver_id: driverId,
  }
}
