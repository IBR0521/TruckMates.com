"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Trash2, Edit } from "lucide-react"
import { toast } from "sonner"
import { getReminders, createReminder, completeReminder, getOverdueReminders, updateReminder, deleteReminder } from "@/app/actions/reminders"
import { getDrivers } from "@/app/actions/drivers"
import { getTrucks } from "@/app/actions/trucks"
import { getLoads } from "@/app/actions/loads"
import { Calendar, Plus, CheckCircle2, AlertTriangle, Clock } from "lucide-react"
import { format } from "date-fns"

export default function RemindersPage() {
  const [reminders, setReminders] = useState<any[]>([])
  const [overdueReminders, setOverdueReminders] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [filter, setFilter] = useState("pending") // pending, completed, overdue, all
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [editingReminder, setEditingReminder] = useState<any | null>(null)
  const [deletingReminder, setDeletingReminder] = useState<string | null>(null)
  const [drivers, setDrivers] = useState<any[]>([])
  const [trucks, setTrucks] = useState<any[]>([])
  const [loads, setLoads] = useState<any[]>([])
  
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    reminder_type: "custom",
    due_date: "",
    due_time: "",
    is_recurring: false,
    recurrence_pattern: "monthly",
    recurrence_interval: 1,
    driver_id: "",
    truck_id: "",
    load_id: "",
    send_email: true,
    send_sms: false,
  })

  // CRITICAL FIX 2 & MEDIUM FIX 2: Separate data fetching
  // Load drivers, trucks, loads once on mount
  useEffect(() => {
    async function loadStaticData() {
      try {
        const [driversResult, trucksResult, loadsResult] = await Promise.all([
          getDrivers(),
          getTrucks(),
          getLoads(),
        ])
        if (driversResult.data) setDrivers(driversResult.data)
        if (trucksResult.data) setTrucks(trucksResult.data)
        if (loadsResult.data) setLoads(loadsResult.data)
      } catch (error: any) {
        console.error("Failed to load static data:", error)
      }
    }
    loadStaticData()
  }, [])

  // Load reminders when filter changes
  useEffect(() => {
    loadReminders()
  }, [filter])

  async function loadReminders() {
    setIsLoading(true)
    try {
      // CRITICAL FIX 2: Skip getReminders when filter is 'overdue'
      if (filter === "overdue") {
        const overdueResult = await getOverdueReminders()
        if (overdueResult.data) {
          setOverdueReminders(overdueResult.data)
        }
        setIsLoading(false)
        return
      }

      const [remindersResult, overdueResult] = await Promise.all([
        getReminders({ status: filter === "all" ? undefined : filter }),
        getOverdueReminders(),
      ])

      if (remindersResult.data) {
        setReminders(remindersResult.data)
      }
      if (overdueResult.data) {
        setOverdueReminders(overdueResult.data)
      }
    } catch (error: any) {
      toast.error("Failed to load reminders")
    } finally {
      setIsLoading(false)
    }
  }

  async function loadData() {
    // Legacy function for backward compatibility
    await loadReminders()
  }

  async function handleCreate() {
    // LOW FIX 2: Client-side validation for past due dates
    if (formData.due_date && new Date(formData.due_date) < new Date()) {
      toast.error("Due date must be in the future")
      return
    }
    try {
      const result = await createReminder(formData)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success("Reminder created")
        setIsCreateOpen(false)
        setFormData({
          title: "",
          description: "",
          reminder_type: "custom",
          due_date: "",
          due_time: "",
          is_recurring: false,
          recurrence_pattern: "monthly",
          recurrence_interval: 1,
          driver_id: "",
          truck_id: "",
          load_id: "",
          send_email: true,
          send_sms: false,
        })
        loadReminders()
      }
    } catch (error: any) {
      toast.error("Failed to create reminder")
    }
  }

  async function handleComplete(id: string) {
    try {
      const result = await completeReminder(id)
      if (result.error) {
        toast.error(result.error)
      } else {
        if (result.warning) {
          toast.warning(result.warning)
        } else {
          toast.success("Reminder completed")
        }
        loadReminders()
      }
    } catch (error: any) {
      toast.error("Failed to complete reminder")
    }
  }

  async function handleDelete(id: string) {
    try {
      const result = await deleteReminder(id)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success("Reminder deleted")
        loadReminders()
      }
    } catch (error: any) {
      toast.error("Failed to delete reminder")
    } finally {
      setDeletingReminder(null)
    }
  }

  async function handleUpdate() {
    if (!editingReminder) return
    // LOW FIX 2: Client-side validation
    if (editingReminder.due_date && new Date(editingReminder.due_date) < new Date()) {
      toast.error("Due date must be in the future")
      return
    }
    try {
      const result = await updateReminder(editingReminder.id, {
        title: editingReminder.title,
        description: editingReminder.description,
        reminder_type: editingReminder.reminder_type,
        due_date: editingReminder.due_date,
        due_time: editingReminder.due_time,
      })
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success("Reminder updated")
        setEditingReminder(null)
        loadReminders()
      }
    } catch (error: any) {
      toast.error("Failed to update reminder")
    }
  }

  function getTypeLabel(type: string) {
    return type.split("_").map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(" ")
  }

  function getStatusBadge(status: string) {
    switch (status) {
      case "pending":
        return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />Pending</Badge>
      case "completed":
        return <Badge variant="default" className="bg-green-500/20 text-green-600 dark:text-green-400 border-green-500/50"><CheckCircle2 className="w-3 h-3 mr-1" />Completed</Badge>
      case "overdue":
        return <Badge variant="destructive"><AlertTriangle className="w-3 h-3 mr-1" />Overdue</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  const displayReminders = filter === "overdue" ? overdueReminders : reminders

  return (
    <div className="w-full">
      <div className="border-b border-border bg-card/50 backdrop-blur px-4 md:px-8 py-4 md:py-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Reminders</h1>
          <p className="text-sm text-muted-foreground mt-1">Track important deadlines and tasks</p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90">
              <Plus className="w-4 h-4 mr-2" />
              Create Reminder
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create Reminder</DialogTitle>
              <DialogDescription>Set up a new reminder for important tasks or deadlines</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="mt-2"
                  required
                />
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="mt-2"
                />
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="reminder_type">Type</Label>
                  <Select value={formData.reminder_type} onValueChange={(value) => setFormData({ ...formData, reminder_type: value })}>
                    <SelectTrigger className="mt-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="maintenance">Maintenance</SelectItem>
                      <SelectItem value="license_renewal">License Renewal</SelectItem>
                      <SelectItem value="insurance_renewal">Insurance Renewal</SelectItem>
                      <SelectItem value="invoice_due">Invoice Due</SelectItem>
                      <SelectItem value="load_delivery">Load Delivery</SelectItem>
                      <SelectItem value="check_call">Check Call</SelectItem>
                      <SelectItem value="custom">Custom</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="due_date">Due Date *</Label>
                  <Input
                    id="due_date"
                    type="date"
                    value={formData.due_date}
                    onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                    className="mt-2"
                    min={new Date().toISOString().split('T')[0]}
                    required
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="due_time">Due Time</Label>
                <Input
                  id="due_time"
                  type="time"
                  value={formData.due_time}
                  onChange={(e) => setFormData({ ...formData, due_time: e.target.value })}
                  className="mt-2"
                />
              </div>
              <div className="grid md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="driver">Driver</Label>
                  <Select value={formData.driver_id || "none"} onValueChange={(value) => setFormData({ ...formData, driver_id: value === "none" ? "" : value })}>
                    <SelectTrigger className="mt-2">
                      <SelectValue placeholder="Select driver" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {drivers.map((driver) => (
                        <SelectItem key={driver.id} value={driver.id}>{driver.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="truck">Truck</Label>
                  <Select value={formData.truck_id || "none"} onValueChange={(value) => setFormData({ ...formData, truck_id: value === "none" ? "" : value })}>
                    <SelectTrigger className="mt-2">
                      <SelectValue placeholder="Select truck" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {trucks.map((truck) => (
                        <SelectItem key={truck.id} value={truck.id}>{truck.truck_number}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="load">Load</Label>
                  <Select value={formData.load_id || "none"} onValueChange={(value) => setFormData({ ...formData, load_id: value === "none" ? "" : value })}>
                    <SelectTrigger className="mt-2">
                      <SelectValue placeholder="Select load" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {loads.map((load) => (
                        <SelectItem key={load.id} value={load.id}>{load.shipment_number}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button onClick={handleCreate} className="w-full" disabled={!formData.title || !formData.due_date}>
                Create Reminder
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="p-4 md:p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Filters */}
          <Card className="p-4">
            <div className="flex items-center gap-4">
              <div>
                <label className="text-sm text-muted-foreground mr-2">Status:</label>
                <Select value={filter} onValueChange={setFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="overdue">Overdue</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {overdueReminders.length > 0 && (
                <Badge variant="destructive" className="ml-auto">
                  {overdueReminders.length} Overdue
                </Badge>
              )}
            </div>
          </Card>

          {/* Reminders List */}
          {isLoading ? (
            <div className="text-center py-8">Loading reminders...</div>
          ) : displayReminders.length === 0 ? (
            <Card className="p-8 text-center">
              <Calendar className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">No reminders found</p>
            </Card>
          ) : (
            <div className="space-y-4">
              {displayReminders.map((reminder) => (
                <Card key={reminder.id} className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        {getStatusBadge(reminder.status)}
                        <Badge variant="outline">{getTypeLabel(reminder.reminder_type)}</Badge>
                        {reminder.is_recurring && (
                          <Badge variant="secondary">Recurring</Badge>
                        )}
                      </div>
                      <h3 className="font-semibold text-lg mb-1">{reminder.title}</h3>
                      {reminder.description && (
                        <p className="text-muted-foreground mb-3">{reminder.description}</p>
                      )}
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          Due: {format(new Date(reminder.due_date), "MMM d, yyyy")}
                          {reminder.due_time && ` at ${reminder.due_time}`}
                        </span>
                        {reminder.driver_id && (
                          <span>Driver: {drivers.find(d => d.id === reminder.driver_id)?.name || "Unknown"}</span>
                        )}
                        {reminder.truck_id && (
                          <span>Truck: {trucks.find(t => t.id === reminder.truck_id)?.truck_number || "Unknown"}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {reminder.status === "pending" && (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setEditingReminder(reminder)}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setDeletingReminder(reminder.id)}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleComplete(reminder.id)}
                          >
                            <CheckCircle2 className="w-4 h-4 mr-2" />
                            Complete
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog open={!!editingReminder} onOpenChange={(open) => !open && setEditingReminder(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Reminder</DialogTitle>
          </DialogHeader>
          {editingReminder && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="edit-title">Title *</Label>
                <Input
                  id="edit-title"
                  value={editingReminder.title}
                  onChange={(e) => setEditingReminder({ ...editingReminder, title: e.target.value })}
                  className="mt-2"
                />
              </div>
              <div>
                <Label htmlFor="edit-description">Description</Label>
                <Input
                  id="edit-description"
                  value={editingReminder.description || ""}
                  onChange={(e) => setEditingReminder({ ...editingReminder, description: e.target.value })}
                  className="mt-2"
                />
              </div>
              <div>
                <Label htmlFor="edit-due_date">Due Date *</Label>
                <Input
                  id="edit-due_date"
                  type="date"
                  value={editingReminder.due_date}
                  onChange={(e) => setEditingReminder({ ...editingReminder, due_date: e.target.value })}
                  className="mt-2"
                  min={new Date().toISOString().split('T')[0]}
                />
              </div>
              <Button onClick={handleUpdate} className="w-full">Update Reminder</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletingReminder} onOpenChange={(open) => !open && setDeletingReminder(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Reminder</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this reminder? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deletingReminder && handleDelete(deletingReminder)} className="bg-destructive">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}








