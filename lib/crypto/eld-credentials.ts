import crypto from "crypto"
import * as Sentry from "@sentry/nextjs"

/** Stored credential prefix: `eld1:<iv_b64>:<tag_b64>:<ciphertext_b64>` */
export const ELD_CREDENTIAL_FORMAT_VERSION = "eld1"

const IV_BYTES = 12

let legacyPlaintextWarningCount = 0
const LEGACY_PLAINTEXT_WARNING_CAP = 200

export function isEncryptedCredentialFormat(stored: string): boolean {
  if (!stored || typeof stored !== "string") return false
  const parts = stored.split(":")
  if (parts.length !== 4 || parts[0] !== ELD_CREDENTIAL_FORMAT_VERSION) return false
  try {
    for (let i = 1; i < 4; i++) {
      const buf = Buffer.from(parts[i]!, "base64")
      if (!buf.length) return false
    }
    return true
  } catch {
    return false
  }
}

function getEncryptionKey(): Buffer {
  const raw = String(process.env.ELD_CREDENTIALS_ENCRYPTION_KEY || "").trim()
  if (!raw) {
    throw new Error("ELD_CREDENTIALS_ENCRYPTION_KEY is not configured")
  }
  const key = Buffer.from(raw, "base64")
  if (key.length !== 32) {
    throw new Error(
      "ELD_CREDENTIALS_ENCRYPTION_KEY must be base64 encoding 32 bytes (generate with: openssl rand -base64 32)",
    )
  }
  return key
}

export function encryptCredential(plaintext: string): string {
  if (plaintext === "") return ""
  const key = getEncryptionKey()
  const iv = crypto.randomBytes(IV_BYTES)
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv)
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()
  return [
    ELD_CREDENTIAL_FORMAT_VERSION,
    iv.toString("base64"),
    tag.toString("base64"),
    ciphertext.toString("base64"),
  ].join(":")
}

export function decryptCredential(stored: string): string {
  if (!stored) return stored
  if (!isEncryptedCredentialFormat(stored)) {
    if (legacyPlaintextWarningCount < LEGACY_PLAINTEXT_WARNING_CAP) {
      legacyPlaintextWarningCount += 1
      Sentry.captureMessage("legacy plaintext ELD credential read", {
        level: "warning",
        tags: { area: "eld_credentials", legacy_plaintext: "true" },
      })
    }
    return stored
  }

  const [, ivB64, tagB64, ctB64] = stored.split(":")
  const key = getEncryptionKey()
  const iv = Buffer.from(ivB64!, "base64")
  const tag = Buffer.from(tagB64!, "base64")
  const ciphertext = Buffer.from(ctB64!, "base64")
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv)
  decipher.setAuthTag(tag)
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()])
  return plaintext.toString("utf8")
}

/** Encrypt only when plaintext; skip null/empty; leave already-encrypted values unchanged. */
export function encryptCredentialIfNeeded(value: string | null | undefined): string | null | undefined {
  if (value == null || value === "") return value
  if (isEncryptedCredentialFormat(value)) return value
  return encryptCredential(value)
}
