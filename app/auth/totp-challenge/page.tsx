"use client"

import { useState, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Input } from "@/components/ui/input"
import { Loader2, Shield } from "lucide-react"
import { toast } from "sonner"
import { Logo } from "@/components/logo"
import { completeTotpLoginChallenge } from "@/app/actions/totp"
import { errorMessage } from "@/lib/error-message"

function TotpChallengeForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const pendingId = searchParams.get("pending") || ""
  const nextParam = searchParams.get("next")
  const safeNext =
    nextParam && nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : null

  const [code, setCode] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!pendingId) {
      toast.error("Your sign-in challenge expired. Please log in again.")
      router.push("/login")
      return
    }

    setIsLoading(true)
    try {
      const result = await completeTotpLoginChallenge({
        pendingId,
        code,
        next: safeNext,
      })

      if (result.error) {
        toast.error(result.error)
        if (result.error.includes("expired")) {
          router.push("/login")
        }
        setIsLoading(false)
        return
      }

      toast.success("Signed in successfully")
      router.refresh()
      router.push(result.data!.redirectTo)
    } catch (error: unknown) {
      toast.error(errorMessage(error, "Verification failed. Please try again."))
      setIsLoading(false)
    }
  }

  if (!pendingId) {
    return (
      <div className="text-center">
        <p className="text-sm text-[var(--w-text-2)]">Missing verification session.</p>
        <Link href="/login" className="mt-4 inline-block text-sm text-[var(--w-blue)] hover:underline">
          Back to sign in
        </Link>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label
          className="mb-2 block text-[11px] uppercase tracking-wider text-[var(--w-text-3)]"
          style={{ fontFamily: "var(--font-jakarta), sans-serif" }}
        >
          Authentication code
        </label>
        <Input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={6}
          placeholder="000000"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          className="h-11 w-full rounded-[10px] border text-center text-lg tracking-[0.3em] text-[var(--w-text)] focus-visible:ring-[var(--w-blue)] focus-visible:ring-offset-0"
          style={{
            background: "var(--w-bg)",
            borderColor: "var(--w-border-md)",
            fontFamily: "var(--font-jakarta), sans-serif",
          }}
          required
          autoComplete="one-time-code"
          autoFocus
        />
      </div>

      <button
        type="submit"
        disabled={isLoading || code.length !== 6}
        className="flex h-11 w-full items-center justify-center gap-2 rounded-[10px] text-[15px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
        style={{
          background: "var(--w-blue)",
          fontFamily: "var(--font-jakarta), sans-serif",
          boxShadow: "0 0 0 1px rgba(59,130,246,0.5), 0 4px 24px var(--w-blue-glow)",
        }}
      >
        {isLoading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Verifying…
          </>
        ) : (
          <>
            <Shield className="h-4 w-4" aria-hidden />
            Verify and continue
          </>
        )}
      </button>

      <p className="text-center text-xs text-[var(--w-text-3)]" style={{ fontFamily: "var(--font-jakarta), sans-serif" }}>
        Open your authenticator app and enter the 6-digit code. This challenge expires in 5 minutes.
      </p>
    </form>
  )
}

export default function TotpChallengePage() {
  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center px-6 py-12"
      style={{ background: "var(--w-bg-2)" }}
    >
      <div className="mx-auto w-full max-w-[400px]">
        <div className="mb-8 flex justify-center">
          <Logo size="sm" />
        </div>
        <span
          className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[var(--w-blue)]"
          style={{ fontFamily: "var(--font-bricolage), sans-serif" }}
        >
          Two-factor authentication
        </span>
        <h1
          className="mt-2 text-[32px] font-bold text-[var(--w-text)]"
          style={{ fontFamily: "var(--font-bricolage), sans-serif" }}
        >
          Enter your code
        </h1>
        <p
          className="mt-2 mb-8 text-sm text-[var(--w-text-2)]"
          style={{ fontFamily: "var(--font-jakarta), sans-serif" }}
        >
          Your password was verified. Complete sign-in with your authenticator app.
        </p>

        <Suspense fallback={<div className="text-sm text-muted-foreground">Loading…</div>}>
          <TotpChallengeForm />
        </Suspense>

        <p className="mt-6 text-center text-sm text-[var(--w-text-2)]" style={{ fontFamily: "var(--font-jakarta), sans-serif" }}>
          <Link href="/login" className="text-[var(--w-blue)] hover:underline">
            ← Back to sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
