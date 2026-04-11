"use client"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import {
  User,
  Save,
  Lock,
  Eye,
  EyeOff,
  Globe,
  Download,
  Trash2,
} from "lucide-react"
import { toast } from "sonner"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { getAccountSettings, updateAccountSettings, changePassword } from "@/app/actions/settings-account"
import { getCompanySettings, updateCompanySettings } from "@/app/actions/number-formats"
import { deleteMyOwnAccount } from "@/app/actions/account-privacy"
import { createClient } from "@/lib/supabase/client"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

export default function AccountSettingsPage() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [account, setAccount] = useState({
    full_name: "",
    email: "",
    phone: "",
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
    timezone: "America/New_York",
  })

  useEffect(() => {
    async function loadSettings() {
      setIsLoading(true)
      try {
        const [accountResult, companyResult] = await Promise.all([
          getAccountSettings(),
          getCompanySettings(),
        ])
        
        if (accountResult.error) {
          toast.error(accountResult.error)
        } else if (accountResult.data) {
          setAccount({
            full_name: accountResult.data.full_name || "",
            email: accountResult.data.email || "",
            phone: accountResult.data.phone || "",
            currentPassword: "",
            newPassword: "",
            confirmPassword: "",
            timezone: companyResult.data?.timezone || "America/New_York",
          })
        }
      } catch (error) {
        toast.error("Failed to load account settings")
      } finally {
        setIsLoading(false)
      }
    }
    loadSettings()
  }, [])

  const handleSaveProfile = async () => {
    setIsSaving(true)
    try {
      const [accountResult, timezoneResult] = await Promise.all([
        updateAccountSettings({
          full_name: account.full_name,
          phone: account.phone,
        }),
        updateCompanySettings({
          timezone: account.timezone,
        }),
      ])

      if (accountResult.error) {
        toast.error(accountResult.error)
      } else if (timezoneResult.error) {
        toast.error(timezoneResult.error)
      } else {
        toast.success("Profile settings saved successfully")
      }
    } catch (error) {
      toast.error("Failed to save profile settings")
    } finally {
      setIsSaving(false)
    }
  }

  const handleChangePassword = async () => {
    if (account.newPassword !== account.confirmPassword) {
      toast.error("New passwords do not match")
      return
    }

    if (account.newPassword.length < 6) {
      toast.error("Password must be at least 6 characters")
      return
    }

    setIsSaving(true)
    try {
      const result = await changePassword(account.currentPassword, account.newPassword)

      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success("Password updated successfully")
        setAccount({
          ...account,
          currentPassword: "",
          newPassword: "",
          confirmPassword: "",
        })
      }
    } catch (error) {
      toast.error("Failed to update password")
    } finally {
      setIsSaving(false)
    }
  }

  const handleExportData = async () => {
    setIsExporting(true)
    try {
      const res = await fetch("/api/export/company-data", {
        method: "GET",
        credentials: "include",
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        toast.error(typeof err?.error === "string" ? err.error : "Export failed")
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `truckmates-export-${Date.now()}.json`
      a.rel = "noopener"
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      toast.success("Download started")
    } catch {
      toast.error("Could not download export")
    } finally {
      setIsExporting(false)
    }
  }

  const handleDeleteAccount = async () => {
    setIsSaving(true)
    try {
      const result = await deleteMyOwnAccount(deleteConfirm)
      if (result.error) {
        toast.error(result.error)
        return
      }
      toast.success("Account deleted")
      await createClient().auth.signOut({ scope: "local" })
      router.push("/login")
      router.refresh()
    } catch {
      toast.error("Account deletion failed")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="w-full p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground flex items-center gap-2">
            <User className="w-6 h-6" />
            My Account
          </h1>
          <p className="text-muted-foreground mt-2">
            Manage your personal account settings
          </p>
        </div>

        {isLoading ? (
          <Card className="p-6">
            <p className="text-muted-foreground">Loading...</p>
          </Card>
        ) : (
          <>
            <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">Profile Information</h2>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Full Name</Label>
              <Input
                value={account.full_name}
                onChange={(e) => setAccount({ ...account, full_name: e.target.value })}
                placeholder="Enter your full name"
              />
            </div>

            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={account.email}
                disabled
                className="bg-muted"
                placeholder="your@email.com"
              />
              <p className="text-xs text-muted-foreground">Email cannot be changed</p>
            </div>

            <div className="space-y-2">
              <Label>Phone</Label>
              <Input
                type="tel"
                value={account.phone}
                onChange={(e) => setAccount({ ...account, phone: e.target.value })}
                placeholder="+1 (555) 000-0000"
              />
            </div>
          </div>

          <div className="mt-6 flex justify-end">
            <Button onClick={handleSaveProfile} disabled={isSaving} className="w-full sm:w-auto">
              <Save className="w-4 h-4 mr-2" />
              {isSaving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Globe className="w-5 h-5" />
            Time Zone
          </h2>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Timezone</Label>
              <Select value={account.timezone} onValueChange={(value) => setAccount({ ...account, timezone: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="America/New_York">Eastern Time (ET)</SelectItem>
                  <SelectItem value="America/Chicago">Central Time (CT)</SelectItem>
                  <SelectItem value="America/Denver">Mountain Time (MT)</SelectItem>
                  <SelectItem value="America/Los_Angeles">Pacific Time (PT)</SelectItem>
                  <SelectItem value="America/Anchorage">Alaska Time (AKT)</SelectItem>
                  <SelectItem value="Pacific/Honolulu">Hawaii Time (HST)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Your timezone preference for the platform</p>
            </div>
          </div>

          <div className="mt-6 flex justify-end">
            <Button onClick={handleSaveProfile} disabled={isSaving} className="w-full sm:w-auto">
              <Save className="w-4 h-4 mr-2" />
              {isSaving ? "Saving..." : "Save Time Zone"}
            </Button>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">Change Password</h2>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Current Password</Label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={account.currentPassword}
                  onChange={(e) => setAccount({ ...account, currentPassword: e.target.value })}
                  placeholder="Enter current password"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>New Password</Label>
              <Input
                type="password"
                value={account.newPassword}
                onChange={(e) => setAccount({ ...account, newPassword: e.target.value })}
                placeholder="Enter new password"
              />
            </div>

            <div className="space-y-2">
              <Label>Confirm New Password</Label>
              <Input
                type="password"
                value={account.confirmPassword}
                onChange={(e) => setAccount({ ...account, confirmPassword: e.target.value })}
                placeholder="Confirm new password"
              />
            </div>
          </div>

          <div className="mt-6 flex justify-end">
            <Button onClick={handleChangePassword} disabled={isSaving} className="w-full sm:w-auto">
              <Save className="w-4 h-4 mr-2" />
              {isSaving ? "Updating..." : "Update Password"}
            </Button>
          </div>
        </Card>

        <Card className="p-6 border-destructive/30">
          <h2 className="text-lg font-semibold mb-2 flex items-center gap-2">
            <Download className="w-5 h-5" />
            Data export
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            Download a JSON snapshot of data associated with your company (scope depends on your role and server configuration).
            This does not replace a full legal data subject request process if you operate in regulated regions.
          </p>
          <Button type="button" variant="outline" onClick={handleExportData} disabled={isExporting}>
            {isExporting ? "Preparing…" : "Download data export"}
          </Button>
        </Card>

        <Card className="p-6 border-destructive/40">
          <h2 className="text-lg font-semibold mb-2 flex items-center gap-2 text-destructive">
            <Trash2 className="w-5 h-5" />
            Delete account
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            Permanently deletes <strong className="text-foreground">your</strong> login and profile. Your company and other
            team members are not removed. This cannot be undone.
          </p>
          <div className="space-y-3 max-w-md">
            <div className="space-y-2">
              <Label>Type DELETE MY ACCOUNT to confirm</Label>
              <Input
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
                placeholder="DELETE MY ACCOUNT"
                autoComplete="off"
              />
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button type="button" variant="destructive" disabled={isSaving}>
                  Delete my account
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete your account?</AlertDialogTitle>
                  <AlertDialogDescription>
                    You will lose access immediately. Company data and other users stay in the system.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={(e) => {
                      e.preventDefault()
                      void handleDeleteAccount()
                    }}
                  >
                    Yes, delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </Card>
          </>
        )}
      </div>
    </div>
  )
}

