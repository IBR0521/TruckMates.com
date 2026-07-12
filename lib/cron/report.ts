import * as Sentry from "@sentry/nextjs"

/**
 * Alert on a cron failure. The scheduled jobs are the automation heartbeat — a silently dead cron
 * means a whole class of "runs while you sleep" automation quietly stops. Vercel logs the 500, but
 * this surfaces it as a Sentry issue so it actually pages someone. Call from the failure paths
 * (catch block AND any handled `result.error`) of a cron route.
 */
export function reportCronFailure(cron: string, error: unknown, context?: Record<string, unknown>): void {
  const err = error instanceof Error ? error : new Error(String(error))
  Sentry.captureException(err, {
    level: "error",
    tags: { area: "cron", cron },
    extra: context,
  })
}
