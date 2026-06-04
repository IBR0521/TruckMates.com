"use client"

import { useState } from "react"
import { errorMessage } from "@/lib/error-message"
import { Input } from "@/components/ui/input"
import { Check, Loader2 } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"
import { Logo } from "@/components/logo"
import { useRouter } from "next/navigation"
import { signInWithCredentials } from "@/app/actions/auth"
import { DotBg } from "@/components/marketing/marketing-ui"

const BULLETS = [
  "Dispatch, compliance, and invoicing in one place",
  "AI assistant built in — not bolted on",
  "Free trial, no credit card required",
] as const

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const nextParam =
        typeof window !== "undefined"
          ? new URLSearchParams(window.location.search).get("next")
          : null
      const safeNext = nextParam && nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : null

      const result = await signInWithCredentials({ email, password, next: safeNext })

      if (result.error) {
        toast.error(result.error)
        setIsLoading(false)
        return
      }

      toast.success("Login successful")
      router.refresh()
      router.push(result.data!.redirectTo)
      setIsLoading(false)
    } catch (error: unknown) {
      toast.error(errorMessage(error, "An error occurred. Please try again."))
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen">
      <aside
        className="relative hidden w-[45%] flex-col items-center justify-center px-12 lg:flex"
        style={{ background: "linear-gradient(160deg, #0B1A3B 0%, #070D1C 50%, #06080F 100%)" }}
      >
        <DotBg />
        <div className="relative flex max-w-md flex-col items-center text-center">
          <Logo size="md" />
          <h2
            className="mt-10 text-[30px] leading-[1.2] font-bold text-[var(--w-text)]"
            style={{ fontFamily: "var(--font-bricolage), sans-serif" }}
          >
            The command center for your fleet.
          </h2>
          <ul className="mt-6 w-full space-y-3.5 text-left">
            {BULLETS.map((b) => (
              <li
                key={b}
                className="flex gap-3 text-[15px] text-[var(--w-text-2)]"
                style={{ fontFamily: "var(--font-jakarta), sans-serif" }}
              >
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--w-green)]" />
                {b}
              </li>
            ))}
          </ul>
          <p
            className="mt-auto pt-16 text-xs"
            style={{ color: "rgba(241,245,249,0.20)", fontFamily: "var(--font-jakarta), sans-serif" }}
          >
            truckmateslogistic.com
          </p>
        </div>
      </aside>

      <div
        className="relative flex flex-1 flex-col justify-center px-6 py-12 lg:w-[55%]"
        style={{ background: "var(--w-bg-2)" }}
      >
        <Link
          href="/"
          className="absolute top-6 left-6 text-sm text-[var(--w-blue)]"
          style={{ fontFamily: "var(--font-jakarta), sans-serif" }}
        >
          ← Home
        </Link>

        <div className="mx-auto w-full max-w-[400px]">
          <div className="mb-8 flex justify-center lg:hidden">
            <Logo size="sm" />
          </div>
          <span
            className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[var(--w-blue)]"
            style={{ fontFamily: "var(--font-bricolage), sans-serif" }}
          >
            Sign in
          </span>
          <h1
            className="mt-2 text-[36px] font-bold text-[var(--w-text)]"
            style={{ fontFamily: "var(--font-bricolage), sans-serif" }}
          >
            Welcome back.
          </h1>
          <p
            className="mt-2 mb-8 text-sm text-[var(--w-text-2)]"
            style={{ fontFamily: "var(--font-jakarta), sans-serif" }}
          >
            Enter your credentials to continue.
          </p>

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label
                className="mb-2 block text-[11px] uppercase tracking-wider text-[var(--w-text-3)]"
                style={{ fontFamily: "var(--font-jakarta), sans-serif" }}
              >
                Email
              </label>
              <Input
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-11 w-full rounded-[10px] border text-[15px] text-[var(--w-text)] focus-visible:ring-[var(--w-blue)] focus-visible:ring-offset-0"
                style={{
                  background: "var(--w-bg)",
                  borderColor: "var(--w-border-md)",
                  fontFamily: "var(--font-jakarta), sans-serif",
                }}
                required
              />
            </div>
            <div>
              <label
                className="mb-2 block text-[11px] uppercase tracking-wider text-[var(--w-text-3)]"
                style={{ fontFamily: "var(--font-jakarta), sans-serif" }}
              >
                Password
              </label>
              <Input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-11 w-full rounded-[10px] border text-[15px] text-[var(--w-text)] focus-visible:ring-[var(--w-blue)] focus-visible:ring-offset-0"
                style={{
                  background: "var(--w-bg)",
                  borderColor: "var(--w-border-md)",
                  fontFamily: "var(--font-jakarta), sans-serif",
                }}
                required
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="mt-6 flex h-11 w-full items-center justify-center gap-2 rounded-[10px] text-[15px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
              style={{
                background: "var(--w-blue)",
                fontFamily: "var(--font-jakarta), sans-serif",
                boxShadow: "0 0 0 1px rgba(59,130,246,0.5), 0 4px 24px var(--w-blue-glow)",
              }}
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                "Sign in"
              )}
            </button>
          </form>

          <p
            className="mt-6 text-center text-sm text-[var(--w-text-2)]"
            style={{ fontFamily: "var(--font-jakarta), sans-serif" }}
          >
            Don&apos;t have an account?{" "}
            <Link href="/register" className="text-[var(--w-blue)] hover:underline">
              Start free →
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
