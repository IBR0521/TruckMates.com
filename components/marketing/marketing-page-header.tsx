import type { LucideIcon } from "lucide-react"
import { DotBg, WBody, WEyebrow, WSectionHeading } from "@/components/marketing/marketing-ui"

export function MarketingPageHeader({
  icon: Icon,
  title,
  subtitle,
}: {
  icon?: LucideIcon
  title: string
  subtitle: string
}) {
  return (
    <div className="relative overflow-hidden border-b" style={{ background: "var(--w-bg)", borderColor: "var(--w-border)" }}>
      <DotBg />
      <div
        className="pointer-events-none absolute top-0 left-1/2 h-[500px] w-[500px] -translate-x-1/2 blur-3xl"
        style={{ background: "radial-gradient(circle, var(--w-blue-dim) 0%, transparent 70%)" }}
        aria-hidden
      />
      <div className="relative mx-auto max-w-[760px] px-6 pt-[130px] pb-16 text-center">
        {Icon ? (
          <div
            className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-[14px] border"
            style={{ background: "var(--w-blue-dim)", borderColor: "var(--w-blue-border)" }}
          >
            <Icon className="h-6 w-6 text-[var(--w-blue)]" strokeWidth={1.75} />
          </div>
        ) : null}
        <WSectionHeading className="text-center">{title}</WSectionHeading>
        <WBody className="mx-auto mt-4 max-w-[600px] text-center">{subtitle}</WBody>
      </div>
    </div>
  )
}
