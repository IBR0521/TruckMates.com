"use client"

import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { 
  Save, 
  Building2, 
  Bell, 
  Shield, 
  Users, 
  User, 
  Mail, 
  Phone, 
  MapPin,
  Settings as SettingsIcon,
  CreditCard,
  Globe,
  Lock,
  Eye,
  EyeOff
} from "lucide-react"
import { toast } from "sonner"
import { useEffect, useState } from "react"
import { getCompany, updateCompany } from "@/app/actions/company"
import { getUserProfile } from "@/app/actions/user"
import { getNotificationPreferences, updateNotificationPreferences, sendTestEmail, checkEmailConfiguration } from "@/app/actions/notifications"
import Link from "next/link"
import { Switch } from "@/components/ui/switch"
import { Alert, AlertDescription } from "@/components/ui/alert"

export default function SettingsPage() {
  const [companyData, setCompanyData] = useState<{
    name: string
    email: string
    phone: string
    address?: string
  } | null>(null)
  const [userData, setUserData] = useState<{
    full_name: string
    email: string
    phone: string
    role: string
  } | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isManager, setIsManager] = useState(false)
  const [companyFormData, setCompanyFormData] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
  })
  const [userFormData, setUserFormData] = useState({
    full_name: "",
    phone: "",
  })
  const [notificationSettings, setNotificationSettings] = useState({
    email_alerts: true,
    sms_alerts: true,
    weekly_reports: false,
    route_updates: true,
    load_updates: true,
    maintenance_alerts: true,
    payment_reminders: true,
  })
  const [securitySettings, setSecuritySettings] = useState({
    twoFactor: false,
    sessionTimeout: "30",
  })
  const [emailConfig, setEmailConfig] = useState<{
    configured: boolean
    fromEmail: string
    message: string
  } | null>(null)
  const [isSendingTest, setIsSendingTest] = useState(false)

  useEffect(() => {
    async function loadData() {
      const [companyResult, userResult, notificationResult, emailConfigResult] = await Promise.all([
        getCompany(),
        getUserProfile(),
        getNotificationPreferences(),
        checkEmailConfiguration(),
      ])
      
      if (companyResult.error) {
        toast.error(companyResult.error)
      } else if (companyResult.data) {
        setCompanyData(companyResult.data)
        setCompanyFormData({
          name: companyResult.data.name || "",
          email: companyResult.data.email || "",
          phone: companyResult.data.phone || "",
          address: companyResult.data.address || "",
        })
      }
      
      if (userResult.error) {
        toast.error(userResult.error)
      } else if (userResult.data) {
        setUserData(userResult.data)
        setIsManager(userResult.data.role === "manager")
        setUserFormData({
          full_name: userResult.data.full_name || "",
          phone: userResult.data.phone || "",
        })
      }

      if (notificationResult.data) {
        setNotificationSettings({
          email_alerts: notificationResult.data.email_alerts ?? true,
          sms_alerts: notificationResult.data.sms_alerts ?? true,
          weekly_reports: notificationResult.data.weekly_reports ?? false,
          route_updates: notificationResult.data.route_updates ?? true,
          load_updates: notificationResult.data.load_updates ?? true,
          maintenance_alerts: notificationResult.data.maintenance_alerts ?? true,
          payment_reminders: notificationResult.data.payment_reminders ?? true,
        })
      }

      if (emailConfigResult) {
        setEmailConfig(emailConfigResult)
      }
      
      setIsLoading(false)
    }
    loadData()
  }, [])

  const handleCompanySave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isManager) {
      toast.error("Only managers can update company information")
      return
    }
    
    setIsSaving(true)

    const form = new FormData()
    form.append("name", companyFormData.name)
    form.append("email", companyFormData.email)
    form.append("phone", companyFormData.phone)

    const result = await updateCompany(form)
    
    if (result.success) {
      toast.success("Company settings saved successfully")
      setCompanyData({
        ...companyData!,
        name: companyFormData.name,
        email: companyFormData.email,
        phone: companyFormData.phone,
      })
    } else {
      toast.error(result.error || "Failed to save company settings")
    }
    setIsSaving(false)
  }

  const handleUserSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    
    const result = await updateUserProfile({
      full_name: userFormData.full_name,
      phone: userFormData.phone,
    })
    
    if (result.error) {
      toast.error(result.error || "Failed to save profile settings")
    } else {
      toast.success("Profile settings saved successfully")
      if (userData) {
        setUserData({
          ...userData,
          full_name: userFormData.full_name,
          phone: userFormData.phone,
        })
      }
    }
    setIsSaving(false)
  }

  if (isLoading) {
    return (
      <div className="w-full">
        <div className="border-b border-border bg-card/50 backdrop-blur px-4 md:px-8 py-4">
          <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        </div>
        <div className="p-4 md:p-8">
          <div className="max-w-4xl mx-auto">
            <p className="text-muted-foreground">Loading...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full">
      {/* Header */}
      <div className="border-b border-border bg-card/50 backdrop-blur px-4 md:px-8 py-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Settings</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage your account and company settings</p>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 md:p-8">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Company Information - Only for Managers */}
          {isManager && (
            <Card className="border-border p-6">
              <div className="flex items-center gap-3 mb-6">
                <Building2 className="w-5 h-5 text-primary" />
                <h2 className="text-xl font-bold text-foreground">Company Information</h2>
              </div>
              {companyData ? (
                <form onSubmit={handleCompanySave} className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="company-name">Company Name *</Label>
                      <Input
                        id="company-name"
                        type="text"
                        placeholder="Your Company"
                        value={companyFormData.name}
                        onChange={(e) => setCompanyFormData({ ...companyFormData, name: e.target.value })}
                        className="mt-2"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="company-email">Company Email *</Label>
                      <Input
                        id="company-email"
                        type="email"
                        placeholder="admin@company.com"
                        value={companyFormData.email}
                        onChange={(e) => setCompanyFormData({ ...companyFormData, email: e.target.value })}
                        className="mt-2"
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="company-phone">Company Phone</Label>
                      <Input
                        id="company-phone"
                        type="tel"
                        placeholder="+1 (555) 123-4567"
                        value={companyFormData.phone}
                        onChange={(e) => setCompanyFormData({ ...companyFormData, phone: e.target.value })}
                        className="mt-2"
                      />
                    </div>
                    <div>
                      <Label htmlFor="company-address">Company Address</Label>
                      <Input
                        id="company-address"
                        type="text"
                        placeholder="123 Main St, City, State ZIP"
                        value={companyFormData.address}
                        onChange={(e) => setCompanyFormData({ ...companyFormData, address: e.target.value })}
                        className="mt-2"
                      />
                    </div>
                  </div>
                  <Button 
                    type="submit" 
                    disabled={isSaving}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    {isSaving ? "Saving..." : "Save Company Settings"}
                  </Button>
                </form>
              ) : (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">No company information found. Please contact support.</p>
                </div>
              )}
            </Card>
          )}

          {/* User Profile Settings */}
          <Card className="border-border p-6">
            <div className="flex items-center gap-3 mb-6">
              <User className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-bold text-foreground">Profile Settings</h2>
            </div>
            {userData && (
              <form onSubmit={handleUserSave} className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="full-name">Full Name *</Label>
                    <Input
                      id="full-name"
                      type="text"
                      placeholder="John Doe"
                      value={userFormData.full_name}
                      onChange={(e) => setUserFormData({ ...userFormData, full_name: e.target.value })}
                      className="mt-2"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="user-email">Email</Label>
                    <Input
                      id="user-email"
                      type="email"
                      value={userData.email}
                      disabled
                      className="mt-2 bg-muted"
                    />
                    <p className="text-xs text-muted-foreground mt-1">Email cannot be changed</p>
                  </div>
                  <div>
                    <Label htmlFor="user-phone">Phone Number</Label>
                    <Input
                      id="user-phone"
                      type="tel"
                      placeholder="+1 (555) 123-4567"
                      value={userFormData.phone}
                      onChange={(e) => setUserFormData({ ...userFormData, phone: e.target.value })}
                      className="mt-2"
                    />
                  </div>
                  <div>
                    <Label htmlFor="user-role">Account Type</Label>
                    <Input
                      id="user-role"
                      type="text"
                      value={userData.role === "manager" ? "Manager" : "Employee"}
                      disabled
                      className="mt-2 bg-muted capitalize"
                    />
                  </div>
                </div>
                <Button 
                  type="submit" 
                  disabled={isSaving}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {isSaving ? "Saving..." : "Save Profile"}
                </Button>
              </form>
            )}
          </Card>

          {/* Employee Management - Only for Managers */}
          {isManager && (
            <Card className="border-border p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <Users className="w-5 h-5 text-primary" />
                  <h2 className="text-xl font-bold text-foreground">Employee Management</h2>
                </div>
              </div>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Manage your employees and control access to your company account.
                </p>
                <div className="flex gap-3">
                  <Link href="/dashboard/employees" className="flex-1">
                    <Button variant="outline" className="w-full">
                      <Users className="w-4 h-4 mr-2" />
                      View All Employees
                    </Button>
                  </Link>
                  <Link href="/dashboard/drivers" className="flex-1">
                    <Button variant="outline" className="w-full">
                      <Users className="w-4 h-4 mr-2" />
                      View All Drivers
                    </Button>
                  </Link>
                </div>
              </div>
            </Card>
          )}

          {/* Notification Settings */}
          <Card className="border-border p-6">
            <div className="flex items-center gap-3 mb-6">
              <Bell className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-bold text-foreground">Notification Settings</h2>
            </div>
            <div className="space-y-4">
              {/* Email Configuration Status */}
              {emailConfig && (
                <Alert className={emailConfig.configured ? "border-green-500/50 bg-green-500/10" : "border-yellow-500/50 bg-yellow-500/10"}>
                  <Mail className={`w-4 h-4 ${emailConfig.configured ? "text-green-500" : "text-yellow-500"}`} />
                  <AlertDescription>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className={`font-medium ${emailConfig.configured ? "text-green-400" : "text-yellow-400"}`}>
                          {emailConfig.configured ? "✓ Email Service Configured" : "⚠ Email Service Not Configured"}
                        </p>
                        <p className="text-sm text-muted-foreground mt-1">
                          {emailConfig.message}
                        </p>
                        {emailConfig.configured && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Sending from: {emailConfig.fromEmail}
                          </p>
                        )}
                      </div>
                    </div>
                  </AlertDescription>
                </Alert>
              )}
              
              {/* Test Email Button */}
              {emailConfig?.configured && (
                <div className="p-4 bg-secondary/50 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-foreground font-medium">Test Email Notifications</p>
                      <p className="text-sm text-muted-foreground">Send a test email to verify your email service is working</p>
                    </div>
                    <Button
                      onClick={async () => {
                        setIsSendingTest(true)
                        const result = await sendTestEmail()
                        setIsSendingTest(false)
                        if (result.sent) {
                          toast.success(result.message || `Test email sent to ${result.email}`)
                        } else {
                          toast.error(result.error || "Failed to send test email")
                        }
                      }}
                      disabled={isSendingTest}
                      variant="outline"
                      className="border-primary text-primary hover:bg-primary/10"
                    >
                      <Mail className="w-4 h-4 mr-2" />
                      {isSendingTest ? "Sending..." : "Send Test Email"}
                    </Button>
                  </div>
                </div>
              )}
              
              <div className="border-t border-border pt-4">
                <p className="text-sm font-medium text-foreground mb-4">Notification Preferences</p>
              </div>
              
              {/* Master Email Alerts Toggle */}
              <div className="flex items-center justify-between p-4 bg-secondary/50 rounded-lg border-2 border-primary/20">
                <div>
                  <p className="text-foreground font-medium">Enable Email Notifications</p>
                  <p className="text-sm text-muted-foreground">Master switch for all email notifications</p>
                </div>
                <Switch
                  checked={notificationSettings.email_alerts}
                  onCheckedChange={(checked) => 
                    setNotificationSettings({ ...notificationSettings, email_alerts: checked })
                  }
                />
              </div>
              
              <div className="flex items-center justify-between p-4 bg-secondary/50 rounded-lg">
                <div>
                  <p className="text-foreground font-medium">Email Alerts for Route Updates</p>
                  <p className="text-sm text-muted-foreground">Receive email notifications when routes are updated</p>
                </div>
                <Switch
                  checked={notificationSettings.route_updates && notificationSettings.email_alerts}
                  disabled={!notificationSettings.email_alerts}
                  onCheckedChange={(checked) => 
                    setNotificationSettings({ ...notificationSettings, route_updates: checked })
                  }
                />
              </div>
              <div className="flex items-center justify-between p-4 bg-secondary/50 rounded-lg">
                <div>
                  <p className="text-foreground font-medium">Email Alerts for Load Updates</p>
                  <p className="text-sm text-muted-foreground">Get notified when load status changes</p>
                </div>
                <Switch
                  checked={notificationSettings.load_updates && notificationSettings.email_alerts}
                  disabled={!notificationSettings.email_alerts}
                  onCheckedChange={(checked) => 
                    setNotificationSettings({ ...notificationSettings, load_updates: checked })
                  }
                />
              </div>
              <div className="flex items-center justify-between p-4 bg-secondary/50 rounded-lg">
                <div>
                  <p className="text-foreground font-medium">SMS Alerts for Emergencies</p>
                  <p className="text-sm text-muted-foreground">Receive SMS notifications for urgent matters</p>
                </div>
                <Switch
                  checked={notificationSettings.sms_alerts}
                  onCheckedChange={(checked) => 
                    setNotificationSettings({ ...notificationSettings, sms_alerts: checked })
                  }
                />
              </div>
              <div className="flex items-center justify-between p-4 bg-secondary/50 rounded-lg">
                <div>
                  <p className="text-foreground font-medium">Weekly Performance Reports</p>
                  <p className="text-sm text-muted-foreground">Receive weekly summary reports via email</p>
                </div>
                <Switch
                  checked={notificationSettings.weekly_reports && notificationSettings.email_alerts}
                  disabled={!notificationSettings.email_alerts}
                  onCheckedChange={(checked) => 
                    setNotificationSettings({ ...notificationSettings, weekly_reports: checked })
                  }
                />
              </div>
              <div className="flex items-center justify-between p-4 bg-secondary/50 rounded-lg">
                <div>
                  <p className="text-foreground font-medium">Maintenance Alerts</p>
                  <p className="text-sm text-muted-foreground">Get notified about upcoming maintenance schedules</p>
                </div>
                <Switch
                  checked={notificationSettings.maintenance_alerts && notificationSettings.email_alerts}
                  disabled={!notificationSettings.email_alerts}
                  onCheckedChange={(checked) => 
                    setNotificationSettings({ ...notificationSettings, maintenance_alerts: checked })
                  }
                />
              </div>
              <div className="flex items-center justify-between p-4 bg-secondary/50 rounded-lg">
                <div>
                  <p className="text-foreground font-medium">Payment Reminders</p>
                  <p className="text-sm text-muted-foreground">Receive reminders for pending payments and settlements</p>
                </div>
                <Switch
                  checked={notificationSettings.payment_reminders && notificationSettings.email_alerts}
                  disabled={!notificationSettings.email_alerts}
                  onCheckedChange={(checked) => 
                    setNotificationSettings({ ...notificationSettings, payment_reminders: checked })
                  }
                />
              </div>
              <Button 
                onClick={async () => {
                  const result = await updateNotificationPreferences(notificationSettings)
                  if (result.success) {
                    toast.success("Notification settings saved successfully")
                  } else {
                    toast.error(result.error || "Failed to save notification settings")
                  }
                }}
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                <Save className="w-4 h-4 mr-2" />
                Save Notification Settings
              </Button>
            </div>
          </Card>

          {/* Security Settings */}
          <Card className="border-border p-6">
            <div className="flex items-center gap-3 mb-6">
              <Shield className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-bold text-foreground">Security Settings</h2>
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-secondary/50 rounded-lg">
                <div>
                  <p className="text-foreground font-medium">Two-Factor Authentication</p>
                  <p className="text-sm text-muted-foreground">Add an extra layer of security to your account</p>
                </div>
                <Switch
                  checked={securitySettings.twoFactor}
                  onCheckedChange={(checked) => 
                    setSecuritySettings({ ...securitySettings, twoFactor: checked })
                  }
                />
              </div>
              <div className="p-4 bg-secondary/50 rounded-lg">
                <Label htmlFor="session-timeout">Session Timeout (minutes)</Label>
                <Input
                  id="session-timeout"
                  type="number"
                  min="5"
                  max="480"
                  value={securitySettings.sessionTimeout}
                  onChange={(e) => setSecuritySettings({ ...securitySettings, sessionTimeout: e.target.value })}
                  className="mt-2 max-w-xs"
                />
                <p className="text-xs text-muted-foreground mt-1">Automatically log out after inactivity</p>
              </div>
              <div className="pt-4">
                <Button variant="outline" className="text-red-400 border-red-400 hover:bg-red-400/10">
                  <Lock className="w-4 h-4 mr-2" />
                  Change Password
                </Button>
              </div>
              <Button 
                onClick={() => toast.success("Security settings saved")}
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                <Save className="w-4 h-4 mr-2" />
                Save Security Settings
              </Button>
            </div>
          </Card>

          {/* System Settings */}
          <Card className="border-border p-6">
            <div className="flex items-center gap-3 mb-6">
              <SettingsIcon className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-bold text-foreground">System Settings</h2>
            </div>
            <div className="space-y-4">
              <div className="p-4 bg-secondary/50 rounded-lg">
                <Label htmlFor="timezone">Timezone</Label>
                <select
                  id="timezone"
                  className="mt-2 w-full px-3 py-2 bg-background border border-border rounded-md text-foreground"
                  defaultValue="America/New_York"
                >
                  <option value="America/New_York">Eastern Time (ET)</option>
                  <option value="America/Chicago">Central Time (CT)</option>
                  <option value="America/Denver">Mountain Time (MT)</option>
                  <option value="America/Los_Angeles">Pacific Time (PT)</option>
                </select>
              </div>
              <div className="p-4 bg-secondary/50 rounded-lg">
                <Label htmlFor="date-format">Date Format</Label>
                <select
                  id="date-format"
                  className="mt-2 w-full px-3 py-2 bg-background border border-border rounded-md text-foreground"
                  defaultValue="MM/DD/YYYY"
                >
                  <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                  <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                  <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                </select>
              </div>
              <div className="p-4 bg-secondary/50 rounded-lg">
                <Label htmlFor="currency">Currency</Label>
                <select
                  id="currency"
                  className="mt-2 w-full px-3 py-2 bg-background border border-border rounded-md text-foreground"
                  defaultValue="USD"
                >
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="GBP">GBP (£)</option>
                  <option value="CAD">CAD (C$)</option>
                </select>
              </div>
              <Button 
                onClick={() => toast.success("System settings saved")}
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                <Save className="w-4 h-4 mr-2" />
                Save System Settings
              </Button>
            </div>
          </Card>

        </div>
      </div>
    </div>
  )
}
