import React, { createContext, useContext, useEffect, useMemo, useState } from "react"
import { useAuth } from "./AuthContext"
import type { ELDDvir } from "../types/eld"
import type { LocalDvirReport } from "../types/dvir"
import { storage } from "../services/storage"
import { enqueue } from "../services/sync-queue"

type DvirContextValue = {
  reports: LocalDvirReport[]
  submitDvir: (payload: ELDDvir) => Promise<void>
}

const STORAGE_KEY = "dvir_reports_v1"
const scopedKey = (base: string, userId: string) => `${base}:${userId}`
const DvirContext = createContext<DvirContextValue | null>(null)

export function DvirProvider({ children }: { children: React.ReactNode }) {
  const { userId } = useAuth()
  const [reports, setReports] = useState<LocalDvirReport[]>([])

  useEffect(() => {
    void (async () => {
      if (!userId) {
        setReports([])
        return
      }
      const saved = await storage.get<LocalDvirReport[]>(scopedKey(STORAGE_KEY, userId))
      setReports(saved || [])
    })()
  }, [userId])

  async function submitDvir(payload: ELDDvir) {
    const now = new Date().toISOString()
    const normalized: ELDDvir = {
      ...payload,
      inspection_date: payload.inspection_date || now.slice(0, 10),
      inspection_time: payload.inspection_time || now.slice(11, 16),
      driver_id: payload.driver_id || userId || undefined,
      status: payload.status || (payload.defects_found ? "failed" : "passed"),
      driver_signature_date: payload.driver_signature_date || now,
    }

    await enqueue({ type: "dvirs", payload: [normalized] })

    const report: LocalDvirReport = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      submittedAt: now,
      synced: false,
      payload: normalized,
    }

    setReports((prev) => {
      const next = [report, ...prev].slice(0, 100)
      if (userId) {
        void storage.set(scopedKey(STORAGE_KEY, userId), next)
      }
      return next
    })
  }

  const value = useMemo<DvirContextValue>(
    () => ({
      reports,
      submitDvir,
    }),
    [reports, userId]
  )

  return <DvirContext.Provider value={value}>{children}</DvirContext.Provider>
}

export function useDvir(): DvirContextValue {
  const value = useContext(DvirContext)
  if (!value) throw new Error("useDvir must be used within DvirProvider")
  return value
}
