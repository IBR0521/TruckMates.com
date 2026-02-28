"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
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
import { Plus, Copy, Trash2, Eye, EyeOff, Key, Calendar, Activity } from "lucide-react"
import { toast } from "sonner"
import {
  getAPIKeys,
  createAPIKey,
  revokeAPIKey,
  updateAPIKey,
} from "@/app/actions/enterprise-api-keys"
import { format } from "date-fns"

export default function APIKeysPage() {
  const [keys, setKeys] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [newKeyName, setNewKeyName] = useState("")
  const [newKey, setNewKey] = useState<string | null>(null)
  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null)

  useEffect(() => {
    loadKeys()
  }, [])

  async function loadKeys() {
    setLoading(true)
    try {
      const result = await getAPIKeys()
      if (result.error) {
        toast.error(result.error)
      } else {
        setKeys(result.data || [])
      }
    } catch (error: any) {
      toast.error(error?.message || "Failed to load API keys")
    } finally {
      setLoading(false)
    }
  }

  async function handleCreateKey() {
    if (!newKeyName.trim()) {
      toast.error("Please enter a name for the API key")
      return
    }

    try {
      const result = await createAPIKey({ name: newKeyName })
      if (result.error) {
        toast.error(result.error)
      } else {
        setNewKey(result.data?.key || null)
        setNewKeyName("")
        setIsCreateDialogOpen(false)
        await loadKeys()
        toast.success("API key created successfully")
      }
    } catch (error: any) {
      toast.error(error?.message || "Failed to create API key")
    }
  }

  async function handleRevokeKey(id: string) {
    try {
      const result = await revokeAPIKey(id)
      if (result.error) {
        toast.error(result.error)
      } else {
        await loadKeys()
        toast.success("API key revoked")
      }
    } catch (error: any) {
      toast.error(error?.message || "Failed to revoke API key")
    }
  }

  async function handleToggleActive(id: string, currentStatus: boolean) {
    try {
      const result = await updateAPIKey(id, { is_active: !currentStatus })
      if (result.error) {
        toast.error(result.error)
      } else {
        await loadKeys()
        toast.success(`API key ${!currentStatus ? "activated" : "deactivated"}`)
      }
    } catch (error: any) {
      toast.error(error?.message || "Failed to update API key")
    }
  }

  function copyToClipboard(text: string, keyId: string) {
    navigator.clipboard.writeText(text)
    setCopiedKeyId(keyId)
    toast.success("Copied to clipboard")
    setTimeout(() => setCopiedKeyId(null), 2000)
  }

  if (loading) {
    return (
      <div className="w-full p-8">
        <Card className="p-8">
          <p className="text-center text-muted-foreground">Loading API keys...</p>
        </Card>
      </div>
    )
  }

  return (
    <div className="w-full">
      <div className="border-b border-border bg-card/50 backdrop-blur px-4 md:px-8 py-4 md:py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">API Keys</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Manage API keys for programmatic access to your data
            </p>
          </div>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Create API Key
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New API Key</DialogTitle>
                <DialogDescription>
                  Give your API key a descriptive name. You'll be able to copy the full key after creation.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="key-name">Key Name</Label>
                  <Input
                    id="key-name"
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                    placeholder="e.g., Production API Key"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateKey}>Create Key</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Show new key once */}
      {newKey && (
        <div className="p-8">
          <Card className="p-6 bg-green-500/10 border-green-500/30">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  API Key Created
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Copy this key now. You won't be able to see it again!
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setNewKey(null)}
              >
                ×
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <code className="flex-1 p-3 bg-background rounded border border-border font-mono text-sm break-all">
                {newKey}
              </code>
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(newKey, "new")}
              >
                <Copy className="w-4 h-4" />
              </Button>
            </div>
          </Card>
        </div>
      )}

      <div className="p-8">
        {keys.length === 0 ? (
          <Card className="p-12 text-center">
            <Key className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">No API Keys</h3>
            <p className="text-muted-foreground mb-6">
              Create your first API key to enable programmatic access to your data.
            </p>
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Create API Key
            </Button>
          </Card>
        ) : (
          <div className="space-y-4">
            {keys.map((key) => (
              <Card key={key.id} className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold">{key.name}</h3>
                      <span
                        className={`px-2 py-1 rounded text-xs font-semibold ${
                          key.is_active
                            ? "bg-green-500/20 text-green-400"
                            : "bg-gray-500/20 text-gray-400"
                        }`}
                      >
                        {key.is_active ? "Active" : "Inactive"}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Key className="w-4 h-4" />
                        <code>{key.key_prefix}...</code>
                      </div>
                      {key.last_used_at && (
                        <div className="flex items-center gap-1">
                          <Activity className="w-4 h-4" />
                          Last used: {format(new Date(key.last_used_at), "MMM d, yyyy")}
                        </div>
                      )}
                      {key.expires_at && (
                        <div className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          Expires: {format(new Date(key.expires_at), "MMM d, yyyy")}
                        </div>
                      )}
                    </div>
                    <div className="mt-3 text-sm text-muted-foreground">
                      Rate limit: {key.rate_limit_per_minute}/min, {key.rate_limit_per_day}/day
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleToggleActive(key.id, key.is_active)}
                    >
                      {key.is_active ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="text-red-400">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Revoke API Key?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently delete the API key. Any applications using this key will stop working immediately.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleRevokeKey(key.id)}
                            className="bg-red-500 hover:bg-red-600"
                          >
                            Revoke Key
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

