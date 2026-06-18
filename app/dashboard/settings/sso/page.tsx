import { FeatureLock } from "@/components/billing/feature-lock"
import { SsoSettingsClientPage } from "./ui-client"

export default function SsoSettingsPage() {
  return (
    <FeatureLock
      featureKey="sso"
      title="Enterprise SSO (SAML 2.0)"
      description="Connect your identity provider so drivers and staff sign in with your corporate directory. SAML login is configured here; the sign-in button and ACS endpoint ship in a later phase."
    >
      <SsoSettingsClientPage />
    </FeatureLock>
  )
}
