"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Plus, Trash2, Edit, TestTube, ExternalLink, CheckCircle2, XCircle, Clock } from "lucide-react"
import { toast } from "sonner"
import {
  getWebhooks,
  createWebhook,
  updateWebhook,
  deleteWebhook,
  testWebhook,
  getWebhookDeliveries,
  retryWebhookDelivery,
} from "@/app/actions/webhooks"

const WEBHOOK_EVENTS = [
  { id: "load.created", label: "Load Created" },
  { id: "load.updated", label: "Load Updated" },
  { id: "load.completed", label: "Load Completed" },
  { id: "load.cancelled", label: "Load Cancelled" },
  { id: "driver.assigned", label: "Driver Assigned" },
  { id: "driver.violation", label: "Driver Violation" },
  { id: "route.optimized", label: "Route Optimized" },
  { id: "route.completed", label: "Route Completed" },
  { id: "invoice.created", label: "Invoice Created" },
  { id: "invoice.paid", label: "Invoice Paid" },
  { id: "invoice.overdue", label: "Invoice Overdue" },
  { id: "maintenance.scheduled", label: "Maintenance Scheduled" },
  { id: "maintenance.completed", label: "Maintenance Completed" },
  { id: "document.uploaded", label: "Document Uploaded" },
  { id: "document.expiring", label: "Document Expiring" },
  { id: "document.expired", label: "Document Expired" },
] as const

