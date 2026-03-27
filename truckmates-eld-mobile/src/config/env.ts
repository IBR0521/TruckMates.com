import Constants from "expo-constants"

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

export const ENV = {
  apiUrl: requireConfig("EXPO_PUBLIC_PLATFORM_API_URL", process.env.EXPO_PUBLIC_PLATFORM_API_URL || extra.apiUrl),
  supabaseUrl: requireConfig("EXPO_PUBLIC_SUPABASE_URL", process.env.EXPO_PUBLIC_SUPABASE_URL || extra.supabaseUrl),
  supabaseAnonKey: requireConfig("EXPO_PUBLIC_SUPABASE_ANON_KEY", process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || extra.supabaseAnonKey),
}
