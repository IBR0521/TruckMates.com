import { describe, expect, it } from "vitest"
import {
  companyAllowsEmail,
  companyAllowsInApp,
  companyAllowsSms,
  parseNotificationChannels,
} from "../../lib/company-notification-channels"

describe("lib/company-notification-channels.ts", () => {
  it("parses valid channel arrays", () => {
    expect(parseNotificationChannels(["email", "in_app"])).toEqual(["email", "in_app"])
    expect(parseNotificationChannels(null)).toEqual(["email", "in_app"])
  })

  it("gates email and sms by company channels", () => {
    expect(companyAllowsEmail(["in_app"])).toBe(false)
    expect(companyAllowsSms(["email", "sms"])).toBe(true)
    expect(companyAllowsInApp(["email"])).toBe(false)
  })
})
