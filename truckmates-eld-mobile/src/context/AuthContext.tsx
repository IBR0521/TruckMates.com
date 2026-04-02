import React, { createContext, useContext, useEffect, useMemo, useState } from "react"
import { supabase } from "../services/supabase"
import { registerDevice } from "../services/eld-api"
import { storage } from "../services/storage"
import { flushQueue, setQueueUserContext } from "../services/sync-queue"

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
const scopedKey = (base: string, userId: string) => `${base}:${userId}`

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true)
  const [sessionToken, setSessionToken] = useState<string | null>(null)
  const [deviceId, setDeviceId] = useState<string | null>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [assignedTruckId, setAssignedTruckIdState] = useState<string | null>(null)

  async function hydrateSessionState(token: string | null, nextUserId: string | null): Promise<void> {
    setSessionToken(token)
    setUserId(nextUserId)
    await setQueueUserContext(nextUserId)

    if (!nextUserId) {
      setDeviceId(null)
      setAssignedTruckIdState(null)
      return
    }

    const storedDeviceId = await storage.get<string>(scopedKey(DEVICE_ID_KEY, nextUserId))
    setAssignedTruckIdState(await storage.get<string>(scopedKey(ASSIGNED_TRUCK_KEY, nextUserId)))

    if (storedDeviceId) {
      setDeviceId(storedDeviceId)
      return
    }

    // Self-heal: if session exists but local device id is missing, register again.
    if (token) {
      try {
        const registration = await registerDevice(token)
        setDeviceId(registration.device_id)
        await storage.set(scopedKey(DEVICE_ID_KEY, nextUserId), registration.device_id)
        return
      } catch {
        // Keep null; sync button will show actionable error.
      }
    }

    setDeviceId(null)
  }

  useEffect(() => {
    void (async () => {
      const { data } = await supabase.auth.getSession()
      const nextToken = data.session?.access_token ?? null
      const nextUserId = data.session?.user?.id ?? null
      await hydrateSessionState(nextToken, nextUserId)
      setLoading(false)
    })()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      const nextToken = session?.access_token ?? null
      const nextUserId = session?.user?.id ?? null
      void (async () => {
        await hydrateSessionState(nextToken, nextUserId)
      })()
    })
    return () => subscription.unsubscribe()
  }, [])

  async function signIn(email: string, password: string): Promise<void> {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error || !data.session?.access_token) {
      throw new Error(error?.message || "Unable to sign in")
    }

    const token = data.session.access_token
    const signedInUserId = data.session.user.id

    // ELD app is driver-only. Block non-driver accounts at sign-in time.
    const { data: profile, error: profileError } = await supabase
      .from("users")
      .select("role")
      .eq("id", signedInUserId)
      .maybeSingle()

    const normalizedRole = String(profile?.role || "").trim().toLowerCase()
    if (profileError || normalizedRole !== "driver") {
      await supabase.auth.signOut()
      setSessionToken(null)
      setUserId(null)
      setDeviceId(null)
      setAssignedTruckIdState(null)
      throw new Error("Access denied. ELD app is available for Driver accounts only.")
    }

    const registration = await registerDevice(token)

    setSessionToken(token)
    setUserId(signedInUserId)
    setDeviceId(registration.device_id)
    await storage.set(scopedKey(DEVICE_ID_KEY, signedInUserId), registration.device_id)
    // Flush any pending offline queue as soon as we have auth + device.
    try {
      await flushQueue(token, registration.device_id)
    } catch {
      // Ignore; queued items will retry in background.
    }
  }

  async function signOut(): Promise<void> {
    const previousUserId = userId
    await supabase.auth.signOut()
    setSessionToken(null)
    setUserId(null)
    setDeviceId(null)
    setAssignedTruckIdState(null)
    if (previousUserId) {
      await storage.remove(scopedKey(DEVICE_ID_KEY, previousUserId))
    }
  }

  async function setAssignedTruckId(truckId: string | null): Promise<void> {
    const normalized = truckId?.trim() || null
    setAssignedTruckIdState(normalized)
    if (!userId) return
    if (normalized) {
      await storage.set(scopedKey(ASSIGNED_TRUCK_KEY, userId), normalized)
    } else {
      await storage.remove(scopedKey(ASSIGNED_TRUCK_KEY, userId))
    }
  }

  // Keep retrying queued sync in the background while logged in.
  useEffect(() => {
    if (!sessionToken || !deviceId) return
    const run = () => {
      void flushQueue(sessionToken, deviceId).catch(() => {})
    }
    run()
    const id = setInterval(run, 5000)
    return () => clearInterval(id)
  }, [sessionToken, deviceId])

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
