"use client"

import { cn } from "@/lib/utils"

export type EldSyncUrgency = "fresh" | "warn" | "stale" | "never" | "invalid"

export type EldSyncVisual = {
  urgency: EldSyncUrgency
  /** Tailwind classes for the status dot */
  dotCls: string
  /** Short label: Fresh / Lagging / Stale / Never synced */
  headline: string
  /** Secondary line (timestamp + hint) */
  detail: string
  /** Card left border accent */
  cardBorderCls: string
  /** Filled badge strip (high visibility) */
  badgeCls: string
  title: string
}

/**
 * Normalize API shapes (Supabase snake_case vs occasional camelCase).
 */
export function getDeviceLastSyncAt(device: {
  last_sync_at?: string | null
  lastSyncAt?: string | null
}): string | null {
  const v = device.last_sync_at ?? device.lastSyncAt
  if (v == null || v === "") return null
  return String(v)
}

/**
 * Fleet ELD device sync health from `last_sync_at`.
 * Green: &lt; 15 min · Amber: 15 min–2 h · Red: &gt; 2 h or never.
 */
export function getEldSyncVisual(lastSyncAt: string | null | undefined): EldSyncVisual {
  if (lastSyncAt == null || lastSyncAt === "") {
    return {
      urgency: "never",
      dotCls: "bg-red-500 shadow-[0_0_0_2px_rgba(239,68,68,0.35)]",
      headline: "Never synced",
      detail: "No successful sync recorded — check power, cellular, or integration.",
      cardBorderCls: "border-l-red-500",
      badgeCls: "border-red-500/50 bg-red-500/15 text-red-700 dark:text-red-300",
      title: "Never synced",
    }
  }
  const t = new Date(lastSyncAt).getTime()
  if (!Number.isFinite(t)) {
    return {
      urgency: "invalid",
      dotCls: "bg-red-500",
      headline: "Invalid sync time",
      detail: String(lastSyncAt),
      cardBorderCls: "border-l-red-500",
      badgeCls: "border-red-500/50 bg-red-500/15 text-red-700 dark:text-red-300",
      title: "Invalid sync time",
    }
  }
  const ageMin = (Date.now() - t) / 60000
  const ts = new Date(lastSyncAt).toLocaleString()

  if (ageMin < 0) {
    return {
      urgency: "fresh",
      dotCls: "bg-emerald-500 shadow-[0_0_0_2px_rgba(16,185,129,0.35)]",
      headline: "Synced",
      detail: ts,
      cardBorderCls: "border-l-emerald-500",
      badgeCls: "border-emerald-500/50 bg-emerald-500/15 text-emerald-800 dark:text-emerald-200",
      title: "Recently synced",
    }
  }
  if (ageMin < 15) {
    return {
      urgency: "fresh",
      dotCls: "bg-emerald-500 shadow-[0_0_0_2px_rgba(16,185,129,0.35)]",
      headline: "Fresh",
      detail: `${Math.max(0, Math.round(ageMin))} min ago · ${ts}`,
      cardBorderCls: "border-l-emerald-500",
      badgeCls: "border-emerald-500/50 bg-emerald-500/15 text-emerald-800 dark:text-emerald-200",
      title: `Synced ${Math.max(0, Math.round(ageMin))} min ago`,
    }
  }
  if (ageMin < 120) {
    return {
      urgency: "warn",
      dotCls: "bg-amber-400 shadow-[0_0_0_2px_rgba(251,191,36,0.4)]",
      headline: "Lag",
      detail: `${Math.round(ageMin)} min since sync · ${ts}`,
      cardBorderCls: "border-l-amber-400",
      badgeCls: "border-amber-500/50 bg-amber-500/15 text-amber-900 dark:text-amber-200",
      title: `Last sync ${Math.round(ageMin)} min ago`,
    }
  }
  return {
    urgency: "stale",
    dotCls: "bg-red-500 shadow-[0_0_0_2px_rgba(239,68,68,0.35)]",
    headline: "Stale",
    detail: `${Math.round(ageMin / 60)}h since last sync · ${ts}`,
    cardBorderCls: "border-l-red-500",
    badgeCls: "border-red-500/50 bg-red-500/15 text-red-800 dark:text-red-200",
    title: `Stale — ${Math.round(ageMin / 60)}h since sync`,
  }
}

type BadgeProps = {
  lastSyncAt: string | null | undefined
  className?: string
}

/**
 * Visible sync health for ELD device surfaces — use on list cards and detail pages.
 */
export function EldDeviceSyncStatus({ lastSyncAt, className }: BadgeProps) {
  const s = getEldSyncVisual(lastSyncAt)

  return (
    <div
      className={cn(
        "rounded-md border px-2.5 py-2 text-xs leading-snug",
        s.badgeCls,
        className
      )}
      title={s.title}
    >
      <div className="flex items-center gap-2">
        <span className={cn("inline-block h-2.5 w-2.5 shrink-0 rounded-full", s.dotCls)} aria-hidden />
        <span className="font-semibold tracking-wide uppercase">{s.headline}</span>
      </div>
      <p className="mt-1 text-[11px] opacity-95">{s.detail}</p>
    </div>
  )
}
