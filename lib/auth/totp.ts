import crypto from "crypto"

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"
const TOTP_STEP_SECONDS = 30
const TOTP_DIGITS = 6

function base32Encode(buffer: Buffer): string {
  let bits = 0
  let value = 0
  let output = ""

  for (const byte of buffer) {
    value = (value << 8) | byte
    bits += 8
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31]
  }
  return output
}

function base32Decode(encoded: string): Buffer {
  const cleaned = encoded.replace(/=+$/g, "").toUpperCase().replace(/[^A-Z2-7]/g, "")
  let bits = 0
  let value = 0
  const bytes: number[] = []

  for (const char of cleaned) {
    const idx = BASE32_ALPHABET.indexOf(char)
    if (idx === -1) continue
    value = (value << 5) | idx
    bits += 5
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255)
      bits -= 8
    }
  }
  return Buffer.from(bytes)
}

export function generateTotpSecret(): string {
  return base32Encode(crypto.randomBytes(20))
}

export function generateTotpUri(secret: string, email: string, issuer = "TruckMates"): string {
  const label = encodeURIComponent(`${issuer}:${email}`)
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: "SHA1",
    digits: String(TOTP_DIGITS),
    period: String(TOTP_STEP_SECONDS),
  })
  return `otpauth://totp/${label}?${params.toString()}`
}

function hotp(secret: Buffer, counter: number): string {
  const counterBuf = Buffer.alloc(8)
  counterBuf.writeBigUInt64BE(BigInt(counter))

  const hmac = crypto.createHmac("sha1", secret).update(counterBuf).digest()
  const offset = hmac[hmac.length - 1]! & 0x0f
  const code =
    ((hmac[offset]! & 0x7f) << 24) |
    ((hmac[offset + 1]! & 0xff) << 16) |
    ((hmac[offset + 2]! & 0xff) << 8) |
    (hmac[offset + 3]! & 0xff)

  return String(code % 10 ** TOTP_DIGITS).padStart(TOTP_DIGITS, "0")
}

function totpAt(secret: Buffer, timeMs: number): string {
  const counter = Math.floor(timeMs / 1000 / TOTP_STEP_SECONDS)
  return hotp(secret, counter)
}

export function verifyTotpCode(secret: string, code: string, nowMs = Date.now()): boolean {
  const normalized = String(code || "").replace(/\s/g, "")
  if (!/^\d{6}$/.test(normalized)) return false

  const key = base32Decode(secret)
  if (!key.length) return false

  for (const offset of [-1, 0, 1]) {
    const at = nowMs + offset * TOTP_STEP_SECONDS * 1000
    if (totpAt(key, at) === normalized) return true
  }
  return false
}
