import React, { createContext, useContext, useEffect, useMemo, useState } from "react"
import { supabase } from "../services/supabase"
import { registerDevice } from "../services/eld-api"
import { storage } from "../services/storage"

type AuthContextValue = {
  loading: boolean
  sessionToken: string | null
  deviceId: string | null
  userId: string | null
  assignedTruckId: string | null
  setAssignedTruckId: (truckId: string | null) => Promise<void>
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

const DEVICE_ID_KEY = "eld_device_id_v1"
const ASSIGNED_TRUCK_KEY = "assigned_truck_id_v1"

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true)
  const [sessionToken, setSessionToken] = useState<string | null>(null)
  const [deviceId, setDeviceId] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [assignedTruckId, setAssignedTruckIdState] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      const { data } = await supabase.auth.getSession()
      setSessionToken(data.session?.access_token ?? null)
      setUserId(data.session?.user?.id ?? null)
      setDeviceId(await storage.get<string>(DEVICE_ID_KEY))
      setAssignedTruckIdState(await storage.get<string>(ASSIGNED_TRUCK_KEY))
      setLoading(false)
    })()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSessionToken(session?.access_token ?? null)
      setUserId(session?.user?.id ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  async function signIn(email: string, password: string): Promise<void> {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error || !data.session?.access_token) {
      throw new Error(error?.message || "Unable to sign in")
    }

    const token = data.session.access_token
    setSessionToken(token)
    setUserId(data.session.user.id)

    const registration = await registerDevice(token)
    setDeviceId(registration.device_id)
    await storage.set(DEVICE_ID_KEY, registration.device_id)
  }

  async function signOut(): Promise<void> {
    await supabase.auth.signOut()
    setSessionToken(null)
    setUserId(null)
    setDeviceId(null)
    await storage.remove(DEVICE_ID_KEY)
  }

  async function setAssignedTruckId(truckId: string | null): Promise<void> {
    const normalized = truckId?.trim() || null
    setAssignedTruckIdState(normalized)
    if (normalized) {
      await storage.set(ASSIGNED_TRUCK_KEY, normalized)
    } else {
      await storage.remove(ASSIGNED_TRUCK_KEY)
    }
  }

  const value = useMemo<AuthContextValue>(
    () => ({ loading, sessionToken, deviceId, userId, assignedTruckId, setAssignedTruckId, signIn, signOut }),
    [loading, sessionToken, deviceId, userId, assignedTruckId]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext)
  if (!value) throw new Error("useAuth must be used within AuthProvider")
  return value
}
