"use client"

import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Save } from "lucide-react"
import { toast } from "sonner"
import { useEffect, useState } from "react"
import { getCompany, updateCompany } from "@/app/actions/company"

export default function SettingsPage() {
  const [companyData, setCompanyData] = useState<{
    name: string
    email: string
    phone: string
  } | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
  })

  useEffect(() => {
    async function loadCompany() {
      const result = await getCompany()
      if (result.error) {
        toast.error(result.error)
        setIsLoading(false)
        return
      }
      if (result.data) {
        setCompanyData(result.data)
        setFormData({
          name: result.data.name || "",
          email: result.data.email || "",
          phone: result.data.phone || "",
        })
      }
      setIsLoading(false)
    }
    loadCompany()
  }, [])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)

    const form = new FormData()
    form.append("name", formData.name)
    form.append("email", formData.email)
    form.append("phone", formData.phone)

    const result = await updateCompany(form)
    
    if (result.success) {
      toast.success("Settings saved successfully")
      setCompanyData({
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
      })
    } else {
      toast.error(result.error || "Failed to save settings")
    }
    setIsSaving(false)
  }

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="border-b border-border bg-card/50 backdrop-blur px-8 py-4">
          <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        </div>
        <main className="flex-1 overflow-auto p-8">
          <div className="max-w-2xl mx-auto">
            <p className="text-muted-foreground">Loading...</p>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="border-b border-border bg-card/50 backdrop-blur px-8 py-4">
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
      </div>

      {/* Content */}
      <main className="flex-1 overflow-auto p-8">
        <div className="max-w-2xl mx-auto space-y-8">
          {/* Company Settings */}
          <Card className="border-border p-8">
            <h2 className="text-xl font-bold text-foreground mb-6">Company Information</h2>
            {companyData ? (
              <form onSubmit={handleSave} className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-foreground">Company Name</label>
                  <Input
                    type="text"
                    placeholder="Your Company"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="mt-2 bg-input border-border text-foreground"
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground">Email</label>
                  <Input
                    type="email"
                    placeholder="admin@company.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="mt-2 bg-input border-border text-foreground"
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground">Phone</label>
                  <Input
                    type="tel"
                    placeholder="+1 (555) 123-4567"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="mt-2 bg-input border-border text-foreground"
                  />
                </div>
                <Button 
                  type="submit" 
                  disabled={isSaving}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {isSaving ? "Saving..." : "Save Changes"}
                </Button>
              </form>
            ) : (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No company information found. Please contact support.</p>
              </div>
            )}
          </Card>

          {/* Notification Settings */}
          <Card className="border-border p-8">
            <h2 className="text-xl font-bold text-foreground mb-6">Notifications</h2>
            <div className="space-y-4">
              <label className="flex items-center gap-3 p-3 bg-secondary/50 rounded-lg cursor-pointer">
                <input type="checkbox" defaultChecked className="w-4 h-4" />
                <span className="text-foreground">Email alerts for route updates</span>
              </label>
              <label className="flex items-center gap-3 p-3 bg-secondary/50 rounded-lg cursor-pointer">
                <input type="checkbox" defaultChecked className="w-4 h-4" />
                <span className="text-foreground">SMS alerts for emergencies</span>
              </label>
              <label className="flex items-center gap-3 p-3 bg-secondary/50 rounded-lg cursor-pointer">
                <input type="checkbox" className="w-4 h-4" />
                <span className="text-foreground">Weekly performance reports</span>
              </label>
            </div>
          </Card>
        </div>
      </main>
    </div>
  )
}
