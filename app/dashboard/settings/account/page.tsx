"use client"

import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { 
  User, 
  Save,
  Mail,
  Phone,
  Lock,
  Eye,
  EyeOff,
} from "lucide-react"
import { toast } from "sonner"
import { useState, useEffect } from "react"
import { getAccountSettings, updateAccountSettings, changePassword } from "@/app/actions/settings-account"

export default function AccountSettingsPage() {
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [account, setAccount] = useState({
    full_name: "",
    email: "",
    phone: "",
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  })

  useEffect(() => {
    async function loadSettings() {
      setIsLoading(true)
      try {
        const result = await getAccountSettings()
        if (result.error) {
          toast.error(result.error)
        } else if (result.data) {
          setAccount({
            full_name: result.data.full_name || "",
            email: result.data.email || "",
            phone: result.data.phone || "",
            currentPassword: "",
            newPassword: "",
            confirmPassword: "",
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
      const result = await updateAccountSettings({
        full_name: account.full_name,
        phone: account.phone,
      })

      if (result.error) {
        toast.error(result.error)
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
            <Button onClick={handleSaveProfile} disabled={isSaving}>
              <Save className="w-4 h-4 mr-2" />
              {isSaving ? "Saving..." : "Save Changes"}
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
            <Button onClick={handleChangePassword} disabled={isSaving}>
              <Save className="w-4 h-4 mr-2" />
              {isSaving ? "Updating..." : "Update Password"}
            </Button>
          </div>
        </Card>
          </>
        )}
      </div>
    </div>
  )
}

