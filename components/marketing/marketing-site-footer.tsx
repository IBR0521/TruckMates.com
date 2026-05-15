import Link from "next/link"
import { Logo } from "@/components/logo"

export function MarketingSiteFooter() {
  return (
    <footer className="border-t border-border/80 bg-muted/30">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-4 lg:gap-8">
          <div className="lg:col-span-1">
            <Logo size="sm" />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted-foreground">
              Fleet operations for carriers from 1 to 100 trucks — honest scope, no fake enterprise claims.
            </p>
          </div>
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Product</h4>
            <ul className="mt-4 space-y-3 text-sm">
              {[
                ["Features", "/#features"],
                ["Pricing", "/pricing"],
                ["Demo", "/demo"],
                ["Start free", "/register"],
                ["Log in", "/login"],
              ].map(([label, href]) => (
                <li key={href}>
                  <Link href={href} className="text-foreground/90 transition hover:text-primary">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Learn</h4>
            <ul className="mt-4 space-y-3 text-sm">
              <li>
                <Link href="/#features" className="text-foreground/90 transition hover:text-primary">
                  Features
                </Link>
              </li>
              <li>
                <Link href="/pricing" className="text-foreground/90 transition hover:text-primary">
                  Plans &amp; trial details
                </Link>
              </li>
              <li>
                <Link href="/about" className="text-foreground/90 transition hover:text-primary">
                  About the platform
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Company</h4>
            <ul className="mt-4 space-y-3 text-sm">
              {[
                ["About", "/about"],
                ["Integrations", "/integrations"],
                ["Security", "/security"],
                ["Compliance", "/compliance"],
              ].map(([label, href]) => (
                <li key={href}>
                  <Link href={href} className="text-foreground/90 transition hover:text-primary">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-border/60 pt-8 sm:flex-row">
          <p className="text-sm text-muted-foreground">© {new Date().getFullYear()} TruckMates. All rights reserved.</p>
          <div className="flex gap-8">
            <Link href="/privacy" className="text-sm text-muted-foreground transition hover:text-foreground">
              Privacy
            </Link>
            <Link href="/terms" className="text-sm text-muted-foreground transition hover:text-foreground">
              Terms
            </Link>
            <Link href="/refund-policy" className="text-sm text-muted-foreground transition hover:text-foreground">
              Refund Policy
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
