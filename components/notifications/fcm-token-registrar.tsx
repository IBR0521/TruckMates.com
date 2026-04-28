"use client"

import { useEffect } from "react"
import { saveFcmToken } from "@/app/actions/push-notifications"
import { getFirebaseWebApp } from "@/lib/firebase/client"

const REQUEST_FLAG = "truckmates-fcm-prompted-v1"

export function FcmTokenRegistrar() {
  useEffect(() => {
    let cancelled = false
    async function setupPush() {
      if (typeof window === "undefined") return
      if (!("serviceWorker" in navigator) || !("Notification" in window)) return
      if (!window.isSecureContext) return

      const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY
      if (!vapidKey) return

      const app = getFirebaseWebApp()
      if (!app) return

      const { getMessaging, getToken, isSupported } = await import("firebase/messaging")
      const supported = await isSupported().catch(() => false)
      if (!supported) return
      const messaging = getMessaging(app)
      const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js")

      let permission = Notification.permission
      if (permission === "default" && !localStorage.getItem(REQUEST_FLAG)) {
        localStorage.setItem(REQUEST_FLAG, "1")
        permission = await Notification.requestPermission()
      }
      if (permission !== "granted") return

      const token = await getToken(messaging, {
        vapidKey,
        serviceWorkerRegistration: registration,
      })
      if (!token || cancelled) return
      await saveFcmToken(token)
    }

    setupPush().catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  return null
}