export default function WebhooksPage() {
  const [webhooks, setWebhooks] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [editingWebhook, setEditingWebhook] = useState<any>(null)
  const [selectedWebhook, setSelectedWebhook] = useState<string | null>(null)
  const [deliveries, setDeliveries] = useState<any[]>([])
  const [showDeliveries, setShowDeliveries] = useState(false)

  const [formData, setFormData] = useState({
    url: "",
    events: [] as string[],
    secret: "",
    description: "",
    active: true,
  })

  useEffect(() => {
    loadWebhooks()
  }, [])

  async function loadWebhooks() {
    setLoading(true)
    try {
      const result = await getWebhooks()
      if (result.error) {
        toast.error(result.error)
      } else {
        setWebhooks(result.data || [])
      }
    } catch (error: any) {
      toast.error(error?.message || "Failed to load webhooks")
    } finally {
      setLoading(false)
    }
  }

  async function handleCreate() {
    if (!formData.url || formData.events.length === 0) {
      toast.error("URL and at least one event are required")
      return
    }

    try {
      const result = await createWebhook(formData)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success("Webhook created successfully")
        setShowCreateDialog(false)
        resetForm()
        loadWebhooks()
      }
    } catch (error: any) {
      toast.error(error?.message || "Failed to create webhook")
    }
  }

  async function handleUpdate() {
    if (!editingWebhook || !formData.url || formData.events.length === 0) {
      toast.error("URL and at least one event are required")
      return
    }

    try {
      const result = await updateWebhook(editingWebhook.id, formData)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success("Webhook updated successfully")
        setEditingWebhook(null)
        resetForm()
        loadWebhooks()
      }
    } catch (error: any) {
      toast.error(error?.message || "Failed to update webhook")
    }
  }

  async function handleDelete(id: string) {
    try {
      const result = await deleteWebhook(id)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success("Webhook deleted successfully")
        loadWebhooks()
      }
    } catch (error: any) {
      toast.error(error?.message || "Failed to delete webhook")
    }
  }

  async function handleTest(id: string) {
    try {
      const result = await testWebhook(id)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success("Test webhook sent successfully")
        loadWebhooks()
      }
    } catch (error: any) {
      toast.error(error?.message || "Failed to test webhook")
    }
  }

  async function loadDeliveries(webhookId: string) {
    try {
      const result = await getWebhookDeliveries(webhookId)
      if (result.error) {
        toast.error(result.error)
      } else {
        setDeliveries(result.data || [])
        setSelectedWebhook(webhookId)
        setShowDeliveries(true)
      }
    } catch (error: any) {
      toast.error(error?.message || "Failed to load deliveries")
    }
  }

  function resetForm() {
    setFormData({
      url: "",
      events: [],
      secret: "",
      description: "",
      active: true,
    })
  }

  function handleEdit(webhook: any) {
    setEditingWebhook(webhook)
    setFormData({
      url: webhook.url,
      events: webhook.events || [],
      secret: "", // Don't show existing secret
      description: webhook.description || "",
      active: webhook.active,
    })
    setShowCreateDialog(true)
  }

  function toggleEvent(eventId: string) {
    setFormData((prev) => ({
      ...prev,
      events: prev.events.includes(eventId)
        ? prev.events.filter((e) => e !== eventId)
        : [...prev.events, eventId],
    }))
  }

  function getStatusIcon(status: string) {
    switch (status) {
      case "delivered":
        return <CheckCircle2 className="w-4 h-4 text-green-500" />
      case "failed":
        return <XCircle className="w-4 h-4 text-red-500" />
      case "retrying":
        return <Clock className="w-4 h-4 text-yellow-500" />
      default:
        return <Clock className="w-4 h-4 text-gray-500" />
    }
  }

  return (
    <div className="w-full">
      <div className="border-b border-border bg-card/50 backdrop-blur px-4 md:px-8 py-4 md:py-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Webhooks</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Configure webhooks to receive real-time notifications about events in your account
          </p>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button
              onClick={() => {
                resetForm()
                setEditingWebhook(null)
              }}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Webhook
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingWebhook ? "Edit Webhook" : "Create Webhook"}</DialogTitle>
              <DialogDescription>
                Configure a webhook to receive notifications about events in your account
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="url">Webhook URL *</Label>
                <Input
                  id="url"
                  type="url"
                  placeholder="https://example.com/webhook"
                  value={formData.url}
                  onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                />
              </div>
              <div>
                <Label>Events *</Label>
                <div className="grid grid-cols-2 gap-2 mt-2 p-4 border rounded-lg max-h-64 overflow-y-auto">
                  {WEBHOOK_EVENTS.map((event) => (
                    <div key={event.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={event.id}
                        checked={formData.events.includes(event.id)}
                        onCheckedChange={() => toggleEvent(event.id)}
                      />
                      <label
                        htmlFor={event.id}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                      >
                        {event.label}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <Label htmlFor="secret">Secret (optional)</Label>
                <Input
                  id="secret"
                  type="text"
                  placeholder="Leave empty to auto-generate"
                  value={formData.secret}
                  onChange={(e) => setFormData({ ...formData, secret: e.target.value })}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Used to sign webhook payloads. If empty, a secret will be auto-generated.
                </p>
              </div>
              <div>
                <Label htmlFor="description">Description (optional)</Label>
                <Textarea
                  id="description"
                  placeholder="Describe what this webhook is used for"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="active"
                  checked={formData.active}
                  onCheckedChange={(checked) => setFormData({ ...formData, active: checked as boolean })}
                />
                <label htmlFor="active" className="text-sm font-medium leading-none cursor-pointer">
                  Active
                </label>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={editingWebhook ? handleUpdate : handleCreate}
                  className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground"
                >
                  {editingWebhook ? "Update" : "Create"} Webhook
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowCreateDialog(false)
                    resetForm()
                    setEditingWebhook(null)
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="p-8">
        <div className="max-w-7xl mx-auto">
          {loading ? (
            <Card className="p-8">
              <p className="text-center text-muted-foreground">Loading webhooks...</p>
            </Card>
          ) : webhooks.length === 0 ? (
            <Card className="p-8">
              <div className="text-center py-12">
                <p className="text-muted-foreground mb-4">No webhooks configured</p>
                <p className="text-sm text-muted-foreground">
                  Create a webhook to receive real-time notifications about events in your account
                </p>
              </div>
            </Card>
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>URL</TableHead>
                    <TableHead>Events</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {webhooks.map((webhook) => (
                    <TableRow key={webhook.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <ExternalLink className="w-4 h-4 text-muted-foreground" />
                          <span className="font-mono text-sm">{webhook.url}</span>
                        </div>
                        {webhook.description && (
                          <p className="text-xs text-muted-foreground mt-1">{webhook.description}</p>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {(webhook.events || []).slice(0, 3).map((event: string) => (
                            <span key={event} className="text-xs px-2 py-1 bg-muted rounded">
                              {event}
                            </span>
                          ))}
                          {(webhook.events || []).length > 3 && (
                            <span className="text-xs px-2 py-1 bg-muted rounded">
                              +{(webhook.events || []).length - 3} more
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {webhook.active ? (
                          <span className="text-xs px-2 py-1 bg-green-500/20 text-green-400 rounded">Active</span>
                        ) : (
                          <span className="text-xs px-2 py-1 bg-gray-500/20 text-gray-400 rounded">Inactive</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {new Date(webhook.created_at).toLocaleDateString()}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => loadDeliveries(webhook.id)}
                            title="View Delivery History"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleTest(webhook.id)} title="Test Webhook">
                            <TestTube className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleEdit(webhook)} title="Edit">
                            <Edit className="w-4 h-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm" title="Delete">
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This action cannot be undone. This will permanently delete the webhook and stop all
                                  future deliveries.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDelete(webhook.id)}>Delete</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </div>
      </div>

      {/* Delivery History Dialog */}
      <Dialog open={showDeliveries} onOpenChange={setShowDeliveries}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Webhook Delivery History</DialogTitle>
            <DialogDescription>View delivery history and retry failed deliveries</DialogDescription>
          </DialogHeader>
          {deliveries.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No deliveries yet</p>
          ) : (
            <div className="space-y-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Event</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Response</TableHead>
                    <TableHead>Attempts</TableHead>
                    <TableHead>Time</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deliveries.map((delivery) => (
                    <TableRow key={delivery.id}>
                      <TableCell className="font-mono text-sm">{delivery.event_type}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {getStatusIcon(delivery.status)}
                          <span className="text-sm capitalize">{delivery.status}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {delivery.response_code ? (
                          <span className={`text-sm ${delivery.response_code >= 200 && delivery.response_code < 300 ? "text-green-400" : "text-red-400"}`}>
                            {delivery.response_code}
                          </span>
                        ) : (
                          <span className="text-sm text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">
                          {delivery.attempts} / {delivery.max_attempts}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {new Date(delivery.created_at).toLocaleString()}
                        </span>
                      </TableCell>
                      <TableCell>
                        {delivery.status === "failed" || delivery.status === "retrying" ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={async () => {
                              const result = await retryWebhookDelivery(delivery.id)
                              if (result.error) {
                                toast.error(result.error)
                              } else {
                                toast.success("Webhook retry initiated")
                                loadDeliveries(selectedWebhook!)
                              }
                            }}
                          >
                            Retry
                          </Button>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

