import { cert, getApps, initializeApp } from "firebase-admin/app"
import { getMessaging } from "firebase-admin/messaging"

function getAdminConfig() {
  const projectId = process.env.FIREBASE_PROJECT_ID
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n")
  if (!projectId || !clientEmail || !privateKey) return null
  return { projectId, clientEmail, privateKey }
}

export function getFirebaseAdminMessaging() {
  const cfg = getAdminConfig()
  if (!cfg) return null
  const app =
    getApps()[0] ||
    initializeApp({
      credential: cert({
        projectId: cfg.projectId,
        clientEmail: cfg.clientEmail,
        privateKey: cfg.privateKey,
      }),
    })
  return getMessaging(app)
}
