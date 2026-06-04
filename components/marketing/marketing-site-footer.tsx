import Link from "next/link"
import { Logo } from "@/components/logo"

const linkClass =
  "text-sm transition-colors duration-150 hover:text-[var(--w-text)]"
const linkStyle = {
  fontFamily: "var(--font-jakarta), sans-serif",
  color: "rgba(241,245,249,0.50)",
} as const

export function MarketingSiteFooter() {
  return (
    <footer style={{ background: "var(--w-bg)", borderTop: "1px solid var(--w-border)" }}>
      <div className="mx-auto max-w-[1200px] px-6 pt-16 pb-12">
        <div className="grid grid-cols-1 gap-12 md:grid-cols-2 lg:grid-cols-4 lg:gap-12">
          <div className="lg:col-span-2">
            <Logo size="sm" />
            <p
              className="mt-4 max-w-sm text-sm leading-[1.65]"
              style={{ color: "rgba(241,245,249,0.40)", fontFamily: "var(--font-jakarta), sans-serif" }}
            >
              Fleet management for US carriers. Dispatch, compliance, IFTA, AI — one platform.
            </p>
            <p
              className="mt-6 text-xs"
              style={{ color: "rgba(241,245,249,0.22)", fontFamily: "var(--font-jakarta), sans-serif" }}
            >
              truckmateslogistic.com
            </p>
          </div>
          <div>
            <h4
              className="text-[11px] font-semibold tracking-[0.15em] uppercase text-[var(--w-blue)]"
              style={{ fontFamily: "var(--font-bricolage), sans-serif" }}
            >
              Product
            </h4>
            <ul className="mt-4 space-y-2.5">
              {[
                ["Pricing", "/pricing"],
                ["Demo", "/demo"],
                ["Start free", "/register"],
                ["Log in", "/login"],
                ["Features", "/#features"],
              ].map(([label, href]) => (
                <li key={href}>
                  <Link href={href} className={linkClass} style={linkStyle}>
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4
              className="text-[11px] font-semibold tracking-[0.15em] uppercase text-[var(--w-blue)]"
              style={{ fontFamily: "var(--font-bricolage), sans-serif" }}
            >
              Platform
            </h4>
            <ul className="mt-4 space-y-2.5">
              {[
                ["Integrations", "/integrations"],
                ["About", "/about"],
                ["Developers", "/developers"],
                ["Compliance", "/compliance"],
              ].map(([label, href]) => (
                <li key={href}>
                  <Link href={href} className={linkClass} style={linkStyle}>
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
            <h4
              className="mt-8 text-[11px] font-semibold tracking-[0.15em] uppercase text-[var(--w-blue)]"
              style={{ fontFamily: "var(--font-bricolage), sans-serif" }}
            >
              Legal
            </h4>
            <ul className="mt-4 space-y-2.5">
              {[
                ["Terms", "/terms"],
                ["Privacy", "/privacy"],
                ["Refund Policy", "/refund-policy"],
              ].map(([label, href]) => (
                <li key={href}>
                  <Link href={href} className={linkClass} style={linkStyle}>
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div
          className="mt-12 flex flex-col items-center justify-between gap-4 border-t pt-6 sm:flex-row"
          style={{ borderColor: "var(--w-border)" }}
        >
          <p style={{ color: "rgba(241,245,249,0.25)", fontFamily: "var(--font-jakarta), sans-serif", fontSize: 12 }}>
            © 2026 TruckMates. All rights reserved.
          </p>
          <p style={{ color: "rgba(241,245,249,0.25)", fontFamily: "var(--font-jakarta), sans-serif", fontSize: 12 }}>
            Built for US trucking carriers.
          </p>
        </div>
      </div>
    </footer>
  )
}
