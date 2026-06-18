import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@sentry/nextjs", () => ({
  captureMessage: vi.fn(),
}))

describe("lib/crypto/eld-credentials.ts", () => {
  beforeEach(() => {
    vi.resetModules()
    process.env.ELD_CREDENTIALS_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64")
  })

  it("round-trips encrypt and decrypt", async () => {
    const { encryptCredential, decryptCredential, isEncryptedCredentialFormat } = await import(
      "../../lib/crypto/eld-credentials"
    )
    const stored = encryptCredential("provider-secret-123")
    expect(isEncryptedCredentialFormat(stored)).toBe(true)
    expect(decryptCredential(stored)).toBe("provider-secret-123")
  })

  it("returns legacy plaintext unchanged and warns", async () => {
    const Sentry = await import("@sentry/nextjs")
    const { decryptCredential } = await import("../../lib/crypto/eld-credentials")
    expect(decryptCredential("plain-live-key")).toBe("plain-live-key")
    expect(Sentry.captureMessage).toHaveBeenCalledWith(
      "legacy plaintext ELD credential read",
      expect.objectContaining({
        tags: expect.objectContaining({ legacy_plaintext: "true" }),
      }),
    )
  })

  it("encryptCredentialIfNeeded skips already encrypted values", async () => {
    const { encryptCredential, encryptCredentialIfNeeded } = await import("../../lib/crypto/eld-credentials")
    const stored = encryptCredential("x")
    expect(encryptCredentialIfNeeded(stored)).toBe(stored)
  })
})
