import Constants from "expo-constants"
import * as Device from "expo-device"
import { Platform } from "react-native"

type ExtraConfig = {
  apiUrl?: string
  supabaseUrl?: string
  supabaseAnonKey?: string
}

const extra = (Constants.expoConfig?.extra ?? {}) as ExtraConfig

function requireConfig(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Missing required mobile config: ${name}`)
  }
  return value
}

/**
 * `localhost` / `127.0.0.1` in EXPO_PUBLIC_PLATFORM_API_URL only work on the same machine.
 * - Android emulator: map to 10.0.2.2 (host loopback).
 * - Physical device (Expo Go): replace with the dev machine IP from Metro (hostUri / debuggerHost).
 * - iOS Simulator on Mac: leave as-is (localhost reaches the host).
 */
export function resolvePlatformApiUrl(raw: string): string {
  let parsed: URL
  try {
    parsed = new URL(raw)
  } catch {
    return raw
  }
  const host = parsed.hostname.toLowerCase()
  if (host !== "localhost" && host !== "127.0.0.1") {
    return raw
  }

  if (Platform.OS === "android" && !Device.isDevice) {
    parsed.hostname = "10.0.2.2"
    return parsed.toString()
  }

  if (Device.isDevice) {
    const packagerHost =
      Constants.expoConfig?.hostUri ??
      (Constants.manifest as { debuggerHost?: string } | null)?.debuggerHost ??
      (Constants.expoGoConfig as { debuggerHost?: string } | null)?.debuggerHost
    if (packagerHost) {
      const ip = packagerHost.split(":")[0]?.trim()
      if (ip && ip !== "localhost" && ip !== "127.0.0.1") {
        parsed.hostname = ip
        return parsed.toString()
      }
    }
  }

  return raw
}

const rawApiUrl = requireConfig("EXPO_PUBLIC_PLATFORM_API_URL", process.env.EXPO_PUBLIC_PLATFORM_API_URL || extra.apiUrl)

export const ENV = {
  apiUrl: resolvePlatformApiUrl(rawApiUrl),
  supabaseUrl: requireConfig("EXPO_PUBLIC_SUPABASE_URL", process.env.EXPO_PUBLIC_SUPABASE_URL || extra.supabaseUrl),
  supabaseAnonKey: requireConfig("EXPO_PUBLIC_SUPABASE_ANON_KEY", process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || extra.supabaseAnonKey),
}
