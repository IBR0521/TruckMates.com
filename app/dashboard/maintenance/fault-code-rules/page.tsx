"use client"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Plus, Edit, Trash2, Search, AlertCircle, Wrench } from "lucide-react"
import { useState, useEffect } from "react"
import { toast } from "sonner"
import {
  getFaultCodeRules,
  upsertFaultCodeRule,
  deleteFaultCodeRule,
} from "@/app/actions/maintenance-enhanced"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

export default function FaultCodeRulesPage() {
  const [rules, setRules] = useState<any[]>([])
  const [filteredRules, setFilteredRules] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingRule, setEditingRule] = useState<any>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    fault_code: "",
    fault_code_category: "",
    service_type: "",
    priority: "normal",
    estimated_cost: "",
    estimated_labor_hours: "",
    description: "",
    auto_create_maintenance: true,
    schedule_days_ahead: "0",
  })

  useEffect(() => {
    loadRules()
  }, [])

  useEffect(() => {
    let filtered = [...rules]
    if (searchTerm) {
      filtered = filtered.filter(
        (rule) =>
          rule.fault_code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          rule.service_type?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          rule.fault_code_category?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }
    setFilteredRules(filtered)
  }, [rules, searchTerm])

  async function loadRules() {
    setIsLoading(true)
    const result = await getFaultCodeRules()
    if (result.error) {
      toast.error(result.error)
    } else {
      setRules(result.data || [])
      setFilteredRules(result.data || [])
    }
    setIsLoading(false)
  }

  function openDialog(rule?: any) {
    if (rule) {
      setEditingRule(rule)
      setFormData({
        fault_code: rule.fault_code || "",
        fault_code_category: rule.fault_code_category || "",
        service_type: rule.service_type || "",
        priority: rule.priority || "normal",
        estimated_cost: rule.estimated_cost?.toString() || "",
        estimated_labor_hours: rule.estimated_labor_hours?.toString() || "",
        description: rule.description || "",
        auto_create_maintenance: rule.auto_create_maintenance !== false,
        schedule_days_ahead: rule.schedule_days_ahead?.toString() || "0",
      })
    } else {
      setEditingRule(null)
      setFormData({
        fault_code: "",
        fault_code_category: "",
        service_type: "",
        priority: "normal",
        estimated_cost: "",
        estimated_labor_hours: "",
        description: "",
        auto_create_maintenance: true,
        schedule_days_ahead: "0",
      })
    }
    setIsDialogOpen(true)
  }

  async function handleSave() {
    if (!formData.fault_code || !formData.service_type) {
      toast.error("Fault code and service type are required")
      return
    }

    const result = await upsertFaultCodeRule({
      id: editingRule?.id,
      fault_code: formData.fault_code,
      fault_code_category: formData.fault_code_category || undefined,
      service_type: formData.service_type,
      priority: formData.priority as any,
      estimated_cost: formData.estimated_cost ? parseFloat(formData.estimated_cost) : undefined,
      estimated_labor_hours: formData.estimated_labor_hours
        ? parseFloat(formData.estimated_labor_hours)
        : undefined,
      description: formData.description || undefined,
      auto_create_maintenance: formData.auto_create_maintenance,
      schedule_days_ahead: parseInt(formData.schedule_days_ahead) || 0,
    })

    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success(editingRule ? "Rule updated successfully" : "Rule created successfully")
      setIsDialogOpen(false)
      loadRules()
    }
  }

  return (
    <div className="w-full">
      <div className="border-b border-border bg-card/50 backdrop-blur px-4 md:px-8 py-4 md:py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Fault Code Rules</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Configure automatic maintenance creation from ELD fault codes
            </p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => openDialog()}>
                <Plus className="w-4 h-4 mr-2" />
                Add Rule
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingRule ? "Edit" : "Create"} Fault Code Rule</DialogTitle>
                <DialogDescription>
                  Define how maintenance should be created when this fault code is detected
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Fault Code *</Label>
                  <Input
                    value={formData.fault_code}
                    onChange={(e) => setFormData({ ...formData, fault_code: e.target.value })}
                    placeholder="e.g., P0300, C1201"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    OBD-II fault code (e.g., P0300) or custom code
                  </p>
                </div>
                <div>
                  <Label>Fault Code Category</Label>
                  <Select
                    value={formData.fault_code_category}
                    onValueChange={(value) =>
                      setFormData({ ...formData, fault_code_category: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="engine">Engine</SelectItem>
                      <SelectItem value="transmission">Transmission</SelectItem>
                      <SelectItem value="brakes">Brakes</SelectItem>
                      <SelectItem value="electrical">Electrical</SelectItem>
                      <SelectItem value="cooling">Cooling</SelectItem>
                      <SelectItem value="fuel">Fuel</SelectItem>
                      <SelectItem value="emissions">Emissions</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Service Type *</Label>
                  <Input
                    value={formData.service_type}
                    onChange={(e) => setFormData({ ...formData, service_type: e.target.value })}
                    placeholder="e.g., Engine Misfire Diagnosis"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Priority</Label>
                    <Select
                      value={formData.priority}
                      onValueChange={(value) => setFormData({ ...formData, priority: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="normal">Normal</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Schedule Days Ahead</Label>
                    <Input
                      type="number"
                      value={formData.schedule_days_ahead}
                      onChange={(e) =>
                        setFormData({ ...formData, schedule_days_ahead: e.target.value })
                      }
                      placeholder="0"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      0 = immediate, 7 = 7 days ahead
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Estimated Cost</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.estimated_cost}
                      onChange={(e) => setFormData({ ...formData, estimated_cost: e.target.value })}
                      placeholder="0.00"
                    />
                  </div>
                  <div>
                    <Label>Estimated Labor Hours</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={formData.estimated_labor_hours}
                      onChange={(e) =>
                        setFormData({ ...formData, estimated_labor_hours: e.target.value })
                      }
                      placeholder="0.0"
                    />
                  </div>
                </div>
                <div>
                  <Label>Description</Label>
                  <Textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Optional description of the fault code and required service"
                    rows={3}
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="auto-create"
                    checked={formData.auto_create_maintenance}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, auto_create_maintenance: checked })
                    }
                  />
                  <Label htmlFor="auto-create" className="cursor-pointer">
                    Automatically create maintenance when this fault code is detected
                  </Label>
                </div>
                <div className="flex justify-end gap-2 pt-4">
                  <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleSave}>Save Rule</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="p-8">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Search */}
          <Card className="border-border p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search fault codes, service types, or categories..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </Card>

          {/* Info Card */}
          <Card className="border-border p-6 bg-blue-500/10 border-blue-500/50">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-blue-400 mt-0.5" />
              <div>
                <h3 className="font-semibold mb-1">How Fault Code Rules Work</h3>
                <p className="text-sm text-muted-foreground">
                  When an ELD device detects a fault code, the system automatically checks for a matching rule.
                  If found and auto-create is enabled, a maintenance work order is created with the specified
                  service type, priority, and estimated cost. Rules with <code>company_id = NULL</code> are
                  default rules available to all companies.
                </p>
              </div>
            </div>
          </Card>

          {/* Rules Table */}
          {isLoading ? (
            <Card className="border-border p-8">
              <div className="text-center py-8">
                <p className="text-muted-foreground">Loading fault code rules...</p>
              </div>
            </Card>
          ) : filteredRules.length === 0 ? (
            <Card className="border-border p-8">
              <div className="text-center py-12">
                <Wrench className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-50" />
                <h3 className="text-xl font-semibold text-foreground mb-2">No fault code rules found</h3>
                <p className="text-muted-foreground mb-6">
                  {searchTerm
                    ? "Try adjusting your search"
                    : "Create your first fault code rule to enable automatic maintenance creation"}
                </p>
                {!searchTerm && (
                  <Button onClick={() => openDialog()}>
                    <Plus className="w-4 h-4 mr-2" />
                    Create First Rule
                  </Button>
                )}
              </div>
            </Card>
          ) : (
            <Card className="border-border overflow-hidden">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fault Code</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Service Type</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Est. Cost</TableHead>
                      <TableHead>Auto-Create</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRules.map((rule) => (
                      <TableRow key={rule.id}>
                        <TableCell className="font-mono">{rule.fault_code}</TableCell>
                        <TableCell>
                          {rule.fault_code_category && (
                            <Badge variant="outline">{rule.fault_code_category}</Badge>
                          )}
                        </TableCell>
                        <TableCell>{rule.service_type}</TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={
                              rule.priority === "urgent" || rule.priority === "high"
                                ? "border-red-500/50 text-red-400"
                                : ""
                            }
                          >
                            {rule.priority}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {rule.estimated_cost ? `$${rule.estimated_cost.toFixed(2)}` : "N/A"}
                        </TableCell>
                        <TableCell>
                          {rule.auto_create_maintenance ? (
                            <Badge className="bg-green-500/20 text-green-400">Yes</Badge>
                          ) : (
                            <Badge variant="outline">No</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openDialog(rule)}
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            {rule.company_id && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setDeleteId(rule.id)}
                                className="text-red-400 hover:text-red-500"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Fault Code Rule?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this fault code rule. Maintenance will no longer be
              automatically created for this fault code.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!deleteId) return
                const result = await deleteFaultCodeRule(deleteId)
                if (result.error) {
                  toast.error(result.error)
                } else {
                  toast.success("Fault code rule deleted successfully")
                  loadRules()
                }
                setDeleteId(null)
              }}
              className="bg-red-500 hover:bg-red-600"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}


