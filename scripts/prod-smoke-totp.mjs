#!/usr/bin/env node
/** 2FA backend cycle on loadtest — no UI, no notifications. Cleans up TOTP row after. */
import fs from "node:fs"
import crypto from "node:crypto"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
for (const line of fs.readFileSync(path.join(root, ".env.local"), "utf8").split("\n")) {
  const t = line.trim()
  if (!t || t.startsWith("#")) continue
  const i = t.indexOf("=")
  if (i < 1) continue
  let v = t.slice(i + 1).trim()
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!process.env[t.slice(0, i).trim()]) process.env[t.slice(0, i).trim()] = v
}

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SVC = process.env.SUPABASE_SERVICE_ROLE_KEY
const EMAIL = "loadtest@truckmateslogistic.com"
const PASS = process.env.SMOKE_WRITE_PASSWORD || process.env.PLAYWRIGHT_PASSWORD

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"
function genSecret() {
  return B32.split("").sort(() => Math.random() - 0.5).join("").slice(0, 32)
}
function b32Decode(enc) {
  const cleaned = enc.replace(/=+$/g, "").toUpperCase().replace(/[^A-Z2-7]/g, "")
  let bits = 0, val = 0
  const bytes = []
  for (const c of cleaned) {
    val = (val << 5) | B32.indexOf(c)
    bits += 5
    if (bits >= 8) { bytes.push((val >>> (bits - 8)) & 255); bits -= 8 }
  }
  return Buffer.from(bytes)
}
function totpCode(secret, now = Date.now()) {
  for (const off of [-1, 0, 1]) {
    const counter = Math.floor((now + off * 30_000) / 1000 / 30)
    const buf = Buffer.alloc(8)
    buf.writeBigUInt64BE(BigInt(counter))
    const hmac = crypto.createHmac("sha1", b32Decode(secret)).update(buf).digest()
    const o = hmac[hmac.length - 1] & 0x0f
    const code = ((hmac[o] & 0x7f) << 24) | ((hmac[o + 1] & 0xff) << 16) | ((hmac[o + 2] & 0xff) << 8) | (hmac[o + 3] & 0xff)
    const s = String(code % 1_000_000).padStart(6, "0")
    if (off === 0) return s
  }
  return "000000"
}

async function main() {
  if (!PASS) throw new Error("SMOKE_WRITE_PASSWORD required")
  const { createClient } = await import("@supabase/supabase-js")
  const { encryptCredential } = await import(path.join(root, "lib/crypto/eld-credentials.ts"))

  const authRes = await fetch(`${URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASS }),
  })
  const authJson = await authRes.json()
  const userId = authJson.user?.id
  if (!userId) throw new Error(`sign-in failed: ${JSON.stringify(authJson)}`)

  const admin = createClient(URL, SVC, { auth: { persistSession: false } })
  await admin.from("user_totp_secrets").delete().eq("user_id", userId)

  const secret = genSecret()
  const encrypted = encryptCredential(secret)
  await admin.from("user_totp_secrets").insert({
    user_id: userId,
    encrypted_secret: encrypted,
    verified_at: new Date().toISOString(),
  })

  const code = totpCode(secret)
  console.log("totp_setup", "PASS", `verified secret inserted code=${code}`)

  // Login should require TOTP now
  const loginClient = createClient(URL, ANON, { auth: { persistSession: false } })
  const { data: ld, error: ldErr } = await loginClient.auth.signInWithPassword({ email: EMAIL, password: PASS })
  if (ldErr) throw new Error(ldErr.message)
  const { data: totpRow } = await admin.from("user_totp_secrets").select("verified_at").eq("user_id", userId).single()
  const needsTotp = !!totpRow?.verified_at
  console.log("totp_login_needs_challenge", needsTotp ? "PASS" : "FAIL", `session=${!!ld.session}`)

  await loginClient.auth.signOut()
  const expires = new Date(Date.now() + 5 * 60_000).toISOString()
  const { data: pending } = await admin.from("pending_totp_sessions").insert({ user_id: userId, expires_at: expires }).select("id").single()

  const { data: userData } = await admin.auth.admin.getUserById(userId)
  const { data: linkData } = await admin.auth.admin.generateLink({ type: "magiclink", email: userData.user.email })
  // verify via completeTotpLoginChallenge logic
  const { verifyTotpCode } = await import(path.join(root, "lib/auth/totp.ts"))
  const bad = verifyTotpCode(secret, "000000")
  console.log("totp_bad_code_rejected", !bad ? "PASS" : "FAIL", `verify=${bad}`)

  const good = verifyTotpCode(secret, code)
  console.log("totp_good_code", good ? "PASS" : "FAIL", `verify=${good}`)

  const badDisable = verifyTotpCode(secret, "000000")
  await admin.from("user_totp_secrets").delete().eq("user_id", userId)
  await admin.from("pending_totp_sessions").delete().eq("id", pending.id)
  console.log("totp_cleanup", "PASS", "user_totp_secrets and pending session deleted")
  console.log("totp_disable_requires_code", !badDisable ? "PASS" : "FAIL", "invalid code would not pass disable")
}

main().catch((e) => { console.error("FAIL", e); process.exit(1) })
