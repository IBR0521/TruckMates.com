import * as Sentry from "@sentry/nextjs"
import { createAdminClient } from "@/lib/supabase/admin"
import { getResendClientForCompany } from "@/lib/resend-client"
import { resolveCustomerEmail, resolveCustomerEmailFromSources } from "@/lib/customer-email"
import {
  CHECK_CALL_NOTIFY_EVENT_LABELS,
  isCheckCallNotifyEventEnabled,
  type CheckCallNotifyEvent,
} from "@/lib/check-call-notify-events"

export const CHECK_CALL_NOTIFY_SETTINGS_SELECT =
  "check_call_notify_customer, check_call_notify_broker, check_call_notify_on_trip_start, check_call_notify_at_shipper, check_call_notify_pickup_completed, check_call_notify_enroute, check_call_notify_at_consignee, check_call_notify_dropoff_completed"

type NotifyContext = {
  location?: string | null
  notes?: string | null
}

/** Send customer/broker email for a load milestone (check-call or status event). */
export async function notifyCustomerBrokerForCheckCallEvent(
  companyId: string,
  loadId: string,
  event: CheckCallNotifyEvent,
  context?: NotifyContext,
): Promise<void> {
  const admin = createAdminClient()

  const { data: settings } = await admin
    .from("company_settings")
    .select(CHECK_CALL_NOTIFY_SETTINGS_SELECT)
    .eq("company_id", companyId)
    .maybeSingle()

  if (!isCheckCallNotifyEventEnabled(settings, event)) return

  const { data: load } = await admin
    .from("loads")
    .select(
      "id, shipment_number, origin, destination, customer_id, broker_id, shipper_contact_email, consignee_contact_email",
    )
    .eq("id", loadId)
    .eq("company_id", companyId)
    .maybeSingle()

  if (!load) return

  const recipients = new Map<string, string>()

  if (load.customer_id) {
    const { data: customer } = await admin
      .from("customers")
      .select("email, primary_contact_email")
      .eq("id", load.customer_id)
      .eq("company_id", companyId)
      .maybeSingle()
    const email = resolveCustomerEmail(customer)
    if (email) recipients.set(email, "customer")
  }

  const contactEmail = resolveCustomerEmailFromSources([
    load.consignee_contact_email,
    load.shipper_contact_email,
  ])
  if (contactEmail) recipients.set(contactEmail, "contact")

  const notifyBroker = settings?.check_call_notify_broker !== false
  if (notifyBroker && load.broker_id) {
    const { data: broker } = await admin
      .from("brokers")
      .select("email")
      .eq("id", load.broker_id)
      .eq("company_id", companyId)
      .maybeSingle()
    const brokerEmail = String(broker?.email || "").trim()
    if (brokerEmail.includes("@")) recipients.set(brokerEmail, "broker")
  }

  if (recipients.size === 0) return

  const resend = await getResendClientForCompany(companyId)
  if (!resend) return

  const label = CHECK_CALL_NOTIFY_EVENT_LABELS[event]
  const shipment = load.shipment_number || "Load"
  const route =
    load.origin && load.destination ? `${load.origin} → ${load.destination}` : "your shipment"
  const subject = `${label}: ${shipment}`
  const detailLines = [
    `<p><strong>Load:</strong> ${shipment}</p>`,
    `<p><strong>Route:</strong> ${route}</p>`,
    `<p><strong>Update:</strong> ${label}</p>`,
  ]
  if (context?.location) detailLines.push(`<p><strong>Location:</strong> ${context.location}</p>`)
  if (context?.notes) detailLines.push(`<p><strong>Notes:</strong> ${context.notes}</p>`)

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #111;">
      <h2 style="margin: 0 0 12px;">${label}</h2>
      ${detailLines.join("\n")}
      <p style="color: #666; font-size: 12px; margin-top: 24px;">Sent by TruckMates dispatch check-call notifications.</p>
    </div>
  `

  const fromEmail = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev"

  for (const [email] of recipients) {
    try {
      await resend.emails.send({ from: fromEmail, to: email, subject, html })
    } catch (error) {
      Sentry.captureException(error, {
        extra: { companyId, loadId, event, email },
      })
    }
  }
}
