import Link from "next/link"
import { Logo } from "@/components/logo"

export default function SsoErrorPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4" style={{ background: "var(--w-bg-2)" }}>
      <Logo size="sm" />
      <div className="mt-8 max-w-md text-center space-y-4">
        <h1 className="text-2xl font-bold text-foreground">SSO sign-in failed</h1>
        <p className="text-muted-foreground text-sm leading-relaxed">
          We couldn&apos;t complete sign-in with your company identity provider. Contact your
          administrator if this continues.
        </p>
        <Link href="/login" className="inline-block text-sm text-primary hover:underline">
          Return to sign in
        </Link>
      </div>
    </div>
  )
}
